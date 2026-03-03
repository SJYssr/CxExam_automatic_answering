const net = require('net');
const fs = require('fs');
const path = require('path');

const PIPE_PATH = '\\\\.\\pipe\\CxExamTokenPipe';

let server = null;
/** @type {string|null} config.json 路径，由 electron-main 启动时设置 */
let configPath = null;

function setConfigPath(p) {
    configPath = p ? String(p) : null;
}

function readConfig() {
    if (!configPath) return {};
    try {
        if (!fs.existsSync(configPath)) return {};
        const txt = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(txt);
    } catch (_) {
        return {};
    }
}

function writeConfig(config) {
    if (!configPath) return false;
    try {
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (_) {
        return false;
    }
}

function startServer() {
    if (server) {
        return;
    }
    server = net.createServer((stream) => {
        try {
            const token = getToken();
            if (token) {
                stream.write(token, 'utf8');
            }
            stream.end();
        } catch (err) {
            console.error('[tokenChannel] stream error:', err);
        }
    });

    server.on('error', (err) => {
        console.error('[tokenChannel] server error:', err);
    });

    server.listen(PIPE_PATH, () => {
        console.log('[tokenChannel] listening on', PIPE_PATH);
    });
}

function stopServer() {
    if (server) {
        try {
            server.close();
        } catch (err) {
            console.error('[tokenChannel] close error:', err);
        }
        server = null;
    }
}

/** 将 token 写入 config.json，有变化即更新（不写入 Mac，Mac 仅来自 get_device_id） */
function setToken(token) {
    const config = readConfig();
    config.authToken = token ? String(token) : '';
    delete config.Mac;
    writeConfig(config);
}

function clearToken() {
    const config = readConfig();
    config.authToken = '';
    delete config.Mac;
    writeConfig(config);
}

/** 从 config.json 读取 token */
function getToken() {
    const config = readConfig();
    return config.authToken || '';
}

module.exports = {
    setConfigPath,
    startServer,
    stopServer,
    setToken,
    clearToken,
    getToken
};
