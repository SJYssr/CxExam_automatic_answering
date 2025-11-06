const http = require('http');
const { URL } = require('url');
// 配置从 main 中延迟读取，避免循环依赖初始化顺序问题
const { getErrorMessage } = require('./error_code');

// 接口地址列表（支持负载均衡和海外访问）
const API_URLS = [
    'http://api.1wxyun.com/?type=9',
    'http://api2.1wxyun.com/?type=9',
    'http://apiw1.1wxyun.com/?type=9'
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
 * 获取版本号名称
 * @param {string} token - 登录成功后返回的Token（可选，如果不提供则需要手动传入）
 * @param {string} userName - 单码（可选，如果不提供则使用 main.js 中的 Card）
 * @param {number} retryIndex - 当前重试的接口索引（内部使用）
 * @returns {Promise<Object>} 返回结果 { success: boolean, versionName: string, errorCode: string, errorMessage: string }
 */
async function getVersionName(token = null, userName = null, retryIndex = 0) {
    try {
        // 使用传入的参数或 main.js 中的值（延迟读取）
        const cfg = require('../main');
        const softidValue = cfg.Sofitid;
        const userNameValue = userName || cfg.Card;
        const tokenValue = token;
        const versionValue = cfg.Local_Version;

        // 验证必要参数
        if (!softidValue) {
            return {
                success: false,
                versionName: '',
                errorCode: '',
                errorMessage: '软件标识(Sofitid)不能为空'
            };
        }

        if (!userNameValue) {
            return {
                success: false,
                versionName: '',
                errorCode: '',
                errorMessage: '单码(UserName)不能为空'
            };
        }

        if (!tokenValue) {
            return {
                success: false,
                versionName: '',
                errorCode: '',
                errorMessage: 'Token不能为空'
            };
        }

        if (!versionValue) {
            return {
                success: false,
                versionName: '',
                errorCode: '',
                errorMessage: '版本号(Version)不能为空'
            };
        }

        // 构建 POST 数据
        const postData = `Softid=${encodeURIComponent(softidValue)}&UserName=${encodeURIComponent(userNameValue)}&Token=${encodeURIComponent(tokenValue)}&Version=${encodeURIComponent(versionValue)}`;

        // 如果还有可用的接口地址，尝试请求
        if (retryIndex >= API_URLS.length) {
            return {
                success: false,
                versionName: '',
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
                return await getVersionName(token, userName, retryIndex + 1);
            }
            return {
                success: false,
                versionName: '',
                errorCode: '',
                errorMessage: `网络请求失败: ${error.message}`
            };
        }

        // 判断响应结果
        // 成功：返回版本号名称（字符串）
        // 失败：返回错误码（负数，如 -81001）
        if (response.startsWith('-') || /^-\d+$/.test(response)) {
            // 失败，返回错误码
            const errorCode = response;
            const errorMessage = getErrorMessage(errorCode);
            return {
                success: false,
                versionName: '',
                errorCode: errorCode,
                errorMessage: errorMessage
            };
        } else if (response && response.length > 0) {
            // 成功，返回版本号名称
            return {
                success: true,
                versionName: response,
                errorCode: '',
                errorMessage: ''
            };
        } else {
            // 空响应
            return {
                success: false,
                versionName: '',
                errorCode: '',
                errorMessage: '接口返回空响应'
            };
        }
    } catch (error) {
        return {
            success: false,
            versionName: '',
            errorCode: '',
            errorMessage: `获取版本号名称异常: ${error.message}`
        };
    }
}

/**
 * 获取版本号名称（同步风格，使用回调）
 * @param {Function} callback - 回调函数 (error, result)
 * @param {string} token - Token（必填）
 * @param {string} userName - 单码（可选）
 */
function getVersionNameAsync(callback, token, userName = null) {
    getVersionName(token, userName)
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
    getVersionName,
    getVersionNameAsync
};

// 如果直接运行此文件，则执行测试
if (require.main === module) {
    // 测试时需要提供 Token
    const testToken = process.argv[2] || '';
    if (!testToken) {
        console.log('用法: node get_VersionName.js <Token>');
        console.log('示例: node get_VersionName.js 1234567890123456');
        process.exit(1);
    }

    getVersionName(testToken)
        .then(result => {
            if (result.success) {
                console.log('获取成功！');
                console.log('版本号名称:', result.versionName);
            } else {
                console.log('获取失败！');
                if (result.errorCode) {
                    console.log('错误代码:', result.errorCode);
                }
                console.log('错误信息:', result.errorMessage);
            }
        })
        .catch(error => {
            console.error('获取异常:', error);
        });
}

