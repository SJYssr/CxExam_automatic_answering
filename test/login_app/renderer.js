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
const btnSettings = $('btnSettings');
const btnLogin = $('btnLogin');
const btnStart = $('btnStart');
const noticeBox = $('noticeBox');
const settingsModal = $('settingsModal');
const btnSettingsSave = $('btnSettingsSave');
const settingsClose = $('settingsClose');
const keyCrackScript = $('keyCrackScript');
const keyAIScript = $('keyAIScript');
const aiModelSelect = $('aiModelSelect');
const keyModelSwitch = $('keyModelSwitch');
const toggleThinking = $('toggleThinking');
const reasoningEffortSelect = $('reasoningEffortSelect');
const reasoningEffortItem = $('reasoningEffortItem');
const balanceWrap = $('balanceWrap');
const balanceTotal = $('balanceTotal');
const balanceCurrency = $('balanceCurrency');
const balanceRefresh = $('balanceRefresh');
const btnTestApi = $('btnTestApi');
const btnSettingsReset = $('btnSettingsReset');
const confirmDialog = $('confirmDialog');
const confirmDialogMsg = $('confirmDialogMsg');
const confirmDialogCancel = $('confirmDialogCancel');
const confirmDialogOk = $('confirmDialogOk');
let loggedIn = false;
let balanceTimer = null;

// ====== 通用：按钮悬停提示 ======
function setupBtnTip(wrapperEl) {
    if (!wrapperEl) return;
    const tip = wrapperEl.querySelector('.btn-tip');
    if (!tip) return;
    wrapperEl.addEventListener('mouseenter', function() {
        tip.classList.add('show');
    });
    wrapperEl.addEventListener('mouseleave', function() {
        tip.classList.remove('show');
    });
}

function setupAllBtnTips() {
    document.querySelectorAll('.tip-wrapper').forEach(function(el) { setupBtnTip(el); });
}

// ====== 通用：设置项悬停提示 ======
function setupSettingTip(wrapEl) {
    if (!wrapEl) return;
    const tip = wrapEl.querySelector('.setting-tip');
    if (!tip) return;
    wrapEl.addEventListener('mouseenter', function() {
        tip.classList.add('show');
    });
    wrapEl.addEventListener('mouseleave', function() {
        tip.classList.remove('show');
    });
}

function setupAllSettingTips() {
    document.querySelectorAll('.settings-tip-wrap').forEach(function(el) { setupSettingTip(el); });
}

// ====== 自定义确认对话框 ======
let confirmCallback = null;

function showConfirmDialog(message, onOk) {
    if (!confirmDialog || !confirmDialogMsg) return;
    confirmDialogMsg.textContent = message;
    confirmCallback = onOk;
    confirmDialog.classList.add('show');
}

function hideConfirmDialog() {
    if (confirmDialog) confirmDialog.classList.remove('show');
    confirmCallback = null;
}

if (confirmDialogCancel) {
    confirmDialogCancel.addEventListener('click', hideConfirmDialog);
}
if (confirmDialogOk) {
    confirmDialogOk.addEventListener('click', function() {
        var cb = confirmCallback;
        hideConfirmDialog();
        if (typeof cb === 'function') {
            cb();
        }
    });
}
// 点击背景关闭
if (confirmDialog) {
    confirmDialog.addEventListener('click', function(e) {
        if (e.target === confirmDialog) hideConfirmDialog();
    });
}

function isNonEmpty(v) {
    return v != null && String(v).trim().length > 0;
}

function updateButtons() {
    if (btnLogin) btnLogin.disabled = !isNonEmpty(cardEl.value);
    if (btnStart) btnStart.disabled = !(isNonEmpty(targetEl.value) && isNonEmpty(apikeyEl.value) && loggedIn);
    apikeyEl.disabled = !isNonEmpty(targetEl.value);
}

function logStatus(obj) {
    statusEl.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
}

// 公告：支持将 URL 转为可点击链接
function setNoticeText(text) {
    if (noticeBox) {
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
        const linked = escaped.replace(
            /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g,
            '<a href="$1" style="color:#4F46E5;text-decoration:underline;" target="_blank" rel="noopener">$1</a>'
        );
        noticeBox.innerHTML = linked;
    }
}

