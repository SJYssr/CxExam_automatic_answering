const http = require('http');
const { URL } = require('url');
const { getErrorMessage } = require('./error_code');

const API_URLS = [
    'http://api.1wxyun.com/?type=15',
    'http://api2.1wxyun.com/?type=15',
    'http://apiw1.1wxyun.com/?type=15'
];

function httpPost(url, postData) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function clearOnlineData(retryIndex = 0) {
    try {
        const core = require('../main');
        const tokenChannel = require('../tokenChannel');
        const softidValue = core.Sofitid;
        const cardValue = core.Card;
        const tokenValue = tokenChannel.getToken();

        if (!softidValue) {
            return { success: false, errorCode: '', errorMessage: '软件标识(Sofitid)不能为空' };
        }

        if (!cardValue) {
            // 如果没有Card，可能用户未登录，直接返回成功（不需要清理）
            return { success: true, errorCode: '', errorMessage: '' };
        }

        if (!tokenValue) {
            // 如果没有Token，可能用户未登录，直接返回成功（不需要清理）
            return { success: true, errorCode: '', errorMessage: '' };
        }

        if (retryIndex >= API_URLS.length) {
            return { success: false, errorCode: '', errorMessage: '所有接口地址均无法访问' };
        } 

        // 参数：Softid、UserName（Card）、Token
        const postData = `Softid=${encodeURIComponent(softidValue)}&UserName=${encodeURIComponent(cardValue)}&Token=${encodeURIComponent(tokenValue)}`;
        let response;
        try {
            response = await httpPost(API_URLS[retryIndex], postData);
            response = response.trim();
        } catch (error) {
            if (retryIndex < API_URLS.length - 1) {
                return await clearOnlineData(retryIndex + 1);
            }
            return { success: false, errorCode: '', errorMessage: `网络请求失败: ${error.message}` };
        }

        // 成功返回1
        if (response === '1') {
            return { success: true, errorCode: '', errorMessage: '' };
        }

        if (response.startsWith('-') || /^-\d+$/.test(response)) {
            const errorCode = response;
            const errorMessage = getErrorMessage(errorCode);
            return { success: false, errorCode, errorMessage };
        }

        // 即使返回不是1，也认为退出操作已执行（可能是已经退出过了）
        return { success: true, errorCode: '', errorMessage: '' };
    } catch (error) {
        return { success: false, errorCode: '', errorMessage: `用户退出异常: ${error.message}` };
    }
}

module.exports = {
    clearOnlineData
};

