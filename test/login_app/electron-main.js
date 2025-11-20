const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow = null;

function createWindow() {
    const win = new BrowserWindow({
        width: 520,
        height: 570,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        autoHideMenuBar: true,
        minimizable: false,
        maximizable: false,
        resizable: false
    });
    win.loadFile(path.join(__dirname, 'index.html'));
    mainWindow = win;
}

app.whenReady().then(() => {
    // 隐藏默认菜单栏（File/Edit 等）
    Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// IPC: 配置与登录流程
ipcMain.handle('set-config', async (event, partial) => {
    const core = require('./main');
    if (typeof core.setConfig === 'function') {
        core.setConfig(partial);
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

ipcMain.handle('get-notice', async () => {
    try {
        const { getNotice } = require('./models/get_notice');
        const res = await getNotice();
        return { ok: true, data: res };
    } catch (e) {
        return { ok: false, error: e && e.message ? e.message : String(e) };
    }
});

// 启动流程：复制 DLL -> 启动 exe -> 隐藏窗口 -> 等待进程退出后清理 DLL 并退出
ipcMain.handle('start-app', async (event, payload) => {
    try {
        const exePath = payload && payload.exePath ? String(payload.exePath) : '';
        if (!exePath || !fs.existsSync(exePath)) {
            return { ok: false, error: '目标可执行文件不存在' };
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

        // 隐藏自身窗口与任务栏图标
        if (mainWindow) {
            try { mainWindow.setSkipTaskbar(true); } catch (_) {}
            try { mainWindow.hide(); } catch (_) {}
        }

        const cleanup = () => {
            try { if (fs.existsSync(dllDst)) fs.unlinkSync(dllDst); } catch (_) {}
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

function getAiConfigPathByTarget(targetAddress) {
    try {
        if (typeof targetAddress === 'string' && targetAddress.trim().length > 0) {
            const exeDir = path.dirname(targetAddress);
            return path.join(exeDir, 'ai_config.json');
        }
    } catch (_) {}
    // 回退：如无目标路径，仍写入 userData（极少数初始化场景）
    return path.join(app.getPath('userData'), 'ai_config.json');
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

ipcMain.handle('get-configs', async () => {
    const { configPath } = getConfigPaths();
    const config = readJsonSafe(configPath, { Target_address: '', Card: '' });
    const aiPath = getAiConfigPathByTarget(config.Target_address || '');
    const aiConfig = readJsonSafe(aiPath, { apiKey: '' });
    return { ok: true, config, aiConfig };
});

ipcMain.handle('set-configs', async (event, payload) => {
    const { configPath } = getConfigPaths();
    const cfg = payload && payload.config ? payload.config : {};
    const ai = payload && payload.aiConfig ? payload.aiConfig : {};

    // 先保存主配置
    const mergedCfg = {
        Target_address: cfg.Target_address || '',
        Card: cfg.Card || ''
    };
    const ok1 = writeJsonSafe(configPath, mergedCfg);

    // 依据（最新）Target_address 选择 ai_config.json 路径
    if (!mergedCfg.Target_address) {
        // 未填写目标路径时，不允许设置/保存 apiKey
        return { ok: ok1, error: '未填写目标路径，无法设置 API Key' };
    }
    const aiPath = getAiConfigPathByTarget(mergedCfg.Target_address);
    const ok2 = writeJsonSafe(aiPath, { apiKey: ai.apiKey || '' });
    return { ok: ok1 && ok2 };
});