// DeepSeek 余额
function parseBalance(res) {
    if (!res || !res.ok) return { error: res && res.error ? res.error : '获取失败' };
    if (res.noKey) return null;
    const data = res.data;
    if (!data || !Array.isArray(data.balance_infos) || data.balance_infos.length === 0) {
        return { error: data && data._raw ? '解析异常' : '暂无余额信息' };
    }
    const info = data.balance_infos[0];
    const total_balance = (info.total_balance != null && info.total_balance !== '') ? String(info.total_balance) : '--';
    const currency = (info.currency != null && info.currency !== '') ? String(info.currency) : '';
    return { totalBalance: total_balance, currency };
}

async function refreshBalance() {
    if (!balanceWrap || !balanceTotal || !window.api || typeof window.api.getDeepseekBalance !== 'function') return;
    try {
        const res = await window.api.getDeepseekBalance();
        if (res && res.ok && res.noKey) {
            if (balanceWrap) balanceWrap.style.display = 'none';
            if (balanceTimer) { clearInterval(balanceTimer); balanceTimer = null; }
            return;
        }
        const parsed = parseBalance(res);
        if (parsed === null) return;
        if (parsed.error) {
            balanceTotal.textContent = parsed.error;
            if (balanceCurrency) balanceCurrency.textContent = '';
        } else {
            balanceTotal.textContent = parsed.totalBalance;
            if (balanceCurrency) balanceCurrency.textContent = parsed.currency;
        }
        if (balanceWrap) balanceWrap.style.display = '';
    } catch (_) {
        if (balanceTotal) balanceTotal.textContent = '获取异常';
        if (balanceCurrency) balanceCurrency.textContent = '';
        if (balanceWrap) balanceWrap.style.display = '';
    }
}

function startBalancePolling() {
    if (balanceTimer) return;
    balanceTimer = setInterval(refreshBalance, 60000);
}

async function updateBalanceVisibility() {
    if (!balanceWrap || !window.api || typeof window.api.getConfigs !== 'function') return;
    try {
        const res = await window.api.getConfigs();
        const apiKey = (res && res.config && res.config.apiKey) ? String(res.config.apiKey).trim() : '';
        if (!apiKey) {
            if (balanceWrap) balanceWrap.style.display = 'none';
            if (balanceTimer) { clearInterval(balanceTimer); balanceTimer = null; }
            return;
        }
        await refreshBalance();
        startBalancePolling();
    } catch (_) {
        if (balanceWrap) balanceWrap.style.display = 'none';
    }
}

// 余额手动刷新
if (balanceRefresh) {
    balanceRefresh.addEventListener('click', async function() {
        if (balanceRefresh.classList.contains('spinning')) return;
        balanceRefresh.classList.add('spinning');
        try {
            await refreshBalance();
        } finally {
            setTimeout(function() { balanceRefresh.classList.remove('spinning'); }, 300);
        }
    });
}

// ====== API Key 检测 ======
if (btnTestApi) {
    btnTestApi.addEventListener('click', async function() {
        const key = (apikeyEl.value || '').trim();
        if (!key) { logStatus('请先填写 API Key'); return; }
        btnTestApi.disabled = true;
        btnTestApi.textContent = '检测中...';
        logStatus('正在检测 API Key...');
        try {
            const res = await window.api.testApiKey(key);
            if (!res || !res.ok) {
                const err = (res && res.error) ? res.error : '检测失败';
                logStatus('API Key 检测失败：' + err);
            } else if (res.valid) {
                logStatus('API Key 有效' + (res.model ? '，模型：' + res.model : ''));
            } else {
                logStatus('API Key 无效：' + (res.error || '未知原因'));
            }
        } catch (e) {
            logStatus('API Key 检测异常: ' + (e && e.message ? e.message : String(e)));
        } finally {
            btnTestApi.disabled = false;
            btnTestApi.textContent = '检测';
        }
    });
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
                const code = data.errorCode ? '（' + data.errorCode + '）' : '';
                const msg = data.errorMessage || data.message || '公告获取失败';
                setNoticeText(msg + code);
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
            logStatus('登陆失败：' + err);
            loggedIn = false;
            updateButtons();
            return;
        }
        const data = r2.data || {};
        if (data.success && data.step === 'done') {
            const et = (data.expireTime && String(data.expireTime).trim().length > 0) ? '（到期时间：' + data.expireTime + '）' : '';
            logStatus('登陆成功' + et);
            loggedIn = true;
        } else {
            const code = data && data.detail && data.detail.errorCode ? '（错误码：' + data.detail.errorCode + '）' : '';
            const reason = (data && data.message) ? data.message : (data && data.detail && data.detail.errorMessage ? data.detail.errorMessage : '未知错误');
            logStatus('登陆失败：' + reason + code);
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
        t = setTimeout(function() { fn(); }, ms);
    };
}

