function $(id) { return document.getElementById(id); }

const targetEl = $('target');
const cardEl = $('card');
const apikeyEl = $('apikey');
const statusEl = $('status');
const iconChooseExe = $('iconChooseExe');
const iconToggleCard = $('iconToggleCard');
const iconToggleApikey = $('iconToggleApikey');
const btnPurchase = $('btnPurchase');
const btnHelp = $('btnHelp');
const btnUpdate = $('btnUpdate');
const updateTooltip = $('updateTooltip');
const btnSettings = $('btnSettings');
const btnLogin = $('btnLogin');
const btnStart = $('btnStart');
const noticeBox = $('noticeBox');
const settingsModal = $('settingsModal');
const btnSettingsSave = $('btnSettingsSave');
const settingsClose = $('settingsClose');
const keyCrackScript = $('keyCrackScript');
const keyAIScript = $('keyAIScript');
let loggedIn = false;
let updateButtonEnabled = false;

function isNonEmpty(v) {
    return v != null && String(v).trim().length > 0;
}

function updateButtons() {
    if (btnLogin) btnLogin.disabled = !isNonEmpty(cardEl.value);
    if (btnStart) btnStart.disabled = !(isNonEmpty(targetEl.value) && isNonEmpty(apikeyEl.value) && loggedIn);
    // 目标路径未填写时，不允许编辑/设置 API Key
    apikeyEl.disabled = !isNonEmpty(targetEl.value);
}

function logStatus(obj) {
    statusEl.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
}

function setNoticeText(text) {
    if (noticeBox) {
        noticeBox.textContent = text;
    }
}

async function loadNotice() {
    if (!noticeBox || !window.api || typeof window.api.getNotice !== 'function') return;
    setNoticeText('公告加载中...');
    try {
        const res = await window.api.getNotice();
        if (res && res.ok && res.data) {
            const data = res.data;
            if (data.success && data.notice) {
                setNoticeText(data.notice);
            } else {
                const code = data.errorCode ? `（${data.errorCode}）` : '';
                const msg = data.errorMessage || data.message || '公告获取失败';
                setNoticeText(`${msg}${code}`);
            }
        } else {
            const err = (res && res.error) ? res.error : '公告获取失败';
            setNoticeText(err);
        }
    } catch (e) {
        setNoticeText(e && e.message ? e.message : '公告获取异常');
    }
}

async function runLoginFlow() {
    try {
        loggedIn = false;
        const partial = {
            Target_address: targetEl.value || '',
            Card: cardEl.value || ''
        };
        const r1 = await window.api.setConfig(partial);
        if (!r1 || !r1.ok) {
            logStatus(r1 && r1.error ? r1.error : '设置配置失败');
            updateButtons();
            return;
        }
        logStatus('开始登录流程...');
        const r2 = await window.api.startLoginFlow();
        if (!r2 || !r2.ok) {
            const err = (r2 && r2.error) ? r2.error : '登录流程调用失败';
            logStatus(`登陆失败：${err}`);
            loggedIn = false;
            updateButtons();
            return;
        }
        const data = r2.data || {};
        if (data.success && data.step === 'done') {
            const et = (data.expireTime && String(data.expireTime).trim().length > 0) ? `（到期时间：${data.expireTime}）` : '';
            logStatus(`登陆成功${et}`);
            loggedIn = true;
        } else {
            const code = data && data.detail && data.detail.errorCode ? `（错误码：${data.detail.errorCode}）` : '';
            const reason = (data && data.message) ? data.message : (data && data.detail && data.detail.errorMessage ? data.detail.errorMessage : '未知错误');
            logStatus(`登陆失败：${reason}${code}`);
            loggedIn = false;
        }
        updateButtons();
    } catch (e) {
        logStatus(e && e.message ? e.message : String(e));
        loggedIn = false;
        updateButtons();
    }
}

