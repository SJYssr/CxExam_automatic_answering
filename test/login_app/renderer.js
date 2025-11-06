function $(id) { return document.getElementById(id); }

const targetEl = $('target');
const cardEl = $('card');
const apikeyEl = $('apikey');
const statusEl = $('status');
const iconChooseExe = $('iconChooseExe');
const iconToggleCard = $('iconToggleCard');
const iconToggleApikey = $('iconToggleApikey');
const btnLogin = $('btnLogin');
const btnStart = $('btnStart');
let loggedIn = false;

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
            }
            if (res.aiConfig) {
                if (!isNonEmpty(apikeyEl.value)) apikeyEl.value = res.aiConfig.apiKey || '';
            }
        }
    } catch (_) {}
    updateButtons();
}

async function saveConfigs() {
    try {
        const hasTarget = isNonEmpty(targetEl.value);
        const payload = {
            config: { Target_address: targetEl.value || '', Card: cardEl.value || '' },
            aiConfig: { apiKey: hasTarget ? (apikeyEl.value || '') : '' }
        };
        const res = await window.api.setConfigs(payload);
        if (res && res.error) {
            // 静默处理或可提示：未填写目标路径，无法设置 API Key
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