// ====== 按钮事件 ======

// 购买按钮
if (btnPurchase) {
    btnPurchase.addEventListener('click', async function() {
        try {
            const res = await window.api.getPurchaseLink();
            if (!res || !res.ok) { logStatus('获取购买链接失败'); return; }
            const data = res.data || {};
            if (!data.success || !data.url) {
                const code = data.errorCode ? '（错误码：' + data.errorCode + '）' : '';
                const msg = data.errorMessage || '获取购买链接失败';
                logStatus(msg + code);
                return;
            }
            const openRes = await window.api.openExternalUrl(data.url);
            if (!openRes || !openRes.ok) { logStatus('打开购买链接失败'); }
        } catch (e) {
            logStatus('获取/打开购买链接异常: ' + (e && e.message ? e.message : String(e)));
        }
    });
}

// 使用说明按钮
if (btnHelp) {
    btnHelp.addEventListener('click', async function() {
        try {
            const res = await window.api.getHelpLink();
            if (!res || !res.ok) { logStatus('获取使用说明链接失败'); return; }
            const data = res.data || {};
            if (!data.success || !data.url) {
                const code = data.errorCode ? '（错误码：' + data.errorCode + '）' : '';
                const msg = data.errorMessage || '获取使用说明链接失败';
                logStatus(msg + code);
                return;
            }
            const openRes = await window.api.openExternalUrl(data.url);
            if (!openRes || !openRes.ok) { logStatus('打开使用说明链接失败'); }
        } catch (e) {
            logStatus('获取/打开使用说明链接异常: ' + (e && e.message ? e.message : String(e)));
        }
    });
}

// 更新按钮：悬停提示显示后才允许点击
let updateReady = false;
if (btnUpdate) {
    const updateWrapper = btnUpdate.closest('.tip-wrapper');
    if (updateWrapper) {
        updateWrapper.addEventListener('mouseenter', function() {
            setTimeout(function() { updateReady = true; }, 500);
        });
        updateWrapper.addEventListener('mouseleave', function() {
            updateReady = false;
        });
    }
    btnUpdate.addEventListener('click', async function(e) {
        if (!updateReady) { e.preventDefault(); return; }
        try {
            const res = await window.api.openExternalUrl('https://wwfb.lanzouw.com/b00wn52fhg');
            if (!res || !res.ok) { logStatus('打开更新链接失败'); }
        } catch (err) {
            logStatus('打开更新链接异常: ' + (err && err.message ? err.message : String(err)));
        }
    });
}

// 登录按钮
if (btnLogin) {
    btnLogin.addEventListener('click', function() { runLoginFlow(); });
}

// 启动按钮
if (btnStart) {
    btnStart.addEventListener('click', async function() {
        try {
            const exePath = targetEl.value || '';
            if (!isNonEmpty(exePath)) { logStatus('请先选择目标 .exe'); return; }
            const res = await window.api.startApp(exePath);
            if (!res || !res.ok) { logStatus(res && res.error ? res.error : '启动失败'); return; }
        } catch (e) {
            logStatus(e && e.message ? e.message : String(e));
        }
    });
}