function debounce(fn, ms) {
    let t;
    return function() {
        clearTimeout(t);
        t = setTimeout(() => fn(), ms);
    };
}

// 购买按钮：打开购买链接
if (btnPurchase) {
    btnPurchase.addEventListener('click', async () => {
        try {
            const res = await window.api.getPurchaseLink();
            if (!res || !res.ok) {
                logStatus('获取购买链接失败');
                return;
            }
            const data = res.data || {};
            if (!data.success || !data.url) {
                const code = data.errorCode ? `（错误码：${data.errorCode}）` : '';
                const msg = data.errorMessage || '获取购买链接失败';
                logStatus(`${msg}${code}`);
                return;
            }
            const openRes = await window.api.openExternalUrl(data.url);
            if (!openRes || !openRes.ok) {
                logStatus('打开购买链接失败');
            }
        } catch (e) {
            logStatus('获取/打开购买链接异常: ' + (e && e.message ? e.message : String(e)));
        }
    });
}

// 使用说明按钮：打开使用说明链接
if (btnHelp) {
    btnHelp.addEventListener('click', async () => {
        try {
            const res = await window.api.getHelpLink();
            if (!res || !res.ok) {
                logStatus('获取使用说明链接失败');
                return;
            }
            const data = res.data || {};
            if (!data.success || !data.url) {
                const code = data.errorCode ? `（错误码：${data.errorCode}）` : '';
                const msg = data.errorMessage || '获取使用说明链接失败';
                logStatus(`${msg}${code}`);
                return;
            }
            const openRes = await window.api.openExternalUrl(data.url);
            if (!openRes || !openRes.ok) {
                logStatus('打开使用说明链接失败');
            }
        } catch (e) {
            logStatus('获取/打开使用说明链接异常: ' + (e && e.message ? e.message : String(e)));
        }
    });
}

// 更新按钮：打开更新链接（需等待提示框完全显示后才能点击）
if (btnUpdate && updateTooltip) {
    // 鼠标移入：显示提示框，禁用按钮，等待动画完成后启用
    btnUpdate.addEventListener('mouseenter', () => {
        updateButtonEnabled = false;
        updateTooltip.classList.add('show');
        // 等待动画完成（0.5s）后启用按钮
        setTimeout(() => {
            updateButtonEnabled = true;
        }, 500);
    });
    
    // 鼠标移出：隐藏提示框，禁用按钮
    btnUpdate.addEventListener('mouseleave', () => {
        updateButtonEnabled = false;
        updateTooltip.classList.remove('show');
    });
    
    // 点击事件：只有在提示框完全显示后才能点击
    btnUpdate.addEventListener('click', async (e) => {
        if (!updateButtonEnabled) {
            e.preventDefault();
            return;
        }
        try {
            const res = await window.api.openExternalUrl('https://wwfb.lanzouw.com/b00wn52fhg');
            if (!res || !res.ok) {
                logStatus('打开更新链接失败');
            }
        } catch (err) {
            logStatus('打开更新链接异常: ' + (err && err.message ? err.message : String(err)));
        }
    });
}

