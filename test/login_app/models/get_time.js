const http = require('http');
const { URL } = require('url');
// 配置从 main 中延迟读取，避免循环依赖初始化顺序问题
const { getErrorMessage } = require('./error_code');

// 接口地址列表（支持负载均衡和海外访问）
const API_URLS = [
    'http://api.1wxyun.com/?type=24',
    'http://api2.1wxyun.com/?type=24',
    'http://apiw1.1wxyun.com/?type=24'
];

/**
 * 发送 POST 请求
 * @param {string} url - 请求地址
 * @param {string} postData - POST 数据
 * @returns {Promise<string>} 返回响应数据
 */
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

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve(data);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(postData);
        req.end();
    });
}

/**
 * 取到期时间
 * @param {string} userName - 单码（可选，不传则用 main.js 中的 Card）
 * @param {number} retryIndex - 当前重试的接口索引（内部使用）
 * @returns {Promise<Object>} { success, expireTime, errorCode, errorMessage }
 */
async function getExpireTime(userName = null, retryIndex = 0) {
    try {
        const cfg = require('../main');
        const softidValue = cfg.Sofitid;
        const userNameValue = userName || cfg.Card;
        const userPwdValue = '';

        if (!softidValue) {
            return { success: false, expireTime: '', errorCode: '', errorMessage: '软件标识(Sofitid)不能为空' };
        }
        if (!userNameValue) {
            return { success: false, expireTime: '', errorCode: '', errorMessage: '单码(UserName)不能为空' };
        }

        const postData = `Softid=${encodeURIComponent(softidValue)}&UserName=${encodeURIComponent(userNameValue)}&UserPwd=${encodeURIComponent(userPwdValue)}`;

        if (retryIndex >= API_URLS.length) {
            return { success: false, expireTime: '', errorCode: '', errorMessage: '所有接口地址均无法访问' };
        }

        const apiUrl = API_URLS[retryIndex];
        let response;
        try {
            response = await httpPost(apiUrl, postData);
            response = response.trim();
        } catch (error) {
            if (retryIndex < API_URLS.length - 1) {
                return await getExpireTime(userName, retryIndex + 1);
            }
            return { success: false, expireTime: '', errorCode: '', errorMessage: `网络请求失败: ${error.message}` };
        }

        // 失败：负数错误码；成功：返回到期时间字符串
        if (response.startsWith('-') || /^-\d+$/.test(response)) {
            const errorCode = response;
            const errorMessage = getErrorMessage(errorCode);
            return { success: false, expireTime: '', errorCode, errorMessage };
        }

        if (response) {
            return { success: true, expireTime: response, errorCode: '', errorMessage: '' };
        }

        return { success: false, expireTime: '', errorCode: '', errorMessage: '接口返回空响应' };
    } catch (error) {
        return { success: false, expireTime: '', errorCode: '', errorMessage: `获取到期时间异常: ${error.message}` };
    }
}

/**
 * 回调风格
 * @param {Function} callback - (error, result)
 * @param {string} userName - 单码（可选）
 */
function getExpireTimeAsync(callback, userName = null) {
    getExpireTime(userName)
        .then(result => {
            if (result.success) {
                callback(null, result);
            } else {
                callback(result.errorMessage || result.errorCode, result);
            }
        })
        .catch(error => callback(error, null));
}

module.exports = {
    getExpireTime,
    getExpireTimeAsync
};

// 若直接运行本文件，执行简单测试（需 main.js 中已配置 Softid 与 Card）
if (require.main === module) {
    getExpireTime()
        .then(r => {
            if (r.success) {
                console.log('获取成功! 到期时间:', r.expireTime);
            } else {
                console.log('获取失败!', r.errorCode ? `错误代码: ${r.errorCode}` : '');
                console.log('错误信息:', r.errorMessage);
            }
        })
        .catch(e => console.error('异常:', e));
}