// ====== 键盘码映射 ======
const keyCodeToName = {
    8: 'Backspace', 9: 'Tab', 13: 'Enter', 16: 'Shift', 17: 'Control', 18: 'Alt', 19: 'Pause',
    20: 'CapsLock', 27: 'Esc', 32: 'Space', 33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home',
    37: '←', 38: '↑', 39: '→', 40: '↓', 45: 'Insert', 46: 'Delete',
    48: '0', 49: '1', 50: '2', 51: '3', 52: '4', 53: '5', 54: '6', 55: '7', 56: '8', 57: '9',
    65: 'A', 66: 'B', 67: 'C', 68: 'D', 69: 'E', 70: 'F', 71: 'G', 72: 'H', 73: 'I', 74: 'J',
    75: 'K', 76: 'L', 77: 'M', 78: 'N', 79: 'O', 80: 'P', 81: 'Q', 82: 'R', 83: 'S', 84: 'T',
    85: 'U', 86: 'V', 87: 'W', 88: 'X', 89: 'Y', 90: 'Z',
    96: 'Num0', 97: 'Num1', 98: 'Num2', 99: 'Num3', 100: 'Num4', 101: 'Num5', 102: 'Num6',
    103: 'Num7', 104: 'Num8', 105: 'Num9', 106: 'Num*', 107: 'Num+', 109: 'Num-', 110: 'Num.', 111: 'Num/',
    112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6', 118: 'F7', 119: 'F8',
    120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12',
    144: 'NumLock', 145: 'ScrollLock',
    186: ';', 187: '=', 188: ',', 189: '-', 190: '.', 191: '/', 192: '`',
    219: '[', 220: '\\', 221: ']', 222: "'"
};

function formatShortcutFromKeyCode(keyCode, ctrl, alt, shift) {
    const parts = [];
    if (ctrl) parts.push('Ctrl');
    if (alt) parts.push('Alt');
    if (shift) parts.push('Shift');
    const name = keyCodeToName[keyCode] || ('Key' + keyCode);
    parts.push(name);
    return parts.join('+');
}

