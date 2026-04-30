const { app, BrowserWindow, ipcMain, Menu, dialog, shell, crashReporter } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const tokenChannel = require('./tokenChannel');
const apiKeyChannel = require('./apiKeyChannel');
const scriptControlChannel = require('./scriptControlChannel');
apiKeyChannel.startServer();
scriptControlChannel.startServer();

let mainWindow = null;
let crashReporterStarted = false;
let crashExtraUserId = '';

function getInstallDirectory() {
    // 获取安装目录（exe所在目录）
    // 开发环境：使用 __dirname
    // 打包后：使用 process.execPath 的目录
    if (app.isPackaged) {
        return path.dirname(process.execPath);
    } else {
        return __dirname;
    }
}

function formatDateTimeForFile(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}${MM}${dd}_${hh}${mm}${ss}`;
}

function startCrashReporter() {
    if (crashReporterStarted) return;
    try {
        // 日志目录：安装目录下的 logs 文件夹
        const installDir = getInstallDirectory();
        const crashDir = path.join(installDir, 'logs');
        
        // 提前创建 logs 目录
        fs.mkdirSync(crashDir, { recursive: true });
        
        crashReporter.start({
            companyName: 'cxexam',
            productName: 'CxExam-AUTO',
            submitURL: '',
            uploadToServer: false,
            compress: true,
            crashesDirectory: crashDir,
            globalExtra: {
                userid: crashExtraUserId
            }
        });
        
        // 监听 logs 目录，当新的崩溃日志生成时，重命名为时间戳格式
        // 使用轮询方式检查新文件（每2秒检查一次）
        setInterval(() => {
            try {
                if (!fs.existsSync(crashDir)) return;
                const files = fs.readdirSync(crashDir);
                files.forEach(file => {
                    const filePath = path.join(crashDir, file);
                    const ext = path.extname(file).toLowerCase();
                    // 只处理未重命名的崩溃日志文件（文件名不以时间戳格式开头）
                    if ((ext === '.dmp' || file.includes('crash') || file.includes('Crash')) && 
                        !/^\d{8}_\d{6}/.test(file)) {
                        try {
                            const stats = fs.statSync(filePath);
                            const timeStr = formatDateTimeForFile(stats.birthtime || stats.mtime);
                            const newName = `${timeStr}${ext}`;
                            const newPath = path.join(crashDir, newName);
                            
                            // 如果新文件名已存在，添加序号
                            let finalPath = newPath;
                            let counter = 1;
                            while (fs.existsSync(finalPath)) {
                                const nameWithoutExt = path.basename(newPath, ext);
                                finalPath = path.join(crashDir, `${nameWithoutExt}_${counter}${ext}`);
                                counter++;
                            }
                            
                            fs.renameSync(filePath, finalPath);
                        } catch (e) {
                            // 忽略重命名错误（文件可能正在被写入）
                        }
                    }
                });
            } catch (e) {
                // 忽略目录读取错误
            }
        }, 2000); // 每2秒检查一次
        
        crashReporterStarted = true;
    } catch (e) {
        console.error('启动 crashReporter 失败:', e);
    }
}

function updateCrashReporterUser(card) {
    crashExtraUserId = card ? String(card) : '';
    try {
        if (crashReporter && typeof crashReporter.addExtraParameter === 'function') {
            crashReporter.addExtraParameter('userid', crashExtraUserId);
        }
    } catch (_) {
        // ignore
    }
}

function createWindow() {
    const iconPath = path.join(__dirname, 'icon', 'favicon1.ico');
    const win = new BrowserWindow({
        width: 540,
        height: 620,
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        autoHideMenuBar: true,
        minimizable: false,
        maximizable: false,
        resizable: false,
        skipTaskbar: true  // 隐藏任务栏图标
    });
    win.loadFile(path.join(__dirname, 'index.html'));

    // 设备 ID 存放在用户目录 .elappid，安装/卸载应用时不变；生成后发送给渲染进程
    const { getOrCreateDeviceId } = require('./models/get_device_id');
    const userPath = app.getPath('home');
    const deviceId = getOrCreateDeviceId(userPath);
    win.webContents.once('did-finish-load', () => {
        if (deviceId) win.webContents.send('susr-config', { appid: deviceId });
    });

    mainWindow = win;
}

app.whenReady().then(() => {
    // 隐藏默认菜单栏（File/Edit 等）
    Menu.setApplicationMenu(null);
    
    // 设置 tokenChannel 从 config.json 读写 token（mac 来自 get_device_id，不存 config）
    try {
        const { configPath } = getConfigPaths();
        tokenChannel.setConfigPath(configPath);
    } catch (e) {
        console.error('设置配置文件路径失败:', e);
    }
    
    // 启动 Crash Reporter（日志目录：userData/logs/<YYYYMMDD_HHMMSS>）
    try {
        const core = require('./main');
        updateCrashReporterUser(core.Card);
    } catch (_) {}
    startCrashReporter();

    createWindow();
    syncApiKeyChannelFromConfig();
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

function syncApiKeyChannelFromConfig() {
    try {
        const { configPath } = getConfigPaths();
        const raw = readJsonSafe(configPath, {});
        const config = { ...CONFIG_DEFAULTS, ...raw };
        config.crackScriptKeyCode = Number(config.crackScriptKeyCode) || CONFIG_DEFAULTS.crackScriptKeyCode;
        config.aiScriptKeyCode = Number(config.aiScriptKeyCode) || CONFIG_DEFAULTS.aiScriptKeyCode;
        apiKeyChannel.setKey(config.apiKey || '');
        scriptControlChannel.setSettings({
            enableCrackScript: config.enableCrackScript !== undefined ? config.enableCrackScript : true,
            enableAIScript: config.enableAIScript !== undefined ? config.enableAIScript : true,
            aiModel: config.aiModel || 'deepseek-v4-flash',
            enableThinking: config.enableThinking !== false,
            reasoningEffort: config.reasoningEffort || 'high',
            crackScriptKeyCode: config.crackScriptKeyCode,
            crackScriptCtrl: !!config.crackScriptCtrl,
            crackScriptAlt: !!config.crackScriptAlt,
            crackScriptShift: !!config.crackScriptShift,
            aiScriptKeyCode: config.aiScriptKeyCode,
            aiScriptCtrl: !!config.aiScriptCtrl,
            aiScriptAlt: !!config.aiScriptAlt,
            aiScriptShift: !!config.aiScriptShift,
            modelSwitchKeyCode: config.modelSwitchKeyCode,
            modelSwitchCtrl: !!config.modelSwitchCtrl,
            modelSwitchAlt: !!config.modelSwitchAlt,
            modelSwitchShift: !!config.modelSwitchShift
        });
    } catch (_) {
        apiKeyChannel.clearKey();
    }
}

let isQuitting = false;

app.on('window-all-closed', async function () {
    if (isQuitting) return;
    isQuitting = true;
    
    tokenChannel.stopServer();
    apiKeyChannel.stopServer();
    scriptControlChannel.stopServer();
    
    // 清理用户在线数据
    try {
        const { clearOnlineData } = require('./models/clear_online_data');
        await clearOnlineData();
    } catch (error) {
        // 清理失败不影响程序关闭
        console.error('清理在线数据失败:', error);
    }
    
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async function (event) {
    if (isQuitting) return;
    isQuitting = true;
    
    // 阻止默认退出行为
    event.preventDefault();
    
    tokenChannel.stopServer();
    apiKeyChannel.stopServer();
    scriptControlChannel.stopServer();
    
    // 清理用户在线数据
    try {
        const { clearOnlineData } = require('./models/clear_online_data');
        await clearOnlineData();
    } catch (error) {
        // 清理失败不影响程序关闭
        console.error('清理在线数据失败:', error);
    }
    
    // 清理完成后真正退出
    app.quit();
});

// IPC: 配置与登录流程
ipcMain.handle('set-config', async (event, partial) => {
    const core = require('./main');
    if (typeof core.setConfig === 'function') {
        core.setConfig(partial);
        if (partial && partial.Card !== undefined) {
            updateCrashReporterUser(partial.Card);
        }
        return { ok: true };
    }
    return { ok: false, error: 'setConfig 不可用' };
});

ipcMain.handle('start-login-flow', async () => {
    const core = require('./main');
    try {
        const res = await core.performLoginFlow();
        return { ok: true, data: res };
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
});

ipcMain.handle('choose-exe', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
        title: '选择可执行文件',
        properties: ['openFile'],
        filters: [
            { name: '可执行文件 (*.exe)', extensions: ['exe'] },
            { name: '所有文件', extensions: ['*'] }
        ]
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { ok: false, canceled: true };
    }
    return { ok: true, path: result.filePaths[0] };
});

ipcMain.handle('open-external-url', async (event, url) => {
    try {
        await shell.openExternal(url);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
});

ipcMain.handle('get-purchase-link', async () => {
    try {
        const { getPurchaseLink } = require('./models/get_purchase_link');
        const res = await getPurchaseLink();
        return { ok: true, data: res };
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
});

ipcMain.handle('get-help-link', async () => {
    try {
        const { getHelpLink } = require('./models/get_help_link');
        const res = await getHelpLink();
        return { ok: true, data: res };
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
});

ipcMain.handle('get-notice', async () => {
    try {
        const { getNotice } = require('./models/get_notice');
        const res = await getNotice();
        return { ok: true, data: res };
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
});

// DeepSeek 余额查询：从 config.json 读取 apiKey，无 key 时不请求
const https = require('https');
ipcMain.handle('get-deepseek-balance', async () => {
    try {
        const { configPath } = getConfigPaths();
        const raw = readJsonSafe(configPath, {});
        const apiKey = (raw && raw.apiKey) ? String(raw.apiKey).trim() : '';
        if (!apiKey) {
            return { ok: true, noKey: true };
        }
        const body = await new Promise((resolve, reject) => {
            const req = https.request(
                'https://api.deepseek.com/user/balance',
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': 'Bearer ' + apiKey
                    }
                },
                (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(data || '{}'));
                        } catch (_) {
                            resolve({ _raw: data });
                        }
                    });
                }
            );
            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('请求超时'));
            });
            req.end();
        });
        return { ok: true, noKey: false, data: body };
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
});

// API Key 有效性检测：调用 DeepSeek models 接口验证
ipcMain.handle('test-api-key', async (event, apiKey) => {
    try {
        const key = (apiKey && typeof apiKey === 'string') ? apiKey.trim() : '';
        if (!key) {
            return { ok: true, valid: false, error: '未提供 API Key' };
        }
        const body = await new Promise((resolve, reject) => {
            const req = https.request(
                'https://api.deepseek.com/models',
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': 'Bearer ' + key
                    }
                },
                (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        try {
                            resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
                        } catch (_) {
                            resolve({ status: res.statusCode, body: { _raw: data } });
                        }
                    });
                }
            );
            req.on('error', reject);
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('请求超时'));
            });
            req.end();
        });
        if (body.status === 200 && body.body && body.body.data && Array.isArray(body.body.data)) {
            const firstModel = body.body.data[0];
            return { ok: true, valid: true, model: firstModel ? firstModel.id : undefined };
        }
        if (body.status === 401 || body.status === 403) {
            return { ok: true, valid: false, error: 'API Key无效或无权限, 请检查API Key是否正确' };
        }
        if (body.body && body.body.error && body.body.error.message) {
            return { ok: true, valid: false, error: body.body.error.message };
        }
        return { ok: true, valid: false, error: 'HTTP ' + body.status };
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
});

// 启动流程：复制 DLL -> 启动 exe -> 隐藏窗口 -> 等待进程退出后清理 DLL 并退出
ipcMain.handle('start-app', async (event, payload) => {
    try {
        const rawExePath = payload && payload.exePath ? String(payload.exePath) : '';
        const exePath = rawExePath.trim().replace(/^"(.*)"$/, '$1');
        if (!exePath || !fs.existsSync(exePath)) {
            return { ok: false, error: '目标可执行文件不存在' };
        }
        let exeStat = null;
        try {
            exeStat = fs.statSync(exePath);
        } catch (_) {}
        if (!exeStat || !exeStat.isFile()) {
            return { ok: false, error: '目标路径不是可执行文件，请选择 .exe 文件' };
        }
        if (path.extname(exePath).toLowerCase() !== '.exe') {
            return { ok: false, error: '仅支持启动 .exe 文件' };
        }

        const targetDir = path.dirname(exePath);
        // 优先从 asar 内读取（打包后），其次兼容开发路径
        const candidateDlls = [
            path.join(__dirname, 'winmm.dll'), // asar 内
            path.resolve(__dirname, '..', 'winmm.dll'),
            path.resolve(__dirname, '..', 'login_app', 'winmm.dll')
        ].filter(Boolean);
        let dllSrc = candidateDlls.find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
        const dllDst = path.join(targetDir, 'winmm.dll');
        if (!dllSrc) {
            return { ok: false, error: '内置 winmm.dll 未找到' };
        }
        
        // 如果 dllSrc 在 asar 内（只读），需要先复制到临时目录
        const os = require('os');
        let tempDllPath = dllSrc;
        if (dllSrc.includes('.asar')) {
            const tempDir = path.join(os.tmpdir(), 'cxexam-dll');
            try { fs.mkdirSync(tempDir, { recursive: true }); } catch (_) {}
            tempDllPath = path.join(tempDir, 'winmm.dll');
            try {
                fs.copyFileSync(dllSrc, tempDllPath);
            } catch (e) {
                return { ok: false, error: '从 asar 提取 winmm.dll 失败: ' + (e && e.message ? e.message : String(e)) };
            }
        }
        dllSrc = tempDllPath;

        // 覆盖复制，尽量处理 Program Files 下的权限/占用问题
        try {
            if (fs.existsSync(dllDst)) {
                try { fs.chmodSync(dllDst, 0o666); } catch (_) {}
                try { fs.unlinkSync(dllDst); } catch (_) {}
            }
            fs.copyFileSync(dllSrc, dllDst);
        } catch (e1) {
            // 尝试使用 PowerShell 复制（-Force），适配某些EPERM场景
            try {
                const ps = spawn('powershell.exe', [
                    '-NoProfile',
                    '-ExecutionPolicy', 'Bypass',
                    '-Command',
                    `Try { Copy-Item -LiteralPath \"${dllSrc}\" -Destination \"${dllDst}\" -Force; Exit 0 } Catch { Exit 1 }`
                ], { windowsHide: true, stdio: 'ignore' });
                await new Promise((resolve) => ps.on('exit', resolve));
                if (!fs.existsSync(dllDst)) {
                    return { ok: false, error: '复制 winmm.dll 失败: ' + (e1 && e1.message ? e1.message : String(e1)) };
                }
            } catch (e2) {
                return { ok: false, error: '复制 winmm.dll 失败: ' + (e1 && e1.message ? e1.message : String(e1)) };
            }
        }

        // 启动目标程序
        let child;
        try {
            child = spawn(exePath, [], { cwd: targetDir, windowsHide: true, detached: false, stdio: 'ignore' });
        } catch (e) {
            return { ok: false, error: '启动目标程序失败: ' + (e && e.message ? e.message : String(e)) };
        }
        const spawnReady = await new Promise((resolve) => {
            let settled = false;
            const done = (result) => {
                if (settled) return;
                settled = true;
                resolve(result);
            };
            child.once('error', (err) => {
                done({ ok: false, error: err && err.message ? err.message : String(err) });
            });
            child.once('spawn', () => done({ ok: true }));
            // 兼容个别环境不触发 spawn 事件的情况，避免卡住
            setTimeout(() => done({ ok: true }), 800);
        });
        if (!spawnReady.ok) {
            return { ok: false, error: '启动目标程序失败: ' + spawnReady.error };
        }

        // 隐藏自身窗口与任务栏图标
        if (mainWindow) {
            try { mainWindow.setSkipTaskbar(true); } catch (_) {}
            try { mainWindow.hide(); } catch (_) {}
        }

        const cleanup = async () => {
            try { if (fs.existsSync(dllDst)) fs.unlinkSync(dllDst); } catch (_) {}
            
            // 清理用户在线数据
            try {
                const { clearOnlineData } = require('./models/clear_online_data');
                await clearOnlineData();
            } catch (error) {
                // 清理失败不影响程序关闭
                console.error('清理在线数据失败:', error);
            }
            
            app.quit();
        };

        child.on('exit', cleanup);
        child.on('close', cleanup);

        return { ok: true };
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
});

