const http = require('http');
const { URL } = require('url');
// 配置从 main 中延迟读取，避免循环依赖初始化顺序问题
const { getErrorMessage } = require('./error_code');

// 接口地址列表（支持负载均衡和海外访问）
const API_URLS = [
    'http://api.1wxyun.com/?type=17',
    'http://api2.1wxyun.com/?type=17',
    'http://apiw1.1wxyun.com/?type=17'
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
 * 单码登录
 * @param {string} card - 单码（可选，如果不提供则使用 main.js 中的 Card）
 * @param {number} retryIndex - 当前重试的接口索引（内部使用）
 * @returns {Promise<Object>} 返回登录结果 { success: boolean, token: string, errorCode: string, errorMessage: string }
 */
async function login(card = null, retryIndex = 0) {
    try {
        // 延迟读取配置
        const cfg = require('../main');
        const cardValue = card || cfg.Card;
        const softidValue = cfg.Sofitid;
        const versionValue = cfg.Local_Version;
        const macValue = cfg.Mac;

        // 验证必要参数
        if (!softidValue) {
            return {
                success: false,
                token: '',
                errorCode: '',
                errorMessage: '软件标识(Sofitid)不能为空'
            };
        }

        if (!cardValue) {
            return {
                success: false,
                token: '',
                errorCode: '',
                errorMessage: '单码(Card)不能为空'
            };
        }

        if (!versionValue) {
            return {
                success: false,
                token: '',
                errorCode: '',
                errorMessage: '版本号(Version)不能为空'
            };
        }

        if (!macValue) {
            return {
                success: false,
                token: '',
                errorCode: '',
                errorMessage: '机器码(Mac)不能为空'
            };
        }

        // 构建 POST 数据
        const postData = `Softid=${encodeURIComponent(softidValue)}&Card=${encodeURIComponent(cardValue)}&Version=${encodeURIComponent(versionValue)}&Mac=${encodeURIComponent(macValue)}`;

        // 如果还有可用的接口地址，尝试请求
        if (retryIndex >= API_URLS.length) {
            return {
                success: false,
                token: '',
                errorCode: '',
                errorMessage: '所有接口地址均无法访问'
            };
        }

        const apiUrl = API_URLS[retryIndex];
        let response;

        try {
            response = await httpPost(apiUrl, postData);
            response = response.trim();
        } catch (error) {
            // 如果当前接口失败，尝试下一个接口
            if (retryIndex < API_URLS.length - 1) {
                return await login(card, retryIndex + 1);
            }
            return {
                success: false,
                token: '',
                errorCode: '',
                errorMessage: `网络请求失败: ${error.message}`
            };
        }

        // 判断响应结果
        // 成功：返回16位Token（通常为字母数字组合）
        // 失败：返回错误码（负数，如 -81001）
        if (response.length === 16 && /^[a-zA-Z0-9]{16}$/.test(response)) {
            // 成功，返回 Token
            return {
                success: true,
                token: response,
                errorCode: '',
                errorMessage: ''
            };
        } else if (response.startsWith('-') || /^-\d+$/.test(response)) {
            // 失败，返回错误码
            const errorCode = response;
            const errorMessage = getErrorMessage(errorCode);
            return {
                success: false,
                token: '',
                errorCode: errorCode,
                errorMessage: errorMessage
            };
        } else {
            // 未知响应格式
            return {
                success: false,
                token: '',
                errorCode: '',
                errorMessage: `未知响应格式: ${response}`
            };
        }
    } catch (error) {
        return {
            success: false,
            token: '',
            errorCode: '',
            errorMessage: `登录异常: ${error.message}`
        };
    }
}

/**
 * 单码登录（同步风格，使用回调）
 * @param {Function} callback - 回调函数 (error, result)
 * @param {string} card - 单码（可选）
 */
function loginAsync(callback, card = null) {
    login(card)
        .then(result => {
            if (result.success) {
                callback(null, result);
            } else {
                callback(result.errorMessage || result.errorCode, result);
            }
        })
        .catch(error => {
            callback(error, null);
        });
}

module.exports = {
    login,
    loginAsync
};

// 如果直接运行此文件，则执行测试
if (require.main === module) {
    login()
        .then(result => {
            if (result.success) {
                console.log('登录成功！');
                console.log('Token:', result.token);
            } else {
                console.log('登录失败！');
                if (result.errorCode) {
                    console.log('错误代码:', result.errorCode);
                }
                console.log('错误信息:', result.errorMessage);
            }
        })
        .catch(error => {
            console.error('登录异常:', error);
        });
}

