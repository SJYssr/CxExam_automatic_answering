const { execSync } = require('child_process');
const os = require('os');

/**
 * 使用Windows命令获取物理网卡的MAC地址
 * @returns {string|null} 返回第一个物理网卡的MAC地址，如果获取失败则返回 null
 */
function getPhysicalMacAddressWindows() {
    try {
        // 使用 wmic 命令获取物理适配器且已启用的MAC地址
        // PhysicalAdapter=true: 只获取物理适配器（排除虚拟适配器）
        // NetEnabled=true: 只获取已启用的适配器
        const command = 'wmic path win32_networkadapter where "PhysicalAdapter=true and NetEnabled=true" get MACAddress /format:list';
        const output = execSync(command, { encoding: 'utf8', timeout: 5000, windowsHide: true });
        
        // 解析输出，查找MACAddress字段
        const lines = output.split('\n');
        for (const line of lines) {
            const match = line.match(/^MACAddress=(.+)$/);
            if (match && match[1] && match[1].trim()) {
                const mac = match[1].trim();
                // 验证MAC地址格式（应该是12位十六进制）
                if (/^[0-9A-F]{12}$/i.test(mac.replace(/[:-]/g, ''))) {
                    // 返回标准格式（带冒号）
                    const cleanMac = mac.replace(/[:-]/g, '');
                    return cleanMac.match(/.{1,2}/g).join(':').toUpperCase();
                }
            }
        }
        return null;
    } catch (error) {
        // 如果wmic失败，尝试使用getmac命令
        try {
            const command = 'getmac /v /fo csv | findstr /i /c:"Physical"';
            const output = execSync(command, { encoding: 'utf8', timeout: 5000, windowsHide: true });
            const lines = output.split('\n');
            for (const line of lines) {
                // CSV格式: "连接名","网络适配器","物理地址","传输名称"
                const match = line.match(/"([0-9A-F]{2}(?:[:-][0-9A-F]{2}){5})"/i);
                if (match && match[1]) {
                    const mac = match[1].replace(/[:-]/g, '');
                    if (mac.length === 12) {
                        return mac.match(/.{1,2}/g).join(':').toUpperCase();
                    }
                }
            }
        } catch (e) {
            // 如果也失败，返回null
        }
        return null;
    }
}

/**
 * 获取本机的 MAC 地址（优先使用物理MAC地址）
 * @returns {string|null} 返回第一个有效的 MAC 地址，如果获取失败则返回 null
 */
function getMacAddress() {
    try {
        // Windows系统：优先使用系统命令获取物理MAC地址
        if (process.platform === 'win32') {
            const physicalMac = getPhysicalMacAddressWindows();
            if (physicalMac) {
                return physicalMac;
            }
        }
        
        // 备用方案：使用os.networkInterfaces()（可能包含虚拟适配器）
        const networkInterfaces = os.networkInterfaces();
        
        // 优先查找以太网适配器
        const preferredNames = ['以太网', 'Ethernet', '本地连接', '本地连接*', 'en0'];
        for (const preferredName of preferredNames) {
            if (networkInterfaces[preferredName]) {
                for (const iface of networkInterfaces[preferredName]) {
                    if (iface.mac && iface.mac !== '00:00:00:00:00:00' && !iface.internal) {
                        return iface.mac.toUpperCase();
                    }
                }
            }
        }
        
        // 遍历所有网络接口，跳过虚拟适配器常见名称
        const virtualKeywords = ['virtual', 'vmware', 'virtualbox', 'hyper-v', 'vbox', 'bluetooth', 'wireless'];
        for (const interfaceName in networkInterfaces) {
            const lowerName = interfaceName.toLowerCase();
            // 跳过明显是虚拟适配器的接口
            if (virtualKeywords.some(keyword => lowerName.includes(keyword))) {
                continue;
            }
            
            const interfaces = networkInterfaces[interfaceName];
            for (const iface of interfaces) {
                // 跳过内部（即 127.0.0.1）和非 IPv4 地址
                if (iface.family === 'IPv4' && !iface.internal) {
                    if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
                        return iface.mac.toUpperCase();
                    }
                }
            }
        }
        
        // 如果没找到，返回第一个非内部的 MAC 地址
        for (const interfaceName in networkInterfaces) {
            const interfaces = networkInterfaces[interfaceName];
            for (const iface of interfaces) {
                if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                    return iface.mac.toUpperCase();
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

