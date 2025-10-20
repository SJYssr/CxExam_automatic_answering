const os = require('os');

/**
 * 简单获取MAC地址的函数
 * @returns {string} 主要MAC地址（大写格式，只包含英文和数字）
 */
function getMacAddress() {
    const nets = os.networkInterfaces();
    
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // 跳过内部地址和非IPv4地址
            if (net.family === 'IPv4' && !net.internal) {
                // 移除冒号分隔符，只保留英文和数字，并转换为大写格式
                return net.mac.replace(/:/g, '').toUpperCase();
            }
        }
    }
    
    return '未找到MAC地址';
}



// 导出模块
module.exports = {
    getMacAddress
};