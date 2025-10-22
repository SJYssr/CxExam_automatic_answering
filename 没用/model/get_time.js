const { formatError } = require('./error_code'); // 从error_code模块导入formatError函数
const {Card} = require('../config')//全局变量定义，从config模块导入Card

// 软件标识（直接写入）
const Softid = '6G6G7V8C2T9L9U8A';


/**
 * 取到期时间功能类
 */
class TimeFetcher {
    constructor() {
        // 接口地址列表
        this.apiEndpoints = [
            'http://api.1wxyun.com/?type=24',
            'http://api2.1wxyun.com/?type=24'
        ];
        
        // 当前使用的接口索引
        this.currentEndpointIndex = 0;
        
        // 请求超时时间（毫秒）
        this.timeout = 10000;
    }
    
    /**
     * HTTP POST请求
     * @param {string} url - 请求URL
     * @param {string} data - POST数据
     * @returns {Promise<Object>} 请求结果
     */
    httpPost(url, data) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? require('https') : require('http');
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(data),
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: this.timeout
            };
            
            const req = protocol.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve({
                            success: true,
                            data: responseData,
                            statusCode: res.statusCode,
                            endpoint: url
                        });
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('请求超时'));
            });
            
            req.write(data);
            req.end();
        });
    }
    
    /**
     * 切换到下一个可用的接口线路
     */
    switchToNextEndpoint() {
        this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.apiEndpoints.length;
    }
    
    /**
     * 获取当前活跃的接口地址
     * @returns {string} 当前接口地址
     */
    getCurrentEndpoint() {
        return this.apiEndpoints[this.currentEndpointIndex];
    }
    
    /**
     * 取到期时间
     * @param {string} softid - 软件标识
     * @param {string} userName - 用户名（使用Card值）
     * @param {string} userPwd - 用户密码（单码时留空）
     * @returns {Promise<Object>} 到期时间结果
     */
    async getExpireTime(softid, userName, userPwd = '') {
        // 尝试第一个线路
        const firstEndpoint = this.getCurrentEndpoint();
        const postData = `Softid=${encodeURIComponent(softid)}&UserName=${encodeURIComponent(userName)}&UserPwd=${encodeURIComponent(userPwd)}`;
        
        try {
            const result = await this.httpPost(firstEndpoint, postData);
            
            // 解析返回数据
            return this.parseTimeResult(result.data);
            
        } catch (error) {
            // 第一个线路失败，切换到第二个线路
            this.switchToNextEndpoint();
            const secondEndpoint = this.getCurrentEndpoint();
            
            try {
                const result = await this.httpPost(secondEndpoint, postData);
                
                // 解析返回数据
                return this.parseTimeResult(result.data);
                
            } catch (secondError) {
                // 两个线路都失败
                return {
                    success: false,
                    error: `所有线路都请求失败: ${secondError.message}`,
                    errorCode: 'NETWORK_ERROR'
                };
            }
        }
    }
    
    /**
     * 解析到期时间返回结果
     * @param {string} responseData - 原始响应数据
     * @returns {Object} 解析后的结果
     */
    parseTimeResult(responseData) {
        const trimmedData = responseData.trim();
        
        // 检查响应数据是否为错误码格式（以-开头的数字）
        const errorCodeMatch = trimmedData.match(/^(-\d+)$/);
        if (errorCodeMatch) {
            const errorCode = errorCodeMatch[1];
            return formatError(errorCode);
        }
        
        // 成功返回到期时间
        return {
            success: true,
            expireTime: trimmedData,
            data: trimmedData,
            isPlainText: true
        };
    }
    
    /**
     * 获取所有线路的状态（用于健康检查）
     * @returns {Promise<Array>} 线路状态列表
     */
    async checkAllEndpoints() {
        const statuses = [];
        
        for (let i = 0; i < this.apiEndpoints.length; i++) {
            const endpoint = this.apiEndpoints[i];
            const testData = 'Softid=test&UserName=test&UserPwd=';
            
            try {
                const startTime = Date.now();
                await this.httpPost(endpoint, testData);
                const responseTime = Date.now() - startTime;
                
                statuses.push({
                    endpoint: endpoint,
                    status: 'online',
                    responseTime: responseTime,
                    index: i
                });
                
            } catch (error) {
                statuses.push({
                    endpoint: endpoint,
                    status: 'offline',
                    error: error.message,
                    index: i
                });
            }
        }
        
        return statuses;
    }
}

/**
 * 便捷函数：取到期时间
 * @param {string} softid - 软件标识
 * @param {string} userName - 用户名（使用Card值）
 * @param {string} userPwd - 用户密码（单码时留空）
 * @returns {Promise<Object>} 到期时间结果
 */
async function getExpireTime(softid, userName, userPwd = '') {
    const fetcher = new TimeFetcher();
    return await fetcher.getExpireTime(softid, userName, userPwd);
}

/**
 * 便捷函数：使用全局变量取到期时间
 * @returns {Promise<Object>} 到期时间结果
 */
async function getExpireTimeWithGlobalVars() {
    const fetcher = new TimeFetcher();
    return await fetcher.getExpireTime(Softid, Card, '');
}

/**
 * 便捷函数：检查所有线路状态
 * @returns {Promise<Array>} 线路状态
 */
async function checkEndpointStatus() {
    const fetcher = new TimeFetcher();
    return await fetcher.checkAllEndpoints();
}

// 导出模块
module.exports = {
    TimeFetcher,
    getExpireTime,
    getExpireTimeWithGlobalVars,
    checkEndpointStatus,
    Softid,
    Card
};

// 如果直接运行此文件，则自动取到期时间并输出结果
if (require.main === module) {
    (async () => {
        try {
            // 检查必要的参数是否已设置
            if (!Card) {
                console.error('错误: Card（单码）参数未设置，请在代码中设置Card变量');
                return;
            }
            
            const result = await getExpireTimeWithGlobalVars();
            
            if (result.success) {
                console.log('到期时间:', result.expireTime);
            } else {
                console.error('获取到期时间失败:', result.error || result.errorMessage);
            }
        } catch (error) {
            console.error('执行错误:', error.message);
        }
    })();
}