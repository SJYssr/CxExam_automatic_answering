const http = require('http');
const { URL } = require('url');
const { getErrorMessage } = require('./error_code');

const API_URLS = [
    'http://api.1wxyun.com/?type=6',
    'http://api2.1wxyun.com/?type=6',
    'http://apiw1.1wxyun.com/?type=6'
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

async function getHelpLink(retryIndex = 0) {
    try {
        const core = require('../main');
        const softidValue = core.Sofitid;

        if (!softidValue) {
            return { success: false, url: '', errorCode: '', errorMessage: '软件标识(Sofitid)不能为空' };
        }

        if (retryIndex >= API_URLS.length) {
            return { success: false, url: '', errorCode: '', errorMessage: '所有接口地址均无法访问' };
        }

        const postData = `Softid=${encodeURIComponent(softidValue)}`;
        let response;
        try {
            response = await httpPost(API_URLS[retryIndex], postData);
            response = response.trim();
        } catch (error) {
            if (retryIndex < API_URLS.length - 1) {
                return await getHelpLink(retryIndex + 1);
            }
            return { success: false, url: '', errorCode: '', errorMessage: `网络请求失败: ${error.message}` };
        }

        if (response.startsWith('-') || /^-\d+$/.test(response)) {
            const errorCode = response;
            const errorMessage = getErrorMessage(errorCode);
            return { success: false, url: '', errorCode, errorMessage };
        }

        if (response) {
            return { success: true, url: response, errorCode: '', errorMessage: '' };
        }

        return { success: false, url: '', errorCode: '', errorMessage: '接口返回空响应' };
    } catch (error) {
        return { success: false, url: '', errorCode: '', errorMessage: `获取使用说明链接异常: ${error.message}` };
    }
}

module.exports = {
    getHelpLink
};


