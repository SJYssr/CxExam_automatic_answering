// 软件标识（直接写入）
const Softid = '6G6G7V8C2T9L9U8A';

// 版本号（直接写入）
const Version = '1.0';

// 本地版本号（用于版本对比，直接写入）
const LocalVersion = 'v1.0.0';

// 从配置文件导入Card常量
const { Card } = require('./config');

// 导入其他模块
const { getMacAddress } = require('./model/get_mac');
const { login } = require('./model/login');
const { getErrorMessage } = require('./model/error_code');
const { getExpireTimeWithGlobalVars } = require('./model/get_time');
const { getVersionName } = require('./model/get_version');
const { getAuthorized } = require('./model/get_authorized');
const { saveAuthorizedToCache } = require('./model/cache');

/**
 * 执行登录流程
 * 1. 获取MAC地址
 * 2. 使用Softid、Card、Version和MAC地址进行登录
 * 3. 如果登录失败，显示具体的错误原因
 */
async function executeLoginProcess() {
    
    try {
        // 1. 获取MAC地址
        const macAddress = getMacAddress();
        
        // 2. 执行登录
        const loginResult = await login(Softid, Card, Version, macAddress);
        
        // 3. 处理登录结果
        if (loginResult.success) {
            console.log('登录成功');
            // console.log(`Token: ${loginResult.token}`);
            
            // 登录成功后获取到期时间
            try {
                const expireTimeResult = await getExpireTimeWithGlobalVars();
                
                if (expireTimeResult.success) {
                    console.log(`到期时间: ${expireTimeResult.expireTime}`);
                    loginResult.expireTime = expireTimeResult.expireTime;
                } else {
                    if (expireTimeResult.errorCode) {
                        console.log(`错误信息: ${expireTimeResult.errorCode||expireTimeResult.errorCode||expireTimeResult.errorMessage || expireTimeResult.error}`);
                    }
                }
            } catch (error) {
                console.log(`获取到期时间时发生异常: ${error.message}`);
            }
            
            // 登录成功后获取版本号名称并与本地版本对比
            try {
                const versionResult = await getVersionName(Softid, Card, loginResult.token, Version);
                
                if (versionResult.success) {
                    const remoteVersionName = versionResult.versionName || versionResult.data;
                    
                    // 版本对比
                    if (remoteVersionName !== LocalVersion) {
                        console.log(`最新版本: ${remoteVersionName}`);
                        console.log('请及时更新软件以获得更好的体验!');
                        loginResult.hasNewVersion = true;
                        loginResult.remoteVersion = remoteVersionName;
                        loginResult.localVersion = LocalVersion;
                    } else {
                        console.log('当前已是最新版本');
                        loginResult.hasNewVersion = false;
                    }
                } else {
                    if (versionResult.errorCode) {
                        console.log(`获取版本信息失败: ${versionResult.errorCode||versionResult.errorMessage || versionResult.error}`);
                    }
                }
            } catch (error) {
                console.log(`检查版本更新时发生异常: ${error.message}`);
            }
            
            // 登录成功后获取核心数据
            try {
                const authorizedResult = await getAuthorized(Softid, Card, loginResult.token);
                
                if (authorizedResult.success) {
                    let authorizedData = '';
                    
                    if (authorizedResult.isAuthorized) {
                        authorizedData = authorizedResult.authorized;
                        // console.log(`授权: ${authorizedData}`);
                    } else {
                        authorizedData = authorizedResult.data;
                        // console.log(`授权: ${authorizedData}`);
                    }
                    
                    // 将核心数据保存到缓存文件中
                    const saveResult = saveAuthorizedToCache(authorizedData);
                    if (saveResult) {
                        console.log('授权成功');
                    } else {
                        console.log('授权失败');
                    }
                    
                    loginResult.authorized = authorizedData;
                } else {
                    if (authorizedResult.errorCode) {
                        console.log(`获取授权失败: ${authorizedResult.errorCode||authorizedResult.errorMessage || authorizedResult.error}`);
                    }
                }
            } catch (error) {
                console.log(`获取授权时发生异常: ${error.message}`);
            }
            
            return loginResult;
        } else {
            if (loginResult.errorCode) {
                console.log(`登录失败: ${loginResult.errorCode||loginResult.errorMessage || loginResult.error}`);;
            }
            return loginResult;
        }
        
    } catch (error) {

        console.log(`登录过程中发生异常：${error.message}`);
        
        return {
            success: false,
            error: error.message,
            message: '登录过程异常'
        };
    }
}

// 如果直接运行此文件，则执行登录流程
if (require.main === module) {
    (async () => {
        const result = await executeLoginProcess();
        
        // 根据结果设置退出码
        if (result.success) {
            process.exit(0); // 成功退出
        } else {
            process.exit(1); // 失败退出
        }
    })();
}

// 导出模块
module.exports = {
    getMacAddress,
    executeLoginProcess
};