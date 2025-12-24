const net = require('net');

const PIPE_PATH = '\\\\.\\pipe\\CxExamTokenPipe';

let server = null;
let currentToken = '';

function startServer() {
    if (server) {
        return;
    }
    server = net.createServer((stream) => {
        try {
            if (currentToken) {
                stream.write(currentToken, 'utf8');
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

function setToken(token) {
    currentToken = token ? String(token) : '';
}

function clearToken() {
    currentToken = '';
}

function getToken() {
    return currentToken || '';
}

module.exports = {
    startServer,
    stopServer,
    setToken,
    clearToken,
    getToken
};

