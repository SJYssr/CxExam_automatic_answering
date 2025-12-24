const { execSync } = require('child_process');
const os = require('os');

/**
 * 使用Windows命令获取真正连接到网络的物理网卡MAC地址
 * @returns {string|null} 返回第一个连接到网络的物理网卡MAC地址，如果获取失败则返回 null
 */
function getPhysicalMacAddressWindows() {
    try {
        // 使用 wmic 命令获取物理适配器且已启用的详细信息（包括名称和MAC地址）
        // PhysicalAdapter=true: 只获取物理适配器（排除虚拟适配器）
        // NetEnabled=true: 只获取已启用的适配器
        const command = 'wmic path win32_networkadapter where "PhysicalAdapter=true and NetEnabled=true" get Name,MACAddress /format:list';
        const output = execSync(command, { encoding: 'utf8', timeout: 5000, windowsHide: true });
        
        // 排除虚拟适配器的关键词（包括Hyper-V）
        const excludeKeywords = ['hyper-v', 'vEthernet', 'vmware', 'virtualbox', 'vbox', 'virtual', 'bluetooth', '无线', 'wireless', 'wwan', 'pseudo', 'loopback', 'tunnel', 'teredo', 'isatap'];
        
        // 解析输出，获取适配器名称和MAC地址的对应关系
        const adapters = [];
        let currentAdapter = {};
        
        const lines = output.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            const nameMatch = trimmedLine.match(/^Name=(.+)$/);
            const macMatch = trimmedLine.match(/^MACAddress=(.+)$/);
            
            if (nameMatch) {
                const adapterName = nameMatch[1].trim();
                const lowerName = adapterName.toLowerCase();
                
                // 如果已经有一个完整的适配器信息，且不是虚拟适配器，保存它
                if (currentAdapter.mac && currentAdapter.name) {
                    const lowerCurrentName = currentAdapter.name.toLowerCase();
                    if (!excludeKeywords.some(keyword => lowerCurrentName.includes(keyword))) {
                        adapters.push(currentAdapter);
                    }
                }
                
                // 检查新适配器名称，如果不是虚拟适配器，开始收集
                if (!excludeKeywords.some(keyword => lowerName.includes(keyword))) {
                    currentAdapter = { name: adapterName, mac: null };
                } else {
                    // 是虚拟适配器，跳过
                    currentAdapter = {};
                }
            } else if (macMatch && currentAdapter.name) {
                const mac = macMatch[1].trim();
                if (mac && /^[0-9A-F]{12}$/i.test(mac.replace(/[:-]/g, ''))) {
                    currentAdapter.mac = mac;
                }
            } else if (trimmedLine === '') {
                // 空行表示一个适配器信息结束
                if (currentAdapter.mac && currentAdapter.name) {
                    adapters.push(currentAdapter);
                }
                currentAdapter = {};
            }
        }
        
        // 保存最后一个适配器（如果有效）
        if (currentAdapter.mac && currentAdapter.name) {
            const lowerName = currentAdapter.name.toLowerCase();
            if (!excludeKeywords.some(keyword => lowerName.includes(keyword))) {
                adapters.push(currentAdapter);
            }
        }
        
        const physicalAdapters = adapters;
        
        // 如果有多个物理适配器，优先选择有实际网络连接的（通过ipconfig获取）
        if (physicalAdapters.length > 0) {
            try {
                // 获取有IP地址的适配器MAC地址
                const ipconfigCommand = 'ipconfig /all';
                const ipconfigOutput = execSync(ipconfigCommand, { encoding: 'utf8', timeout: 5000, windowsHide: true });
                
                // 查找有实际IP地址（非169.254.x.x自动配置地址）的适配器
                for (const adapter of physicalAdapters) {
                    const macPattern = adapter.mac.replace(/[:-]/g, '-').toUpperCase();
                    // 在ipconfig输出中查找该MAC地址对应的适配器部分
                    const macIndex = ipconfigOutput.indexOf(macPattern);
                    if (macIndex !== -1) {
                        // 查找该适配器的IP地址部分
                        const adapterSection = ipconfigOutput.substring(Math.max(0, macIndex - 500), macIndex + 1000);
                        // 查找IPv4地址（排除169.254.x.x自动配置地址和私有地址段，但允许192.168、10、172.16-31）
                        const ipv4Match = adapterSection.match(/IPv4[^\r\n]*?:\s*(\d+\.\d+\.\d+\.\d+)/i);
                        if (ipv4Match && ipv4Match[1]) {
                            const ip = ipv4Match[1];
                            // 排除169.254.x.x（自动配置地址，通常表示没有真正连接）
                            if (!ip.startsWith('169.254.')) {
                                // 返回标准格式（带冒号）
                                const cleanMac = adapter.mac.replace(/[:-]/g, '');
                                return cleanMac.match(/.{1,2}/g).join(':').toUpperCase();
                            }
                        }
                    }
                }
                
                // 如果没找到有IP的，返回第一个物理适配器
                const cleanMac = physicalAdapters[0].mac.replace(/[:-]/g, '');
                return cleanMac.match(/.{1,2}/g).join(':').toUpperCase();
            } catch (e) {
                // ipconfig失败，直接返回第一个物理适配器
                const cleanMac = physicalAdapters[0].mac.replace(/[:-]/g, '');
                return cleanMac.match(/.{1,2}/g).join(':').toUpperCase();
            }
        }
        
        return null;
    } catch (error) {
        // 如果wmic失败，尝试使用getmac命令结合ipconfig
        try {
            const getmacCommand = 'getmac /v /fo csv';
            const getmacOutput = execSync(getmacCommand, { encoding: 'utf8', timeout: 5000, windowsHide: true });
            
            // 获取有IP地址的适配器信息
            const ipconfigCommand = 'ipconfig /all';
            const ipconfigOutput = execSync(ipconfigCommand, { encoding: 'utf8', timeout: 5000, windowsHide: true });
            
            const excludeKeywords = ['hyper-v', 'vEthernet', 'vmware', 'virtualbox', 'vbox', 'virtual', 'bluetooth', '无线', 'wireless'];
            const lines = getmacOutput.split('\n');
            
            for (const line of lines) {
                // CSV格式: "连接名","网络适配器","物理地址","传输名称"
                const csvMatch = line.match(/"([^"]+)","([^"]+)","([0-9A-F]{2}(?:[:-][0-9A-F]{2}){5})"/i);
                if (csvMatch) {
                    const adapterName = csvMatch[2].toLowerCase();
                    const mac = csvMatch[3];
                    
                    // 排除虚拟适配器
                    if (excludeKeywords.some(keyword => adapterName.includes(keyword))) {
                        continue;
                    }
                    
                    // 检查该MAC地址对应的适配器是否有IP地址
                    const macPattern = mac.replace(/[:-]/g, '-').toUpperCase();
                    const macIndex = ipconfigOutput.indexOf(macPattern);
                    if (macIndex !== -1) {
                        const adapterSection = ipconfigOutput.substring(Math.max(0, macIndex - 500), macIndex + 1000);
                        const ipv4Match = adapterSection.match(/IPv4[^\r\n]*?:\s*(\d+\.\d+\.\d+\.\d+)/i);
                        if (ipv4Match && ipv4Match[1] && !ipv4Match[1].startsWith('169.254.')) {
                            const cleanMac = mac.replace(/[:-]/g, '');
                            return cleanMac.match(/.{1,2}/g).join(':').toUpperCase();
                        }
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
        
        // 遍历所有网络接口，跳过虚拟适配器常见名称（包括Hyper-V）
        const virtualKeywords = ['virtual', 'vmware', 'virtualbox', 'hyper-v', 'vEthernet', 'vbox', 'bluetooth', 'wireless', 'wwan', 'pseudo', 'loopback', 'tunnel', 'teredo', 'isatap'];
        for (const interfaceName in networkInterfaces) {
            const lowerName = interfaceName.toLowerCase();
            // 跳过明显是虚拟适配器的接口
            if (virtualKeywords.some(keyword => lowerName.includes(keyword))) {
                continue;
            }
            
            const interfaces = networkInterfaces[interfaceName];
            for (const iface of interfaces) {
                // 跳过内部（即 127.0.0.1）和非 IPv4 地址
                // 同时排除169.254.x.x（自动配置地址，通常表示没有真正连接）
                if (iface.family === 'IPv4' && !iface.internal) {
                    if (iface.address && !iface.address.startsWith('169.254.')) {
                        if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
                            return iface.mac.toUpperCase();
                        }
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

