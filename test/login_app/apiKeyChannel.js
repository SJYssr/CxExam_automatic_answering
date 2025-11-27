const net = require('net');

const PIPE_PATH = '\\\\.\\pipe\\CxExamApiKeyPipe';

let server = null;
let currentKey = '';

function startServer() {
    if (server) {
        return;
    }
    server = net.createServer((stream) => {
        try {
            if (currentKey) {
                stream.write(currentKey, 'utf8');
            }
            stream.end();
        } catch (err) {
            console.error('[apiKeyChannel] stream error:', err);
        }
    });

    server.on('error', (err) => {
        console.error('[apiKeyChannel] server error:', err);
    });

    server.listen(PIPE_PATH, () => {
        console.log('[apiKeyChannel] listening on', PIPE_PATH);
    });
}

function stopServer() {
    if (server) {
        try {
            server.close();
        } catch (err) {
            console.error('[apiKeyChannel] close error:', err);
        }
        server = null;
    }
}

function setKey(value) {
    currentKey = value ? String(value) : '';
}

function clearKey() {
    currentKey = '';
}

module.exports = {
    startServer,
    stopServer,
    setKey,
    clearKey
};