// 快捷键输入框的键盘事件处理
function setupKeyInput(inputEl, defaultKey) {
    if (!inputEl) return;
    
    let isCapturing = false;
    let pressedModifiers = {
        ctrl: false,
        alt: false,
        shift: false
    };
    
    inputEl.addEventListener('click', () => {
        isCapturing = true;
        pressedModifiers = { ctrl: false, alt: false, shift: false };
        inputEl.value = '按任意键...';
        inputEl.style.backgroundColor = '#fff3cd';
        inputEl.focus(); // 确保输入框获得焦点
    });
    
    inputEl.addEventListener('keydown', (e) => {
        if (!isCapturing) return;
        
        // 检查是否是修饰键
        const isModifierKey = e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || 
                              e.key === 'Meta' || e.key === 'OSLeft' || e.key === 'OSRight';
        
        // 更新修饰键状态
        if (e.key === 'Control' || e.ctrlKey) pressedModifiers.ctrl = true;
        if (e.key === 'Alt' || e.altKey) pressedModifiers.alt = true;
        if (e.key === 'Shift' || e.shiftKey) pressedModifiers.shift = true;
        
        // 如果只是按下修饰键，不结束捕获，只更新显示
        if (isModifierKey) {
            e.preventDefault();
            e.stopPropagation();
            
            // 显示当前按下的修饰键
            const parts = [];
            if (pressedModifiers.ctrl) parts.push('Ctrl');
            if (pressedModifiers.alt) parts.push('Alt');
            if (pressedModifiers.shift) parts.push('Shift');
            if (parts.length > 0) {
                inputEl.value = parts.join('+') + '+...';
            } else {
                inputEl.value = '按任意键...';
            }
            return;
        }
        
        // 按下非修饰键，结束捕获
        e.preventDefault();
        e.stopPropagation();
        
        // 构建快捷键字符串
        const parts = [];
        if (pressedModifiers.ctrl || e.ctrlKey) parts.push('Ctrl');
        if (pressedModifiers.alt || e.altKey) parts.push('Alt');
        if (pressedModifiers.shift || e.shiftKey) parts.push('Shift');
        
        // 获取按键名称
        let keyName = '';
        if (e.key.length === 1 && !isModifierKey) {
            // 普通字符键
            keyName = e.shiftKey ? e.key.toUpperCase() : e.key.toUpperCase();
        } else {
            // 处理特殊键
            const keyMap = {
                'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4', 'F5': 'F5',
                'F6': 'F6', 'F7': 'F7', 'F8': 'F8', 'F9': 'F9', 'F10': 'F10',
                'F11': 'F11', 'F12': 'F12',
                'Escape': 'Esc', 'Enter': 'Enter', 'Space': 'Space',
                'Tab': 'Tab', 'Backspace': 'Backspace', 'Delete': 'Delete',
                'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→',
                'Home': 'Home', 'End': 'End', 'PageUp': 'PageUp', 'PageDown': 'PageDown',
                'Insert': 'Insert', 'Pause': 'Pause', 'ScrollLock': 'ScrollLock',
                'NumLock': 'NumLock', 'CapsLock': 'CapsLock'
            };
            keyName = keyMap[e.key] || e.key;
        }
        
        if (keyName) {
            parts.push(keyName);
            inputEl.value = parts.join('+');
            
            // 保存键码和修饰键状态
            inputEl.dataset.keyCode = e.keyCode.toString();
            inputEl.dataset.ctrl = (pressedModifiers.ctrl || e.ctrlKey) ? '1' : '0';
            inputEl.dataset.alt = (pressedModifiers.alt || e.altKey) ? '1' : '0';
            inputEl.dataset.shift = (pressedModifiers.shift || e.shiftKey) ? '1' : '0';
            
            inputEl.style.backgroundColor = '#fff';
            isCapturing = false;
            pressedModifiers = { ctrl: false, alt: false, shift: false };
        }
    });
    
    inputEl.addEventListener('keyup', (e) => {
        if (!isCapturing) return;
        
        // 更新修饰键状态（释放时）
        if (e.key === 'Control') pressedModifiers.ctrl = false;
        if (e.key === 'Alt') pressedModifiers.alt = false;
        if (e.key === 'Shift') pressedModifiers.shift = false;
    });
    
    inputEl.addEventListener('blur', () => {
        if (isCapturing) {
            inputEl.value = inputEl.dataset.originalValue || defaultKey || '';
            inputEl.style.backgroundColor = '#fff';
            isCapturing = false;
            pressedModifiers = { ctrl: false, alt: false, shift: false };
        }
    });
}

