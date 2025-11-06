const { getMacAddress } = require('./models/get_mac');

// 全局变量定义
var Sofitid = '5U3T6Z4W4E6K9B9S';
var Card = '';
var Local_VersionName = 'v1.0.0';
var Local_Version = '1.0';
var Target_address = '';
var Mac = getMacAddress() || '';
// 归一化 Mac：仅保留字母数字，并限制最大32位
Mac = (Mac || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);

// 登录流程：
// 1) 通过 get_time 获取卡到期时间，与网络时间比较，未到期才继续
// 2) 通过 login 执行单码登录，拿到 Token
// 3) 通过 get_VersionName 获取版本号名称，与 Local_VersionName 比较；不一致则视为失败（有新版本）
const http = require('http');
const { getExpireTime } = require('./models/get_time');
const { login } = require('./models/login');
const { getVersionName } = require('./models/get_VersionName');

function fetchNetworkTime() {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'api.1wxyun.com',
            method: 'HEAD',
            path: '/',
            port: 80
        }, (res) => {
            const dateHeader = res.headers && res.headers['date'];
            if (dateHeader) {
                const d = new Date(dateHeader);
                if (!isNaN(d.getTime())) return resolve(d);
            }
            // 兜底使用本地时间
            resolve(new Date());
        });
        req.on('error', () => resolve(new Date()));
        req.end();
    });
}

function parseExpireTime(expireStr) {
    if (!expireStr) return null;
    // 尝试兼容常见格式，如: YYYY-MM-DD HH:mm:ss / YYYY/MM/DD HH:mm:ss 等
    const normalized = expireStr.replace(/-/g, '/');
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;
    // 再尝试直接 Date.parse
    const ts = Date.parse(expireStr);
    if (!isNaN(ts)) return new Date(ts);
    return null;
}

async function performLoginFlow() {
    // 步骤 1：校验到期时间
    const timeResult = await getExpireTime();
    if (!timeResult.success) {
        // -83013 单码卡密未激活，直接执行登录
        if (timeResult.errorCode === '-83013') {
            // 继续后续流程
        } else {
            return {
                success: false,
                step: 'get_time',
                message: timeResult.errorMessage || '获取到期时间失败',
                detail: timeResult
            };
        }
    }

    if (timeResult.success) {
        const networkTime = await fetchNetworkTime();
        const expireDate = parseExpireTime(timeResult.expireTime);
        if (!expireDate) {
            return {
                success: false,
                step: 'get_time',
                message: `无法解析到期时间: ${timeResult.expireTime}`,
                detail: timeResult
            };
        }

        if (networkTime.getTime() > expireDate.getTime()) {
            return {
                success: false,
                step: 'expired',
                message: '卡密已到期',
                expireTime: timeResult.expireTime
            };
        }
    }

    // 步骤 2：登录
    const loginResult = await login();
    if (!loginResult.success) {
        return {
            success: false,
            step: 'login',
            message: loginResult.errorMessage || '登录失败',
            detail: loginResult
        };
    }

    const token = loginResult.token;

    // 步骤 3：获取版本名称并比较
    const versionNameResult = await getVersionName(token);
    if (!versionNameResult.success) {
        return {
            success: false,
            step: 'get_version_name',
            message: versionNameResult.errorMessage || '获取版本号名称失败',
            detail: versionNameResult
        };
    }

    const remoteVersionName = versionNameResult.versionName;
    if (remoteVersionName !== Local_VersionName) {
        return {
            success: false,
            step: 'version_mismatch',
            message: '有新版本',
            localVersionName: Local_VersionName,
            remoteVersionName: remoteVersionName
        };
    }

    return {
        success: true,
        step: 'done',
        token,
        versionName: remoteVersionName,
        expireTime: (timeResult && timeResult.success) ? timeResult.expireTime : ''
    };
}

function setConfig(partial) {
    if (!partial || typeof partial !== 'object') return;
    if (partial.Sofitid !== undefined) Sofitid = String(partial.Sofitid);
    if (partial.Card !== undefined) Card = String(partial.Card);
    if (partial.Local_VersionName !== undefined) Local_VersionName = String(partial.Local_VersionName);
    if (partial.Local_Version !== undefined) Local_Version = String(partial.Local_Version);
    if (partial.Target_address !== undefined) Target_address = String(partial.Target_address);
    if (partial.Mac !== undefined) {
        Mac = String(partial.Mac).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
    }
}

// 将变量与流程方法导出（变量使用 getter，确保 setConfig 后可被其它模块读取到最新值）
module.exports = {
    performLoginFlow,
    setConfig
};

Object.defineProperties(module.exports, {
    Sofitid: { get: () => Sofitid },
    Card: { get: () => Card },
    Local_VersionName: { get: () => Local_VersionName },
    Local_Version: { get: () => Local_Version },
    Target_address: { get: () => Target_address },
    Mac: { get: () => Mac }
});