function setupKeyInput(inputEl, defaultKey) {
    if (!inputEl) return;

    let isCapturing = false;
    let pressedModifiers = { ctrl: false, alt: false, shift: false };

    inputEl.addEventListener('click', function() {
        isCapturing = true;
        pressedModifiers = { ctrl: false, alt: false, shift: false };
        inputEl.value = '按任意键...';
        inputEl.style.backgroundColor = '#fff3cd';
        inputEl.focus();
    });

    inputEl.addEventListener('keydown', function(e) {
        if (!isCapturing) return;

        const isModifierKey = e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' ||
                              e.key === 'Meta' || e.key === 'OSLeft' || e.key === 'OSRight';

        if (e.key === 'Control' || e.ctrlKey) pressedModifiers.ctrl = true;
        if (e.key === 'Alt' || e.altKey) pressedModifiers.alt = true;
        if (e.key === 'Shift' || e.shiftKey) pressedModifiers.shift = true;

        if (isModifierKey) {
            e.preventDefault();
            e.stopPropagation();
            const parts = [];
            if (pressedModifiers.ctrl) parts.push('Ctrl');
            if (pressedModifiers.alt) parts.push('Alt');
            if (pressedModifiers.shift) parts.push('Shift');
            inputEl.value = parts.length > 0 ? parts.join('+') + '+...' : '按任意键...';
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const parts = [];
        if (pressedModifiers.ctrl || e.ctrlKey) parts.push('Ctrl');
        if (pressedModifiers.alt || e.altKey) parts.push('Alt');
        if (pressedModifiers.shift || e.shiftKey) parts.push('Shift');

        let keyName = '';
        if (keyCodeToName[e.keyCode]) {
            keyName = keyCodeToName[e.keyCode];
        } else if (e.key.length === 1 && !isModifierKey) {
            keyName = e.key.toUpperCase();
        } else {
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
            inputEl.dataset.keyCode = e.keyCode.toString();
            inputEl.dataset.ctrl = (pressedModifiers.ctrl || e.ctrlKey) ? '1' : '0';
            inputEl.dataset.alt = (pressedModifiers.alt || e.altKey) ? '1' : '0';
            inputEl.dataset.shift = (pressedModifiers.shift || e.shiftKey) ? '1' : '0';
            inputEl.style.backgroundColor = '#fff';
            isCapturing = false;
            pressedModifiers = { ctrl: false, alt: false, shift: false };
            markSettingsDirty();
        }
    });

    inputEl.addEventListener('keyup', function(e) {
        if (!isCapturing) return;
        if (e.key === 'Control') pressedModifiers.ctrl = false;
        if (e.key === 'Alt') pressedModifiers.alt = false;
        if (e.key === 'Shift') pressedModifiers.shift = false;
    });

    inputEl.addEventListener('blur', function() {
        if (isCapturing) {
            inputEl.value = inputEl.dataset.originalValue || defaultKey || '';
            inputEl.style.backgroundColor = '#fff';
            isCapturing = false;
            pressedModifiers = { ctrl: false, alt: false, shift: false };
        }
    });
}

// ====== 设置面板 ======
let settingsDirty = false;
let settingsLoading = false;

function markSettingsDirty() {
    if (!settingsLoading) { settingsDirty = true; }
}

function clearSettingsDirty() {
    settingsDirty = false;
}

// 打开设置（首次初始化事件监听，每次打开时刷新字段）
let settingsInitialized = false;

function initSettingsOnce() {
    if (settingsInitialized) return;
    settingsInitialized = true;
    setupKeyInput(keyCrackScript, 'F1');
    setupKeyInput(keyAIScript, 'F2');
    setupKeyInput(keyModelSwitch, 'F3');
    setupAllSettingTips();
    if (toggleThinking && reasoningEffortSelect) {
        toggleThinking.onchange = function() {
            reasoningEffortSelect.disabled = !toggleThinking.checked;
            markSettingsDirty();
        };
    }
    if (aiModelSelect) aiModelSelect.addEventListener('change', markSettingsDirty);
    if (toggleThinking) toggleThinking.addEventListener('change', markSettingsDirty);
    if (reasoningEffortSelect) reasoningEffortSelect.addEventListener('change', markSettingsDirty);
}

if (btnSettings) {
    btnSettings.addEventListener('click', async function() {
        clearSettingsDirty();
        settingsLoading = true;
        initSettingsOnce();
        await reloadSettingsFields();
        settingsLoading = false;
        settingsModal.classList.add('show');
    });
}

// 从 config 重新加载设置字段（恢复为已保存状态）
async function reloadSettingsFields() {
    try {
        const res = await window.api.getConfigs();
        if (res && res.ok && res.config) {
            const config = res.config;
            if (keyCrackScript) {
                const kc = config.crackScriptKeyCode !== undefined ? config.crackScriptKeyCode : 112;
                const c = !!(config.crackScriptCtrl || false);
                const a = !!(config.crackScriptAlt || false);
                const s = !!(config.crackScriptShift || false);
                keyCrackScript.value = formatShortcutFromKeyCode(kc, c, a, s);
                keyCrackScript.dataset.originalValue = keyCrackScript.value;
                keyCrackScript.dataset.keyCode = String(kc);
                keyCrackScript.dataset.ctrl = c ? '1' : '0';
                keyCrackScript.dataset.alt = a ? '1' : '0';
                keyCrackScript.dataset.shift = s ? '1' : '0';
            }
            if (keyAIScript) {
                const kc = config.aiScriptKeyCode !== undefined ? config.aiScriptKeyCode : 113;
                const c = !!(config.aiScriptCtrl || false);
                const a = !!(config.aiScriptAlt || false);
                const s = !!(config.aiScriptShift || false);
                keyAIScript.value = formatShortcutFromKeyCode(kc, c, a, s);
                keyAIScript.dataset.originalValue = keyAIScript.value;
                keyAIScript.dataset.keyCode = String(kc);
                keyAIScript.dataset.ctrl = c ? '1' : '0';
                keyAIScript.dataset.alt = a ? '1' : '0';
                keyAIScript.dataset.shift = s ? '1' : '0';
            }
            if (keyModelSwitch) {
                const kc = config.modelSwitchKeyCode !== undefined ? config.modelSwitchKeyCode : 114;
                const c = !!(config.modelSwitchCtrl || false);
                const a = !!(config.modelSwitchAlt || false);
                const s = !!(config.modelSwitchShift || false);
                keyModelSwitch.value = formatShortcutFromKeyCode(kc, c, a, s);
                keyModelSwitch.dataset.originalValue = keyModelSwitch.value;
                keyModelSwitch.dataset.keyCode = String(kc);
                keyModelSwitch.dataset.ctrl = c ? '1' : '0';
                keyModelSwitch.dataset.alt = a ? '1' : '0';
                keyModelSwitch.dataset.shift = s ? '1' : '0';
            }
            if (aiModelSelect) aiModelSelect.value = config.aiModel || 'deepseek-v4-flash';
            if (toggleThinking) {
                toggleThinking.checked = config.enableThinking !== false;
                if (reasoningEffortSelect) reasoningEffortSelect.disabled = !toggleThinking.checked;
            }
            if (reasoningEffortSelect) reasoningEffortSelect.value = config.reasoningEffort || 'high';
        }
    } catch (_) {}
}

// 关闭设置（× 按钮）
function closeSettings() {
    if (settingsDirty) {
        showConfirmDialog('设置有未保存的更改，确定放弃吗？', function() {
            reloadSettingsFields().then(function() {
                clearSettingsDirty();
                settingsModal.classList.remove('show');
            });
        });
    } else {
        clearSettingsDirty();
        settingsModal.classList.remove('show');
    }
}

if (settingsClose) {
    settingsClose.addEventListener('click', closeSettings);
}

// 点击模态框背景关闭
if (settingsModal) {
    settingsModal.addEventListener('click', function(e) {
        if (e.target === settingsModal) closeSettings();
    });
}

// 恢复默认
if (btnSettingsReset) {
    btnSettingsReset.addEventListener('click', function() {
        if (keyCrackScript) {
            keyCrackScript.value = 'F1';
            keyCrackScript.dataset.keyCode = '112';
            keyCrackScript.dataset.ctrl = '0';
            keyCrackScript.dataset.alt = '0';
            keyCrackScript.dataset.shift = '0';
        }
        if (keyAIScript) {
            keyAIScript.value = 'F2';
            keyAIScript.dataset.keyCode = '113';
            keyAIScript.dataset.ctrl = '0';
            keyAIScript.dataset.alt = '0';
            keyAIScript.dataset.shift = '0';
        }
        if (keyModelSwitch) {
            keyModelSwitch.value = 'F3';
            keyModelSwitch.dataset.keyCode = '114';
            keyModelSwitch.dataset.ctrl = '0';
            keyModelSwitch.dataset.alt = '0';
            keyModelSwitch.dataset.shift = '0';
        }
        if (aiModelSelect) aiModelSelect.value = 'deepseek-v4-flash';
        if (toggleThinking) toggleThinking.checked = true;
        if (reasoningEffortSelect) {
            reasoningEffortSelect.value = 'high';
            reasoningEffortSelect.disabled = false;
        }
        saveSettings();
    });
}

// 保存设置（供保存按钮和恢复默认共用）
async function saveSettings() {
    const crackKeyCode = keyCrackScript ? parseInt(keyCrackScript.dataset.keyCode || '112') : 112;
    const crackCtrl = keyCrackScript ? (keyCrackScript.dataset.ctrl === '1') : false;
    const crackAlt = keyCrackScript ? (keyCrackScript.dataset.alt === '1') : false;
    const crackShift = keyCrackScript ? (keyCrackScript.dataset.shift === '1') : false;

    const aiKeyCode = keyAIScript ? parseInt(keyAIScript.dataset.keyCode || '113') : 113;
    const aiCtrl = keyAIScript ? (keyAIScript.dataset.ctrl === '1') : false;
    const aiAlt = keyAIScript ? (keyAIScript.dataset.alt === '1') : false;
    const aiShift = keyAIScript ? (keyAIScript.dataset.shift === '1') : false;

    const modelSwitchKeyCode = keyModelSwitch ? parseInt(keyModelSwitch.dataset.keyCode || '114') : 114;
    const modelSwitchCtrl = keyModelSwitch ? (keyModelSwitch.dataset.ctrl === '1') : false;
    const modelSwitchAlt = keyModelSwitch ? (keyModelSwitch.dataset.alt === '1') : false;
    const modelSwitchShift = keyModelSwitch ? (keyModelSwitch.dataset.shift === '1') : false;

    const res = await window.api.setConfigs({
        config: {
            Target_address: targetEl.value || '',
            Card: cardEl.value || '',
            apiKey: apikeyEl.value || '',
            aiModel: aiModelSelect ? aiModelSelect.value : 'deepseek-v4-flash',
            enableThinking: toggleThinking ? toggleThinking.checked : true,
            reasoningEffort: reasoningEffortSelect ? reasoningEffortSelect.value : 'high',
            crackScriptKeyCode: crackKeyCode,
            crackScriptCtrl: crackCtrl,
            crackScriptAlt: crackAlt,
            crackScriptShift: crackShift,
            aiScriptKeyCode: aiKeyCode,
            aiScriptCtrl: aiCtrl,
            aiScriptAlt: aiAlt,
            aiScriptShift: aiShift,
            modelSwitchKeyCode: modelSwitchKeyCode,
            modelSwitchCtrl: modelSwitchCtrl,
            modelSwitchAlt: modelSwitchAlt,
            modelSwitchShift: modelSwitchShift
        },
        aiConfig: { apiKey: apikeyEl.value || '' }
    });

    if (res && res.ok) {
        logStatus('设置已保存');
        clearSettingsDirty();
        updateBalanceVisibility();
        return true;
    } else {
        logStatus('设置保存失败');
        return false;
    }
}

// 保存按钮
if (btnSettingsSave) {
    btnSettingsSave.addEventListener('click', async function() {
        try {
            const ok = await saveSettings();
            if (ok && settingsModal) settingsModal.classList.remove('show');
        } catch (e) {
            logStatus('设置保存异常: ' + (e && e.message ? e.message : String(e)));
        }
    });
}

// ====== 输入框相关 ======
function bindToggle(inputEl, btnEl) {
    btnEl.addEventListener('click', function() {
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

['input', 'change'].forEach(function(evt) {
    targetEl.addEventListener(evt, updateButtons);
    cardEl.addEventListener(evt, updateButtons);
    apikeyEl.addEventListener(evt, updateButtons);
});

// ====== 配置加载/保存 ======
async function loadConfigsAndFill() {
    try {
        const res = await window.api.getConfigs();
        if (res && res.ok) {
            if (res.config) {
                if (!isNonEmpty(targetEl.value)) targetEl.value = res.config.Target_address || '';
                if (!isNonEmpty(cardEl.value)) cardEl.value = res.config.Card || '';
                if (!isNonEmpty(apikeyEl.value)) apikeyEl.value = res.config.apiKey || '';
            }
            if (res.aiConfig && !isNonEmpty(apikeyEl.value)) {
                apikeyEl.value = res.aiConfig.apiKey || '';
            }
        }
    } catch (_) {}
    if (!isNonEmpty(targetEl.value) && window.api.findCxExam) {
        try {
            const prevPlaceholder = targetEl.placeholder;
            targetEl.placeholder = '正在定位目标文件';
            const found = await window.api.findCxExam();
            if (found && found.ok && found.path) {
                targetEl.value = found.path;
                await saveConfigs();
            }
            targetEl.placeholder = prevPlaceholder;
        } catch (_) {
            targetEl.placeholder = '请选择 CxExam.exe 文件路径';
        }
    }
    updateButtons();
}

async function saveConfigs() {
    try {
        const payload = {
            config: { Target_address: targetEl.value || '', Card: cardEl.value || '' },
            aiConfig: { apiKey: apikeyEl.value || '' }
        };
        const res = await window.api.setConfigs(payload);
        if (res && res.error) { /* 静默处理 */ } else { updateBalanceVisibility(); }
    } catch (_) {}
}

iconChooseExe.addEventListener('click', async function() {
    const res = await window.api.chooseExe();
    if (res && res.ok && res.path) {
        targetEl.value = res.path;
        updateButtons();
        saveConfigs();
    }
});

['blur', 'change'].forEach(function(evt) {
    targetEl.addEventListener(evt, saveConfigs);
    cardEl.addEventListener(evt, saveConfigs);
    apikeyEl.addEventListener(evt, saveConfigs);
});

// ====== 初始化 ======
setupAllBtnTips();
loadConfigsAndFill().then(function() { updateBalanceVisibility(); });
loadNotice();
