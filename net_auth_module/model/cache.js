const fs = require('fs');
const path = require('path');

/**
 * 缓存管理类 - 仅包含保存功能
 */
class CacheManager {
    constructor() {
        // 缓存文件路径
        this.cacheFilePath = path.join(__dirname, '..', 'cache', 'authorized.json');
        
        // 确保缓存目录存在
        this.ensureCacheDirectory();
    }
    
    /**
     * 确保缓存目录存在
     */
    ensureCacheDirectory() {
        const cacheDir = path.dirname(this.cacheFilePath);
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
        }
    }
    
    /**
     * 保存核心数据到缓存文件
     * @param {string} authorizedData - 核心数据
     * @returns {boolean} 保存是否成功
     */
    saveAuthorizedData(authorizedData) {
        try {
            // 只保存authorized数据，不保存其他信息
            const cacheData = {
                authorized: authorizedData,
                timestamp: new Date().toISOString()
            };
            
            fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('授权失败', error.message);
            return false;
        }
    }
}

/**
 * 便捷函数：保存核心数据到缓存
 * @param {string} authorizedData - 核心数据
 * @returns {boolean} 保存是否成功
 */
function saveAuthorizedToCache(authorizedData) {
    const cacheManager = new CacheManager();
    return cacheManager.saveAuthorizedData(authorizedData);
}

// 导出模块
module.exports = {
    CacheManager,
    saveAuthorizedToCache
};
