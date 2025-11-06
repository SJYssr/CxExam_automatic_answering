const os = require('os');

/**
 * 获取本机的 MAC 地址
 * @returns {string|null} 返回第一个有效的 MAC 地址，如果获取失败则返回 null
 */
function getMacAddress() {
    try {
        const networkInterfaces = os.networkInterfaces();
        
        // 遍历所有网络接口
        for (const interfaceName in networkInterfaces) {
            const interfaces = networkInterfaces[interfaceName];
            
            for (const iface of interfaces) {
                // 跳过内部（即 127.0.0.1）和非 IPv4 地址
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.mac;
                }
            }
        }
        
        // 如果没找到，返回第一个非内部的 MAC 地址
        for (const interfaceName in networkInterfaces) {
            const interfaces = networkInterfaces[interfaceName];
            
            for (const iface of interfaces) {
                if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                    return iface.mac;
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('获取 MAC 地址失败:', error);
        return null;
    }
}

/**
 * 获取所有网络接口的 MAC 地址
 * @returns {Array<Object>} 返回包含接口名和 MAC 地址的对象数组
 */
function getAllMacAddresses() {
    try {
        const networkInterfaces = os.networkInterfaces();
        const macAddresses = [];
        
        for (const interfaceName in networkInterfaces) {
            const interfaces = networkInterfaces[interfaceName];
            
            for (const iface of interfaces) {
                if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
                    macAddresses.push({
                        interface: interfaceName,
                        mac: iface.mac,
                        family: iface.family,
                        internal: iface.internal
                    });
                }
            }
        }
        
        return macAddresses;
    } catch (error) {
        console.error('获取所有 MAC 地址失败:', error);
        return [];
    }
}

/**
 * 格式化 MAC 地址（移除分隔符或添加分隔符）
 * @param {string} mac - MAC 地址
 * @param {string} separator - 分隔符，默认为 ':'
 * @returns {string} 格式化后的 MAC 地址
 */
function formatMacAddress(mac, separator = ':') {
    if (!mac) return '';
    
    // 移除所有分隔符
    const cleanMac = mac.replace(/[:-]/g, '');
    
    // 每两个字符添加分隔符
    return cleanMac.match(/.{1,2}/g).join(separator);
}

module.exports = {
    getMacAddress,
    getAllMacAddresses,
    formatMacAddress
};

// 如果直接运行此文件，则输出 MAC 地址
if (require.main === module) {
    const mac = getMacAddress();
    console.log('主 MAC 地址:', mac || '未找到');
    
    console.log('\n所有网络接口:');
    const allMacs = getAllMacAddresses();
    allMacs.forEach(item => {
        console.log(`  ${item.interface}: ${item.mac} (${item.family}, ${item.internal ? '内部' : '外部'})`);
    });
}

