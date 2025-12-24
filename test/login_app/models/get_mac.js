const os = require('os');
const { execSync } = require('child_process');
const crypto = require('crypto');

/**
 * 基于网卡信息获取“物理 MAC”（排除明显虚拟/隧道/回环），作为兜底方案。
 * 仅依赖 os.networkInterfaces，跨平台，无外部命令。
 */
function getPhysicalMacFromInterfaces() {
    const networkInterfaces = os.networkInterfaces();
    const excludeKeywords = [
        // 明确的虚拟/桥接/容器/隧道/回环接口
        'virtual', 'vmware', 'vmnet', 'virtualbox', 'vbox', 'hyper-v',
        'vethernet', 'veth', 'br-', 'docker', 'podman', 'nat',
        'loopback', 'lo', 'tap', 'tun', 'pptp', 'l2tp', 'ppp',
        'isatap', 'teredo'
    ].map(k => k.toLowerCase());

    const isVirtualLike = (name) => {
        const lower = (name || '').toLowerCase();
        return excludeKeywords.some(k => lower.includes(k));
    };

    const candidates = [];
    const seen = new Set();

    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            const mac = (iface && iface.mac) ? iface.mac.toUpperCase() : '';
            if (!mac || mac === '00:00:00:00:00:00') continue;
            if (seen.has(mac)) continue;
            seen.add(mac);
            candidates.push({
                mac,
                internal: !!iface.internal,
                virtualLike: isVirtualLike(interfaceName)
            });
        }
    }

    const pick = (fn) => {
        const hit = candidates.find(fn);
        return hit ? hit.mac : null;
    };

    return (
        pick(c => !c.internal && !c.virtualLike) ||
        pick(c => !c.virtualLike) ||
        pick(c => !c.internal) ||
        pick(() => true) ||
        null
    );
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
 * 获取 Windows 下的多源硬件标识（可能包含 MachineGuid、主板 SN、磁盘 SN 等）
 */
function getWindowsHardwareIdRaw() {
    if (process.platform !== 'win32') return '';

    let machineGuid = '';
    let baseboardSN = '';
    let biosSN = '';
    let diskSN = '';

    // MachineGuid（注册表）
    const regOut = safeExec('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid');
    if (regOut) {
        const m = regOut.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
        if (m && m[1]) machineGuid = m[1].trim();
    }

    // 主板序列号
    const baseboardOut = safeExec('wmic baseboard get SerialNumber /value');
    if (baseboardOut) {
        const m = baseboardOut.match(/SerialNumber=([^\r\n]+)/i);
        if (m && m[1]) baseboardSN = m[1].trim();
    }

    // BIOS 序列号
    const biosOut = safeExec('wmic bios get SerialNumber /value');
    if (biosOut) {
        const m = biosOut.match(/SerialNumber=([^\r\n]+)/i);
        if (m && m[1]) biosSN = m[1].trim();
    }

    // 磁盘序列号（系统盘优先）
    const diskOut = safeExec('wmic diskdrive get SerialNumber /value');
    if (diskOut) {
        const m = diskOut.match(/SerialNumber=([^\r\n]+)/i);
        if (m && m[1]) diskSN = m[1].trim();
    }

    const parts = [machineGuid, baseboardSN, biosSN, diskSN]
        .map(x => (x || '').trim())
        .filter(x => x.length > 0);

    return parts.join('|');
}

/**
 * 获取一个“机器码”原始串：
 * - Windows：优先使用 MachineGuid/主板/BIOS/磁盘 等组合
 * - 其它系统：使用 主机名 + 平台信息 + 物理 MAC 组合
 */
function getMachineIdRaw() {
    let raw = '';

    if (process.platform === 'win32') {
        raw = getWindowsHardwareIdRaw();
    }

    // 非 Windows 或 Windows 上硬件信息获取失败时，兜底
    if (!raw) {
        const host = os.hostname() || '';
        const platform = os.platform() || '';
        const arch = os.arch() || '';
        const mac = getPhysicalMacFromInterfaces() || '';
        raw = [host, platform, arch, mac].filter(x => x).join('|');
    }

    return raw;
}

/**
 * 对原始机器信息做哈希，生成稳定的机器码（32位十六进制，大写）。
 * 该机器码可用于绑定，比裸 MAC 干扰更少。
 */
function getMachineId() {
    try {
        const raw = getMachineIdRaw();
        if (!raw) return null;
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