// 设置按钮：显示设置界面
if (btnSettings) {
    btnSettings.addEventListener('click', async () => {
        if (settingsModal) {
            // 加载当前设置
            try {
                const res = await window.api.getConfigs();
                if (res && res.ok && res.config) {
                    const config = res.config;
                    if (keyCrackScript) {
                        keyCrackScript.value = config.crackScriptKey || 'F1';
                        keyCrackScript.dataset.originalValue = config.crackScriptKey || 'F1';
                        keyCrackScript.dataset.keyCode = config.crackScriptKeyCode || '112'; // F1 keyCode
                        keyCrackScript.dataset.ctrl = (config.crackScriptCtrl || false) ? '1' : '0';
                        keyCrackScript.dataset.alt = (config.crackScriptAlt || false) ? '1' : '0';
                        keyCrackScript.dataset.shift = (config.crackScriptShift || false) ? '1' : '0';
                    }
                    if (keyAIScript) {
                        keyAIScript.value = config.aiScriptKey || 'F2';
                        keyAIScript.dataset.originalValue = config.aiScriptKey || 'F2';
                        keyAIScript.dataset.keyCode = config.aiScriptKeyCode || '113'; // F2 keyCode
                        keyAIScript.dataset.ctrl = (config.aiScriptCtrl || false) ? '1' : '0';
                        keyAIScript.dataset.alt = (config.aiScriptAlt || false) ? '1' : '0';
                        keyAIScript.dataset.shift = (config.aiScriptShift || false) ? '1' : '0';
                    }
                }
            } catch (e) {
                // 如果加载失败，使用默认值
                if (keyCrackScript) {
                    keyCrackScript.value = 'F1';
                    keyCrackScript.dataset.originalValue = 'F1';
                    keyCrackScript.dataset.keyCode = '112';
                }
                if (keyAIScript) {
                    keyAIScript.value = 'F2';
                    keyAIScript.dataset.originalValue = 'F2';
                    keyAIScript.dataset.keyCode = '113';
                }
            }
            
            // 设置快捷键输入框
            setupKeyInput(keyCrackScript, 'F1');
            setupKeyInput(keyAIScript, 'F2');
            
            settingsModal.classList.add('show');
        }
    });
}

// 设置界面关闭按钮（右上角 X）
if (settingsClose) {
    settingsClose.addEventListener('click', () => {
        if (settingsModal) {
            settingsModal.classList.remove('show');
        }
    });
}

// 设置界面保存按钮
if (btnSettingsSave) {
    btnSettingsSave.addEventListener('click', async () => {
        try {
            // 获取快捷键设置
            const crackKeyCode = keyCrackScript ? parseInt(keyCrackScript.dataset.keyCode || '112') : 112;
            const crackCtrl = keyCrackScript ? (keyCrackScript.dataset.ctrl === '1') : false;
            const crackAlt = keyCrackScript ? (keyCrackScript.dataset.alt === '1') : false;
            const crackShift = keyCrackScript ? (keyCrackScript.dataset.shift === '1') : false;
            const crackKey = keyCrackScript ? (keyCrackScript.value || 'F1') : 'F1';
            
            const aiKeyCode = keyAIScript ? parseInt(keyAIScript.dataset.keyCode || '113') : 113;
            const aiCtrl = keyAIScript ? (keyAIScript.dataset.ctrl === '1') : false;
            const aiAlt = keyAIScript ? (keyAIScript.dataset.alt === '1') : false;
            const aiShift = keyAIScript ? (keyAIScript.dataset.shift === '1') : false;
            const aiKey = keyAIScript ? (keyAIScript.value || 'F2') : 'F2';
            
            // 保存到配置文件
            const res = await window.api.setConfigs({
                config: {
                    Target_address: targetEl.value || '',
                    Card: cardEl.value || '',
                    apiKey: apikeyEl.value || '',
                    crackScriptKey: crackKey,
                    crackScriptKeyCode: crackKeyCode,
                    crackScriptCtrl: crackCtrl,
                    crackScriptAlt: crackAlt,
                    crackScriptShift: crackShift,
                    aiScriptKey: aiKey,
                    aiScriptKeyCode: aiKeyCode,
                    aiScriptCtrl: aiCtrl,
                    aiScriptAlt: aiAlt,
                    aiScriptShift: aiShift
                },
                aiConfig: { apiKey: apikeyEl.value || '' }
            });
            
            if (settingsModal) {
                settingsModal.classList.remove('show');
            }
            
            if (res && res.ok) {
                logStatus('设置已保存');
            } else {
                logStatus('设置保存失败');
            }
        } catch (e) {
            logStatus('设置保存异常: ' + (e && e.message ? e.message : String(e)));
        }
    });
}