// 配置读写：使用 userData 目录
function getConfigPaths() {
    const dir = app.getPath('userData');
    return {
        baseDir: dir,
        configPath: path.join(dir, 'config.json')
    };
}

function readJsonSafe(filePath, fallback) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const txt = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(txt);
    } catch (_) {
        return fallback;
    }
}

function writeJsonSafe(filePath, obj) {
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
        return true;
    } catch (e) {
        return false;
    }
}

const CONFIG_DEFAULTS = {
    Target_address: '',
    Card: '',
    apiKey: '',
    authToken: '',
    enableCrackScript: true,
    enableAIScript: true,
    aiModel: 'deepseek-v4-flash',
    enableThinking: true,
    reasoningEffort: 'high',
    crackScriptKeyCode: 112,
    crackScriptCtrl: false,
    crackScriptAlt: false,
    crackScriptShift: false,
    aiScriptKeyCode: 113,
    aiScriptCtrl: false,
    aiScriptAlt: false,
    aiScriptShift: false,
    modelSwitchKeyCode: 114,
    modelSwitchCtrl: false,
    modelSwitchAlt: false,
    modelSwitchShift: false
};

ipcMain.handle('get-configs', async () => {
    const { configPath } = getConfigPaths();
    const raw = readJsonSafe(configPath, {});
    // 与默认值合并，保证旧 config 或缺字段时也有完整的按键键盘码等
    const config = { ...CONFIG_DEFAULTS, ...raw };
    config.crackScriptKeyCode = Number(config.crackScriptKeyCode) || CONFIG_DEFAULTS.crackScriptKeyCode;
    config.aiScriptKeyCode = Number(config.aiScriptKeyCode) || CONFIG_DEFAULTS.aiScriptKeyCode;
    // mac 仅来自 get_device_id，不从 config.json 读取
    const { getOrCreateDeviceId } = require('./models/get_device_id');
    config.Mac = getOrCreateDeviceId(app.getPath('home')) || '';
    return { ok: true, config, aiConfig: { apiKey: config.apiKey || '' } };
});

