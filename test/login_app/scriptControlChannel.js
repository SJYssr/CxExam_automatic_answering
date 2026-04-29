const net = require('net');

const PIPE_PATH = '\\\\.\\pipe\\CxExamScriptControlPipe';

let server = null;
let currentSettings = {
    enableCrackScript: true,  // 默认开启破解脚本
    enableAIScript: true,     // 默认开启AI脚本
    aiModel: 'deepseek-v4-flash',  // 默认AI模型
    enableThinking: true,          // 默认开启推理模式
    reasoningEffort: 'high',       // 默认推理强度高
    // 快捷键设置
    crackScriptKeyCode: 112,  // F1 默认
    crackScriptCtrl: false,
    crackScriptAlt: false,
    crackScriptShift: false,
    aiScriptKeyCode: 113,      // F2 默认
    aiScriptCtrl: false,
    aiScriptAlt: false,
    aiScriptShift: false,
    modelSwitchKeyCode: 114,   // F3 默认 切换AI模型
    modelSwitchCtrl: false,
    modelSwitchAlt: false,
    modelSwitchShift: false
};

function startServer() {
    if (server) {
        return;
    }
    server = net.createServer((stream) => {
        try {
            // 将设置对象序列化为JSON字符串
            const settingsJson = JSON.stringify(currentSettings);
            stream.write(settingsJson, 'utf8');
            stream.end();
        } catch (err) {
            console.error('[scriptControlChannel] stream error:', err);
        }
    });

    server.on('error', (err) => {
        console.error('[scriptControlChannel] server error:', err);
    });

    server.listen(PIPE_PATH, () => {
        console.log('[scriptControlChannel] listening on', PIPE_PATH);
    });
}

function stopServer() {
    if (server) {
        try {
            server.close();
        } catch (err) {
            console.error('[scriptControlChannel] close error:', err);
        }
        server = null;
    }
}

function setSettings(settings) {
    if (settings && typeof settings === 'object') {
        if (typeof settings.enableCrackScript === 'boolean') {
            currentSettings.enableCrackScript = settings.enableCrackScript;
        }
        if (typeof settings.enableAIScript === 'boolean') {
            currentSettings.enableAIScript = settings.enableAIScript;
        }
        // 更新快捷键设置
        if (settings.crackScriptKeyCode !== undefined) {
            currentSettings.crackScriptKeyCode = parseInt(settings.crackScriptKeyCode) || 112;
        }
        if (typeof settings.crackScriptCtrl === 'boolean') {
            currentSettings.crackScriptCtrl = settings.crackScriptCtrl;
        }
        if (typeof settings.crackScriptAlt === 'boolean') {
            currentSettings.crackScriptAlt = settings.crackScriptAlt;
        }
        if (typeof settings.crackScriptShift === 'boolean') {
            currentSettings.crackScriptShift = settings.crackScriptShift;
        }
        if (settings.aiScriptKeyCode !== undefined) {
            currentSettings.aiScriptKeyCode = parseInt(settings.aiScriptKeyCode) || 113;
        }
        if (typeof settings.aiScriptCtrl === 'boolean') {
            currentSettings.aiScriptCtrl = settings.aiScriptCtrl;
        }
        if (typeof settings.aiScriptAlt === 'boolean') {
            currentSettings.aiScriptAlt = settings.aiScriptAlt;
        }
        if (typeof settings.aiScriptShift === 'boolean') {
            currentSettings.aiScriptShift = settings.aiScriptShift;
        }
        // 更新AI模型
        if (typeof settings.aiModel === 'string') {
            currentSettings.aiModel = settings.aiModel;
        }
        // 更新推理模式
        if (typeof settings.enableThinking === 'boolean') {
            currentSettings.enableThinking = settings.enableThinking;
        }
        // 更新推理强度
        if (typeof settings.reasoningEffort === 'string') {
            currentSettings.reasoningEffort = settings.reasoningEffort;
        }
        // 更新模型切换快捷键
        if (settings.modelSwitchKeyCode !== undefined) {
            currentSettings.modelSwitchKeyCode = parseInt(settings.modelSwitchKeyCode) || 114;
        }
        if (typeof settings.modelSwitchCtrl === 'boolean') {
            currentSettings.modelSwitchCtrl = settings.modelSwitchCtrl;
        }
        if (typeof settings.modelSwitchAlt === 'boolean') {
            currentSettings.modelSwitchAlt = settings.modelSwitchAlt;
        }
        if (typeof settings.modelSwitchShift === 'boolean') {
            currentSettings.modelSwitchShift = settings.modelSwitchShift;
        }
    }
}

function getSettings() {
    return { ...currentSettings };
}

module.exports = {
    startServer,
    stopServer,
    setSettings,
    getSettings
};

