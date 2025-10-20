const https = require('https');
const http = require('http');
const { formatError, getErrorMessage } = require('./error_code');
const { getMacAddress } = require('./get_mac');
const { Softid, Card, Version } = require('../config'); // 从配置文件导入常量

/**
 * 单码登录类 - 支持线路切换功能
 */
class LoginFetcher {
    constructor() {
        // 接口地址列表
        this.apiEndpoints = [
            'http://api.1wxyun.com/?type=17',
            'http://api2.1wxyun.com/?type=17'
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
     * 单码登录
     * @param {string} softid - 软件标识
     * @param {string} card - 单码
     * @param {string} version - 版本号
     * @param {string} mac - 机器码
     * @returns {Promise<Object>} 登录结果
     */
    async login(softid, card, version, mac) {
        // 尝试第一个线路
        const firstEndpoint = this.getCurrentEndpoint();
        const postData = `Softid=${encodeURIComponent(softid)}&Card=${encodeURIComponent(card)}&Version=${encodeURIComponent(version)}&Mac=${encodeURIComponent(mac)}`;
        
        try {
            const result = await this.httpPost(firstEndpoint, postData);
            
            // 解析返回数据
            return this.parseLoginResult(result.data);
            
        } catch (error) {
            // 第一个线路失败，切换到第二个线路
            this.switchToNextEndpoint();
            const secondEndpoint = this.getCurrentEndpoint();
            
            try {
                const result = await this.httpPost(secondEndpoint, postData);
                
                // 解析返回数据
                return this.parseLoginResult(result.data);
                
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
     * 解析登录返回结果
     * @param {string} responseData - 原始响应数据
     * @returns {Object} 解析后的结果
     */
    parseLoginResult(responseData) {
        const trimmedData = responseData.trim();
        
        // 检查响应数据是否为错误码格式（以-开头的数字）
        const errorCodeMatch = trimmedData.match(/^(-\d+)$/);
        if (errorCodeMatch) {
            const errorCode = errorCodeMatch[1];
            return formatError(errorCode);
        }
        
        // 检查是否为16位Token（登录成功）
        if (trimmedData.length === 16 && /^[a-zA-Z0-9]+$/.test(trimmedData)) {
            return {
                success: true,
                token: trimmedData,
                data: trimmedData,
                isToken: true
            };
        }
        
        // 其他情况作为文本处理
        return {
            success: true,
            data: trimmedData,
            rawData: responseData,
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
            const testData = 'Softid=test&Card=test&Version=1.0.0&Mac=test';
            
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
 * 便捷函数：单码登录
 * @param {string} softid - 软件标识
 * @param {string} card - 单码
 * @param {string} version - 版本号
 * @param {string} mac - 机器码
 * @returns {Promise<Object>} 登录结果
 */
async function login(softid, card, version, mac) {
    const fetcher = new LoginFetcher();
    return await fetcher.login(softid, card, version, mac);
}

/**
 * 便捷函数：使用全局变量进行单码登录
 * @returns {Promise<Object>} 登录结果
 */
async function loginWithGlobalVars() {
    const fetcher = new LoginFetcher();
    const macAddress = getMacAddress(); // 动态获取MAC地址
    return await fetcher.login(Softid, Card, Version, macAddress);
}

/**
 * 便捷函数：检查所有线路状态
 * @returns {Promise<Array>} 线路状态
 */
async function checkEndpointStatus() {
    const fetcher = new LoginFetcher();
    return await fetcher.checkAllEndpoints();
}

// 导出模块
module.exports = {
    LoginFetcher,
    login,
    loginWithGlobalVars,
    checkEndpointStatus,
};

// 如果直接运行此文件，则自动进行单码登录并输出结果
if (require.main === module) {
    (async () => {
        try {
            const result = await loginWithGlobalVars();
            
            if (result.success) {
                if (result.isToken) {
                    console.log(result.token);
                } else {
                    console.log(result.data);
                }
            } else {
                console.error(result.error || result.errorMessage);
            }
        } catch (error) {
            console.error(error.message);
        }
    })();
}