ipcMain.handle('set-configs', async (event, payload) => {
    const { configPath } = getConfigPaths();
    const cfg = payload && payload.config ? payload.config : {};
    const ai = payload && payload.aiConfig ? payload.aiConfig : {};
    // 先读取已有配置，避免 saveConfigs（只传地址/卡号/apiKey）时覆盖用户保存的快捷键
    const existing = readJsonSafe(configPath, {});

    // 合并：默认值 + 已有配置 + 本次传入（仅覆盖传入的字段）
    const mergedCfg = {
        ...CONFIG_DEFAULTS,
        ...existing,
        ...(cfg.Target_address !== undefined && { Target_address: String(cfg.Target_address || '') }),
        ...(cfg.Card !== undefined && { Card: String(cfg.Card || '') }),
        ...(ai.apiKey !== undefined && { apiKey: String(ai.apiKey || '') }),
        ...(cfg.enableCrackScript !== undefined && { enableCrackScript: !!cfg.enableCrackScript }),
        ...(cfg.enableAIScript !== undefined && { enableAIScript: !!cfg.enableAIScript }),
        ...(cfg.aiModel !== undefined && { aiModel: String(cfg.aiModel || 'deepseek-v4-flash') }),
        ...(cfg.enableThinking !== undefined && { enableThinking: !!cfg.enableThinking }),
        ...(cfg.reasoningEffort !== undefined && { reasoningEffort: String(cfg.reasoningEffort || 'high') }),
        ...(cfg.crackScriptKeyCode !== undefined && { crackScriptKeyCode: Number(cfg.crackScriptKeyCode) }),
        ...(cfg.crackScriptCtrl !== undefined && { crackScriptCtrl: !!cfg.crackScriptCtrl }),
        ...(cfg.crackScriptAlt !== undefined && { crackScriptAlt: !!cfg.crackScriptAlt }),
        ...(cfg.crackScriptShift !== undefined && { crackScriptShift: !!cfg.crackScriptShift }),
        ...(cfg.aiScriptKeyCode !== undefined && { aiScriptKeyCode: Number(cfg.aiScriptKeyCode) }),
        ...(cfg.aiScriptCtrl !== undefined && { aiScriptCtrl: !!cfg.aiScriptCtrl }),
        ...(cfg.aiScriptAlt !== undefined && { aiScriptAlt: !!cfg.aiScriptAlt }),
        ...(cfg.aiScriptShift !== undefined && { aiScriptShift: !!cfg.aiScriptShift }),
        ...(cfg.modelSwitchKeyCode !== undefined && { modelSwitchKeyCode: Number(cfg.modelSwitchKeyCode) }),
        ...(cfg.modelSwitchCtrl !== undefined && { modelSwitchCtrl: !!cfg.modelSwitchCtrl }),
        ...(cfg.modelSwitchAlt !== undefined && { modelSwitchAlt: !!cfg.modelSwitchAlt }),
        ...(cfg.modelSwitchShift !== undefined && { modelSwitchShift: !!cfg.modelSwitchShift })
    };
    mergedCfg.crackScriptKeyCode = Number(mergedCfg.crackScriptKeyCode) || CONFIG_DEFAULTS.crackScriptKeyCode;
    mergedCfg.aiScriptKeyCode = Number(mergedCfg.aiScriptKeyCode) || CONFIG_DEFAULTS.aiScriptKeyCode;
    delete mergedCfg.Mac; // mac 仅来自 get_device_id，不写入 config.json
    const ok = writeJsonSafe(configPath, mergedCfg);
    if (ok) {
        apiKeyChannel.setKey(mergedCfg.apiKey || '');
        // 更新脚本控制设置到管道服务器
        scriptControlChannel.setSettings({
            enableCrackScript: mergedCfg.enableCrackScript !== undefined ? mergedCfg.enableCrackScript : true,
            enableAIScript: mergedCfg.enableAIScript !== undefined ? mergedCfg.enableAIScript : true,
            aiModel: mergedCfg.aiModel || 'deepseek-v4-flash',
            enableThinking: mergedCfg.enableThinking !== false,
            reasoningEffort: mergedCfg.reasoningEffort || 'high',
            crackScriptKeyCode: mergedCfg.crackScriptKeyCode,
            crackScriptCtrl: !!mergedCfg.crackScriptCtrl,
            crackScriptAlt: !!mergedCfg.crackScriptAlt,
            crackScriptShift: !!mergedCfg.crackScriptShift,
            aiScriptKeyCode: mergedCfg.aiScriptKeyCode,
            aiScriptCtrl: !!mergedCfg.aiScriptCtrl,
            aiScriptAlt: !!mergedCfg.aiScriptAlt,
            aiScriptShift: !!mergedCfg.aiScriptShift,
            modelSwitchKeyCode: mergedCfg.modelSwitchKeyCode,
            modelSwitchCtrl: !!mergedCfg.modelSwitchCtrl,
            modelSwitchAlt: !!mergedCfg.modelSwitchAlt,
            modelSwitchShift: !!mergedCfg.modelSwitchShift
        });
    } else {
        apiKeyChannel.clearKey();
    }
    return { ok };
});

