const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/** 设备 ID 最大长度（仅字母数字） */
const MAX_DEVICE_ID_LEN = 32;

/**
 * 生成符合要求的设备 ID：不超过 32 位的字母或数字（使用 UUID v4 去掉横线，正好 32 位十六进制）
 * @returns {string}
 */
function generateDeviceId() {
    return uuidv4().replace(/-/g, '');
}

/**
 * 规范化设备 ID：仅保留字母数字并截断到最大长度
 * @param {string} raw
 * @returns {string}
 */
function normalizeDeviceId(raw) {
    if (typeof raw !== 'string' || !raw) return '';
    return raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, MAX_DEVICE_ID_LEN);
}

/**
 * 获取或创建设备 ID。设备 ID 存放在用户目录下的 .elappid 文件中，
 * 安装/卸载应用时该文件不随应用删除，故设备 ID 保持不变。
 * @param {string} userHomePath - 用户主目录，如 app.getPath('home')
 * @returns {string} 设备 ID（不超过 32 位字母或数字），失败返回空字符串
 */
function getOrCreateDeviceId(userHomePath) {
    if (!userHomePath || typeof userHomePath !== 'string') {
        console.error('getOrCreateDeviceId: 未提供用户目录路径');
        return '';
    }
    const appidPath = path.join(userHomePath, '.elappid');
    try {
        if (!fs.existsSync(appidPath)) {
            const deviceId = generateDeviceId();
            fs.writeFileSync(appidPath, deviceId, 'utf8');
            return deviceId;
        }
        let appid = fs.readFileSync(appidPath, 'utf8');
        appid = normalizeDeviceId(appid.trim());
        if (appid.length === 0) {
            const deviceId = generateDeviceId();
            fs.writeFileSync(appidPath, deviceId, 'utf8');
            return deviceId;
        }
        return appid;
    } catch (e) {
        console.error('getOrCreateDeviceId 失败:', e);
        return '';
    }
}

module.exports = {
    getOrCreateDeviceId,
    generateDeviceId,
    normalizeDeviceId
};
