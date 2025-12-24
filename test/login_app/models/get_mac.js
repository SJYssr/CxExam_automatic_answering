const os = require('os');
const { execSync } = require('child_process');
const crypto = require('crypto');


/**
 * 安全执行命令，失败返回空串
 */
function safeExec(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf8', timeout: 3000 });
    } catch (_) {
        return '';
    }
}

/**
 * 获取机器码原始串：仅使用 Windows MachineGuid
 * 如果获取失败，返回空字符串
 */
function getMachineIdRaw() {
    if (process.platform !== 'win32') {
        return '';
    }

    // 只获取 MachineGuid（注册表）
    const regOut = safeExec('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid');
    if (regOut) {
        const m = regOut.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
        if (m && m[1]) {
            const machineGuid = m[1].trim();
            if (machineGuid && machineGuid.length > 0) {
                return machineGuid;
            }
        }
    }

    // MachineGuid 获取失败，返回空字符串
    return '';
}

/**
 * 对 MachineGuid 做哈希，生成稳定的机器码（32位十六进制，大写）。
 * 仅使用 Windows MachineGuid，如果获取失败则返回 null。
 */
function getMachineId() {
    try {
        const raw = getMachineIdRaw();
        if (!raw) {
            console.error('无法获取 MachineGuid');
            return null;
        }
        
        const hash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex').toUpperCase();
        // 截取前32位，符合多数“机器码<=32位字母数字”的要求
        return hash.slice(0, 32);
    } catch (e) {
        console.error('生成机器码失败:', e);
        return null;
    }
}

/**
 * 兼容旧接口：仍然暴露 getMacAddress，但内部返回 machineId，
 * 保证 main.js 等现有代码无须修改即可使用新的机器码策略。
 */
function getMacAddress() {
    return getMachineId();
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
    formatMacAddress,
    // 如需直接使用未哈希的机器信息，可导出 getMachineId / getMachineIdRaw
    getMachineId,
    getMachineIdRaw
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