// 自动搜索 CxExam.exe
const os = require('os');

function searchCxExamInDir(dir, maxDepth) {
    if (maxDepth === undefined) maxDepth = 2;
    var results = [];
    try {
        if (!fs.existsSync(dir)) return results;
        var entries = fs.readdirSync(dir, { withFileTypes: true });
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            var fullPath = path.join(dir, entry.name);
            try {
                if (entry.isFile() && entry.name.toLowerCase() === 'cxexam.exe') {
                    results.push(fullPath);
                } else if (entry.isDirectory() && maxDepth > 0 && !entry.name.startsWith('.') && !entry.name.startsWith('$')) {
                    results = results.concat(searchCxExamInDir(fullPath, maxDepth - 1));
                }
            } catch (_) {}
        }
    } catch (_) {}
    return results;
}

ipcMain.handle('find-cxexam', async () => {
    var searchRoots = [];
    var home = os.homedir();
    searchRoots.push(path.join(home, 'Desktop'));
    searchRoots.push(path.join(home, 'Downloads'));
    var progDir = process.env.ProgramFiles;
    if (progDir) searchRoots.push(progDir);
    var progX86 = process.env['ProgramFiles(x86)'];
    if (progX86) searchRoots.push(progX86);
    if (fs.existsSync('D:\\')) searchRoots.push('D:\\');

    for (var i = 0; i < searchRoots.length; i++) {
        var found = searchCxExamInDir(searchRoots[i], 3);
        if (found.length > 0) {
            return { ok: true, path: found[0] };
        }
    }
    return { ok: false };
});


