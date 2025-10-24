// 软件标识（直接写入）
const Softid = '6G6G7V8C2T9L9U8A';

// 版本号（直接写入）
const Version = '1.0';

// 本地版本号（用于版本对比，直接写入）
const LocalVersion = 'v1.0.0';

// 从配置文件导入Card常量
const fs = require('fs');
const path = require('path');

// 获取配置对象
function getConfig() {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error('读取config.json文件时出错:', error.message);
      return {};
    }
  }
  return {};
}

// 获取配置文件路径
function getConfigPath() {
  // 如果是打包环境，使用 process.resourcesPath 获取应用程序目录
  // 如果是开发环境，使用 __dirname
  if (process.resourcesPath) {
    // 打包环境：返回应用程序根目录
    // 在 Electron 打包后，process.resourcesPath 指向 resources 目录
    // 我们需要获取应用程序的安装目录
    const appPath = process.resourcesPath.replace(/[\\/]resources$/, '');
    return path.join(appPath, 'config.json');
  } else {
    // 开发环境：返回当前文件所在目录
    return path.join(__dirname, 'config.json');
  }
}

// 动态获取Card值，每次调用时都重新读取配置文件
function getCard() {
  const configPath = getConfigPath();
  console.log('[调试] 配置文件路径:', configPath);
  console.log('[调试] 配置文件是否存在:', fs.existsSync(configPath));
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.Card || '';
    } catch (error) {
      console.error('读取config.json文件时出错:', error.message);
      return '';
    }
  }
  return '';
}

// 导入日志系统
const logger = require('./logger');

// 导入其他模块
const { getMacAddress } = require('./model/get_mac');
const { login } = require('./model/login');
const { getErrorMessage } = require('./model/error_code');
const { getExpireTimeWithGlobalVars } = require('./model/get_time');
const { getVersionName } = require('./model/get_version');

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
        
        // 2. 动态获取Card值
        const currentCard = getCard();
        console.log(`当前使用的Card值: "${currentCard}" (长度: ${currentCard.length})`);
        
        // 3. 执行登录
        const loginResult = await login(Softid, currentCard, Version, macAddress);
        
        // 3. 处理登录结果
        if (loginResult.success && loginResult.isToken && loginResult.token) {
            console.log(`Token: ${loginResult.token}`);
            
            // 登录成功后获取到期时间
            try {
                const expireTimeResult = await getExpireTimeWithGlobalVars();
                
                if (expireTimeResult.success) {
                    console.log(`到期时间: ${expireTimeResult.expireTime}`);
                    loginResult.expireTime = expireTimeResult.expireTime;
                } else {
                    if (expireTimeResult.errorCode) {
                        const errorMessage = getErrorMessage(expireTimeResult.errorCode);
                        console.log(`获取到期时间失败: ${errorMessage} (错误码: ${expireTimeResult.errorCode})`);
                    }
                }
            } catch (error) {
                console.log(`获取到期时间时发生异常: ${error.message}`);
            }
            
            // 登录成功后获取版本号名称并与本地版本对比
            try {
                const versionResult = await getVersionName(Softid, currentCard, loginResult.token, Version);
                
                if (versionResult.success) {
                    const remoteVersionName = versionResult.versionName || versionResult.data;
                    
                    // 调试信息：显示实际获取到的版本号名称
                    console.log(`[调试] 本地版本号名称: "${LocalVersion}"`);
                    console.log(`[调试] 远程版本号名称: "${remoteVersionName}"`);
                    console.log(`[调试] 版本对比结果: ${remoteVersionName !== LocalVersion ? '有新版本' : '版本相同'}`);
                    
                    // 版本对比
                    if (remoteVersionName !== LocalVersion) {
                        console.log('有新版本');
                        console.log(`最新版本: ${remoteVersionName}`);
                        console.log('请及时更新软件以获得更好的体验!');
                        loginResult.hasNewVersion = true;
                        loginResult.remoteVersion = remoteVersionName;
                        loginResult.localVersion = LocalVersion;
                    } else {
                        console.log('登录成功');
                        console.log('当前已是最新版本');
                        loginResult.hasNewVersion = false;
                    }
                } else {
                    if (versionResult.errorCode) {
                        const errorMessage = getErrorMessage(versionResult.errorCode);
                        console.log(`获取版本信息失败: ${errorMessage} (错误码: ${versionResult.errorCode})`);
                    }
                }
            } catch (error) {
                console.log(`检查版本更新时发生异常: ${error.message}`);
            }
            

            
            return loginResult;
        } else {
            if (loginResult.errorCode) {
                const errorMessage = getErrorMessage(loginResult.errorCode);
                console.log(`登录失败: ${errorMessage} (错误码: ${loginResult.errorCode})`);
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