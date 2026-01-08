const os = require('os');
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 配置文件路径（由外部设置）
let configFilePath = null;

/**
 * 设置配置文件路径
 * @param {string} filePath - 配置文件路径
 */
function setConfigFilePath(filePath) {
    configFilePath = filePath;
}

/**
 * 从配置文件读取机器码
 * @returns {string|null} 返回配置中的机器码，如果不存在或读取失败则返回 null
 */
function readCachedMachineId() {
    if (!configFilePath) {
        return null;
    }
    try {
        if (!fs.existsSync(configFilePath)) {
            return null;
        }
        const content = fs.readFileSync(configFilePath, 'utf8');
        const config = JSON.parse(content);
        // 从配置文件中读取 machineId
        if (config && config.machineId && typeof config.machineId === 'string' && config.machineId.length > 0) {
            return config.machineId;
        }
        return null;
    } catch (error) {
        console.error('从配置文件读取机器码失败:', error);
        return null;
    }
}

/**
 * 保存机器码到配置文件
 * @param {string} machineId - 要保存的机器码
 * @returns {boolean} 保存是否成功
 */
function saveCachedMachineId(machineId) {
    if (!configFilePath) {
        console.error('配置文件路径未设置，无法保存机器码');
        return false;
    }
    try {
        const dir = path.dirname(configFilePath);
        // 确保目录存在
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // 读取现有配置
        let config = {};
        if (fs.existsSync(configFilePath)) {
            try {
                const content = fs.readFileSync(configFilePath, 'utf8');
                config = JSON.parse(content);
            } catch (e) {
                // 如果读取失败，使用空配置
                config = {};
            }
        }
        
        // 更新机器码
        config.machineId = machineId;
        
        // 保存配置
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('保存机器码到配置文件失败:', error);
        return false;
    }
}

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
 * 首次获取后会缓存到文件，后续直接读取缓存。
 */
function getMachineId() {
    try {
        // 先尝试从缓存读取
        const cached = readCachedMachineId();
        if (cached) {
            return cached;
        }
        
        // 缓存不存在，获取新的机器码
        const raw = getMachineIdRaw();
        if (!raw) {
            console.error('无法获取 MachineGuid');
            return null;
        }
        
        const hash = crypto.createHash('sha256').update(raw, 'utf8').digest('hex').toUpperCase();
        // 截取前32位，符合多数"机器码<=32位字母数字"的要求
        const machineId = hash.slice(0, 32);
        
        // 保存到缓存文件
        saveCachedMachineId(machineId);
        
        return machineId;
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
    getMachineIdRaw,
    // 设置配置文件路径，用于保存和读取机器码
    setConfigFilePath
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

