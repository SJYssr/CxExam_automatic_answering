const https = require('https');
const http = require('http');
const { formatError, getErrorMessage } = require('./error_code');
const { Softid, Card, Version } = require('../config'); // 从配置文件导入常量


/**
 * 取版本号名称类 - 支持线路切换功能
 */
class VersionFetcher {
    constructor() {
        // 接口地址列表
        this.apiEndpoints = [
            'http://api.1wxyun.com/?type=9',
            'http://api2.1wxyun.com/?type=9'
        ];
        
        // 当前使用的线路索引
        this.currentEndpointIndex = 0;
        
        // 请求超时时间（毫秒）
        this.timeout = 10000;
        
        // 重试次数
        this.maxRetries = 2;
    }
    
    /**
     * 发送HTTP POST请求
     * @param {string} url - 请求URL
     * @param {string} data - POST数据
     * @returns {Promise<Object>} 响应数据
     */
    async httpPost(url, data) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;
            
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
     * 取版本号名称
     * @param {string} softid - 软件标识
     * @param {string} username - 用户名或单码
     * @param {string} token - Token
     * @param {string} version - 版本号
     * @returns {Promise<Object>} 版本号名称结果
     */
    async getVersionName(softid, username, token, version) {
        // 尝试第一个线路
        const firstEndpoint = this.getCurrentEndpoint();
        const postData = `Softid=${encodeURIComponent(softid)}&UserName=${encodeURIComponent(username)}&Token=${encodeURIComponent(token)}&Version=${encodeURIComponent(version)}`;
        
        try {
            const result = await this.httpPost(firstEndpoint, postData);
            
            // 解析返回数据
            return this.parseVersionResult(result.data);
            
        } catch (error) {
            // 第一个线路失败，切换到第二个线路
            this.switchToNextEndpoint();
            const secondEndpoint = this.getCurrentEndpoint();
            
            try {
                const result = await this.httpPost(secondEndpoint, postData);
                
                // 解析返回数据
                return this.parseVersionResult(result.data);
                
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
     * 解析版本号名称返回结果
     * @param {string} responseData - 原始响应数据
     * @returns {Object} 解析后的结果
     */
    parseVersionResult(responseData) {
        const trimmedData = responseData.trim();
        
        // 检查响应数据是否为错误码格式（以-开头的数字）
        const errorCodeMatch = trimmedData.match(/^(-\d+)$/);
        if (errorCodeMatch) {
            const errorCode = errorCodeMatch[1];
            return formatError(errorCode);
        }
        
        // 成功返回版本号名称（作为文本处理）
        return {
            success: true,
            versionName: trimmedData,
            data: trimmedData,
            isVersionName: true
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
            const testData = 'Softid=test&UserName=test&Token=test&Version=1.0.0';
            
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
 * 便捷函数：取版本号名称
 * @param {string} softid - 软件标识
 * @param {string} username - 用户名或单码
 * @param {string} token - Token
 * @param {string} version - 版本号
 * @returns {Promise<Object>} 版本号名称结果
 */
async function getVersionName(softid, username, token, version) {
    const fetcher = new VersionFetcher();
    return await fetcher.getVersionName(softid, username, token, version);
}

/**
 * 便捷函数：使用全局变量取版本号名称（需要传入token参数）
 * @param {string} token - 登录后获取的token
 * @returns {Promise<Object>} 版本号名称结果
 */
async function getVersionNameWithGlobalVars(token) {
    const fetcher = new VersionFetcher();
    return await fetcher.getVersionName(Softid, Card, token, Version);
}

/**
 * 便捷函数：检查所有线路状态
 * @returns {Promise<Array>} 线路状态
 */
async function checkEndpointStatus() {
    const fetcher = new VersionFetcher();
    return await fetcher.checkAllEndpoints();
}

// 导出模块
module.exports = {
    VersionFetcher,
    getVersionName,
    getVersionNameWithGlobalVars,
    checkEndpointStatus,
    Softid,
    Card,
    Version
};

// 如果直接运行此文件，则自动取版本号名称并输出结果
if (require.main === module) {
    (async () => {
        try {
            // 检查必要的参数是否已设置
            if (!Card) {
                console.error('错误: Card（单码）参数未设置，请在代码中设置Card变量');
                return;
            }
            
            if (!Token) {
                console.error('错误: Token参数未设置，请在代码中设置Token变量');
                return;
            }
            
            const result = await getVersionNameWithGlobalVars();
            
            if (result.success) {
                if (result.isVersionName) {
                    console.log('版本号名称:', result.versionName);
                } else {
                    console.log('版本号名称:', result.data);
                }
            } else {
                console.error('获取版本号名称失败:', result.error || result.errorMessage);
            }
        } catch (error) {
            console.error('执行错误:', error.message);
        }
    })();
}