// 点击模态框背景关闭
if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('show');
        }
    });
}

// 手动触发登录
if (btnLogin) {
    btnLogin.addEventListener('click', () => {
        runLoginFlow();
    });
}

// 启动按钮：复制DLL并启动目标EXE，随后隐藏UI
if (btnStart) {
    btnStart.addEventListener('click', async () => {
        try {
            const exePath = targetEl.value || '';
            if (!isNonEmpty(exePath)) {
                logStatus('请先选择目标 .exe');
                return;
            }
            const res = await window.api.startApp(exePath);
            if (!res || !res.ok) {
                logStatus(res && res.error ? res.error : '启动失败');
                return;
            }
            // 成功启动后，界面将由主进程隐藏
        } catch (e) {
            logStatus(e && e.message ? e.message : String(e));
        }
    });
}

// 注意：选择EXE的对话框监听仅保留一次（见下方保存配置的监听），避免重复弹窗

function bindToggle(inputEl, btnEl) {
    btnEl.addEventListener('click', () => {
        if (inputEl.type === 'password') {
            inputEl.type = 'text';
            btnEl.textContent = '🧐';
        } else {
            inputEl.type = 'password';
            btnEl.textContent = '😊';
        }
    });
}

bindToggle(cardEl, iconToggleCard);
bindToggle(apikeyEl, iconToggleApikey);

// 输入变化时更新按钮状态
['input', 'change'].forEach(evt => {
    targetEl.addEventListener(evt, updateButtons);
    cardEl.addEventListener(evt, updateButtons);
    apikeyEl.addEventListener(evt, updateButtons);
});

async function loadConfigsAndFill() {
    try {
        const res = await window.api.getConfigs();
        if (res && res.ok) {
            if (res.config) {
                if (!isNonEmpty(targetEl.value)) targetEl.value = res.config.Target_address || '';
                if (!isNonEmpty(cardEl.value)) cardEl.value = res.config.Card || '';
                // apiKey 现在也在 config 中
                if (!isNonEmpty(apikeyEl.value)) apikeyEl.value = res.config.apiKey || '';
            }
            // 兼容旧版本：如果 aiConfig 存在，也尝试读取
            if (res.aiConfig && !isNonEmpty(apikeyEl.value)) {
                apikeyEl.value = res.aiConfig.apiKey || '';
            }
        }
    } catch (_) {}
    updateButtons();
}

async function saveConfigs() {
    try {
        const payload = {
            config: { Target_address: targetEl.value || '', Card: cardEl.value || '' },
            aiConfig: { apiKey: apikeyEl.value || '' }
        };
        const res = await window.api.setConfigs(payload);
        if (res && res.error) {
            // 静默处理错误
        }
    } catch (_) {}
}

// 在关键时机保存：选择exe、登录成功后、输入失焦
iconChooseExe.addEventListener('click', async () => {
    const res = await window.api.chooseExe();
    if (res && res.ok && res.path) {
        targetEl.value = res.path;
        updateButtons();
        saveConfigs();
    }
});

['blur', 'change'].forEach(evt => {
    targetEl.addEventListener(evt, saveConfigs);
    cardEl.addEventListener(evt, saveConfigs);
    apikeyEl.addEventListener(evt, saveConfigs);
});

// 初始：加载配置填充
loadConfigsAndFill();
loadNotice();


