const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 导入日志系统
const logger = require('./logger');

// 后端服务进程引用
let backendProcess = null;

// 进程监控相关变量
let processMonitorInterval = null;
let targetProcessPath = null;
let targetDllPath = null;
let lastProcessStatus = null; // 记录上一次进程状态，用于简化日志输出
let isExiting = false; // 防止重复退出应用程序的标志

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 580,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // 预加载脚本，用于窗口拖拽和控制
      nodeIntegration: true, // 允许在渲染进程中使用 Node.js API
      contextIsolation: false // 禁用上下文隔离，方便开发
    },
    frame: false, // 隐藏窗口边框和标题栏
    resizable: false, // 禁止调整窗口大小
    titleBarStyle: 'hidden' // 隐藏标题栏
  });

  // 处理文件选择对话框
  ipcMain.handle('select-file-path', async () => {
    try {
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [
          { name: '所有文件', extensions: ['*'] }
        ]
      });
      
      if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, filePath: result.filePaths[0] };
      } else {
        return { success: false, message: '用户取消了选择' };
      }
    } catch (error) {
      console.error('文件选择失败:', error.message);
      return { success: false, error: error.message };
    }
  });

  // 保存目标路径到config.json
  ipcMain.handle('save-target-path', async (event, targetPath) => {
    try {
      const configPath = getConfigPath();
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config.targetPath = targetPath;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      return { success: true };
    } catch (error) {
      console.error('保存目标路径失败:', error.message);
      return { success: false, error: error.message };
    }
  });

  // 复制winmm.dll文件到目标路径
ipcMain.handle('inject-winmm-dll', async (event, targetPath) => {
  try {
    const sourcePath = path.join(__dirname, 'winmm.dll');
    const targetDir = path.dirname(targetPath);
    const targetDllPath = path.join(targetDir, 'winmm.dll');
    
    // 检查源文件是否存在
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: '注入文件不存在' };
    }
    
    // 检查目标目录是否存在
    if (!fs.existsSync(targetDir)) {
      return { success: false, error: '目标目录不存在' };
    }
    
    // 复制文件（如果目标文件已存在则覆盖）
    fs.copyFileSync(sourcePath, targetDllPath);
    
    // 验证文件是否复制成功
    if (fs.existsSync(targetDllPath)) {
      const sourceStats = fs.statSync(sourcePath);
      const targetStats = fs.statSync(targetDllPath);
      
      if (sourceStats.size === targetStats.size) {
        // 注入成功，现在启动目标程序
                console.log('[注入] 注入成功，正在启动目标程序...');
        
        console.log('[启动] 正在启动目标程序...');
        
        // 直接启动目标程序，不使用spawn
        try {
          // 使用shell命令启动程序
          const { exec } = require('child_process');
          exec(`start "" "${targetPath}"`, (error, stdout, stderr) => {
            if (error) {
              console.error('[启动] 启动目标程序失败:', error);
              // 即使启动失败，也继续执行后续逻辑
            } else {
              console.log('[启动] 目标程序已启动:', targetPath);
            }
            
            // 启动进程监控
            startProcessMonitor(targetPath, targetDllPath);
          });
          
          // 立即返回成功结果，不等待程序启动完成
          return { 
            success: true, 
            message: `成功注入并启动: ${targetPath}`,
            targetPath: targetDllPath
          };
        } catch (error) {
          console.error('[启动] 启动目标程序异常:', error);
          
          // 即使启动异常，也继续执行后续逻辑
          startProcessMonitor(targetPath, targetDllPath);
          
          return { 
            success: true, 
            message: `成功注入，启动程序时出现异常但已继续执行: ${targetPath}`,
            targetPath: targetDllPath
          };
        }
      } else {
        return { 
          success: false, 
          error: '注入失败，文件大小不匹配' 
        };
      }
    } else {
      return { 
        success: false, 
        error: '注入失败，目标文件不存在' 
      };
    }
  } catch (error) {
    console.error('注入失败:', error.message);
    return { 
      success: false, 
      error: `注入失败: ${error.message}` 
    };
  }
});

  // 窗口拖拽功能
  let windowPosition = { x: 0, y: 0 };
  
  ipcMain.on('move-window', (event, { deltaX, deltaY }) => {
    const [currentX, currentY] = win.getPosition();
    win.setPosition(currentX + deltaX, currentY + deltaY);
  });
  
  // 窗口控制功能
ipcMain.on('close-window', () => {
  win.close();
});

ipcMain.on('minimize-window', () => {
  win.minimize();
});

ipcMain.on('hide-window', () => {
  win.hide();
});

  // 窗口加载完成后启动后端服务
  win.webContents.once('did-finish-load', async () => {
    console.log('[界面] 界面加载完成，正在启动服务...');
    const backendResult = await startBackendService();
    
    if (backendResult.success) {
      console.log('[界面] 服务启动成功');
      
      // 无论是否检测到server.js已在运行，都进行必要的初始化
      // 检查config.json中的Card值，如果为空则提示用户输入
      try {
        const configPath = getConfigPath();
        if (fs.existsSync(configPath)) {
          const configData = fs.readFileSync(configPath, 'utf8');
          const config = JSON.parse(configData);
          if (!config.Card || config.Card.trim() === '') {
            console.log('[界面] 检测到未设置密钥，等待用户输入...');
          } else {
            console.log('[界面] 检测到已设置密钥，可以执行自动登录...');
          }
        } else {
          console.log('[界面] 缓存文件不存在，等待用户输入...');
        }
      } catch (error) {
        console.error('[界面] 读取缓存时出错:', error.message);
      }
    } else {
      console.error('[界面] 服务启动失败:', backendResult.error);
    }
  });

  win.loadFile('index.html');
  // win.webContents.openDevTools(); // 打开开发者工具，方便调试
}

// 获取配置文件路径（兼容打包环境）
function getConfigPath() {
  // 在打包环境中，使用process.cwd()获取应用程序目录
  // 在开发环境中，使用__dirname
  const appDir = process.cwd();
  return path.join(appDir, 'config.json');
}

// 读取 config.json 文件中的配置值
ipcMain.handle('read-config', async () => {
  const configPath = getConfigPath();
  
  try {
    // 检查文件是否存在
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      return { 
        success: true, 
        card: config.Card || '',
        targetPath: config.targetPath || ''
      };
    } else {
      // 如果文件不存在，创建默认的 config.json
      const defaultConfig = { Card: '', targetPath: '' };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      return { 
        success: true, 
        card: '',
        targetPath: ''
      };
    }
  } catch (error) {
    console.error('读取 config.json 文件时出错:', error);
    return { success: false, error: error.message };
  }
});

// 保存 Card 值到 config.json
ipcMain.handle('save-config', async (event, cardValue) => {
  const configPath = getConfigPath();
  
  try {
    let config = {};
    
    // 如果文件存在，读取现有配置
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(configData);
    }
    
    // 更新 Card 值
    config.Card = cardValue;
    
    // 写入文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { success: true };
  } catch (error) {
    console.error('保存 config.json 文件时出错:', error);
    return { success: false, error: error.message };
  }
});

// 执行自动登录
ipcMain.handle('auto-login', async () => {
  const path = require('path');
  
  return new Promise(async (resolve) => {
    try {
      // 直接调用main.js中的函数，而不是通过spawn启动外部进程
      const mainModule = require('./main');
      
      // 执行自动登录逻辑
      const loginResult = await mainModule.executeLoginProcess();
      
      const result = {
        success: false,
        exitCode: -1,
        output: '',
        errorOutput: '',
        fullOutput: ''
      };
      
      // 处理登录结果 - 真正的登录成功应该是收到了有效的token
      if (loginResult.success && loginResult.isToken && loginResult.token) {
        // 检查是否有新版本
        if (loginResult.hasNewVersion) {
          // 有新版本时显示更新提示，但仍然返回token信息
          console.log('有新版本请更新');
          console.log(`最新版本: ${loginResult.remoteVersion}`);
          
          // 设置结果为特殊状态，表示需要更新，但仍然返回token
          result.success = true; // 改为true，表示版本检测成功
          result.exitCode = -2;
          result.output = '有新版本请更新';
          result.fullOutput = `有新版本请更新。当前版本: ${loginResult.localVersion}, 最新版本: ${loginResult.remoteVersion}`;
          result.hasNewVersion = true;
          result.remoteVersion = loginResult.remoteVersion;
          result.localVersion = loginResult.localVersion;
          result.token = loginResult.token; // 即使有新版本也返回token
        } else {
          // 版本一致时显示登录成功并发送token到后端
          console.log('登录成功');
          console.log('当前已是最新版本');
          
          result.token = loginResult.token;
          sendLoginStatusToBackend(true, loginResult.token);
          
          // 返回登录结果
          result.success = true;
          result.exitCode = 0;
          result.output = loginResult.message || '登录成功';
          result.fullOutput = loginResult.message || '登录成功';
          result.expireTime = loginResult.expireTime;
          result.hasNewVersion = loginResult.hasNewVersion;
          result.remoteVersion = loginResult.remoteVersion;
          result.localVersion = loginResult.localVersion;
        }
      } else {
        console.log('自动登录失败');
        
        // 如果登录失败，发送失败状态到后端
        sendLoginStatusToBackend(false, null);
        
        // 返回失败结果
        result.success = false;
        result.exitCode = -1;
        result.output = loginResult.message || '登录失败';
        result.errorOutput = loginResult.error || '';
        result.fullOutput = loginResult.message || loginResult.error || '登录失败';
        result.error = loginResult.error;
        result.errorCode = loginResult.errorCode;
      }
      
      resolve(result);
      
    } catch (error) {
      console.error('自动登录失败:', error.message);
      
      const result = {
        success: false,
        exitCode: -1,
        output: '',
        errorOutput: error.message,
        fullOutput: error.message
      };
      
      // 登录失败时发送重置状态
      sendLoginStatusToBackend(false, null);
      
      resolve(result);
    }
  });
});

// 检查是否已有server.js进程在运行
function isServerRunning() {
  return new Promise((resolve) => {
    // 由于现在server.js在主进程中运行，我们不需要检查外部进程
    // 直接返回false，让启动逻辑继续执行
    resolve(false);
  });
}

// 启动后端服务
function startBackendService() {
  return new Promise(async (resolve) => {
    // 首先检查是否已有server.js进程在运行
    const isRunning = await isServerRunning();
    
    if (isRunning) {
      console.log('[服务] 检测到server.js已在运行，跳过启动');
      resolve({ success: true, message: 'server.js已在运行' });
      return;
    }
    
    try {
      // 直接在主进程中运行server.js
      console.log('[服务] 正在启动后端服务...');
      
      // 导入server.js模块并启动服务
      const serverModule = require('./server');
      
      // 如果server.js导出了启动函数，则调用它
      if (typeof serverModule.startServer === 'function') {
        serverModule.startServer();
      }
      
      console.log('[服务] 后端服务启动成功');
      resolve({ success: true, message: '后端服务启动成功' });
      
    } catch (error) {
      console.error('[后端服务] 启动失败:', error.message);
      resolve({ success: false, error: error.message });
    }
  });
}

// 发送登录状态到后端
function sendLoginStatusToBackend(isLoggedIn, token) {
  // 等待后端服务启动完成
  setTimeout(() => {
    const url = 'http://localhost:3000/api/login-status';
    const data = {
      isLoggedIn: isLoggedIn,
      token: token
    };
    
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
      if (result.success) {
        console.log(`[登录状态] 发送成功: ${result.message}`);
      } else {
        console.log(`[登录状态] 发送失败: ${result.message}`);
      }
    })
    .catch(error => {
      console.error('[登录状态] 发送失败:', error.message);
    });
  }, 2000); // 延迟2秒确保后端服务已启动
}

// 检查进程是否在运行
function isProcessRunning(processPath) {
  return new Promise((resolve) => {
    // 方法1: 使用tasklist命令检查进程是否存在
    const { exec } = require('child_process');
    
    exec('tasklist /FI "IMAGENAME eq CXExam.exe" /FO CSV', (error, stdout, stderr) => {
      if (error) {
        console.error('检查进程状态失败:', error);
        // 如果tasklist失败，直接返回false
        resolve(false);
        return;
      }
      
      // 解析tasklist输出
      const lines = stdout.split('\n').filter(line => line.trim() && !line.includes('映像名称'));
      
      if (lines.length === 0) {
        // 没有找到CXExam.exe进程
        console.log('[进程检测] tasklist未找到CXExam.exe进程');
        resolve(false);
        return;
      }
      
      // 如果有进程，检查进程路径
      const processName = 'CXExam.exe';
      
      // 方法2: 使用wmic命令获取进程完整路径
      exec(`wmic process where "name='${processName}'" get executablepath`, (wmicError, wmicStdout, wmicStderr) => {
        if (wmicError) {
          console.error('wmic检查进程路径失败:', wmicError);
          // 如果wmic失败，使用tasklist结果
          console.log('[进程检测] wmic失败，使用tasklist结果');
          resolve(lines.length > 0);
          return;
        }
        
        // 解析wmic输出
        const wmicLines = wmicStdout.split('\n').filter(line => line.trim() && !line.includes('ExecutablePath'));
        
        // 只在wmic找到进程路径数量为0时输出日志
        if (wmicLines.length === 0) {
          console.log('[进程检测] wmic未找到任何进程路径');
          resolve(false);
          return;
        }
        
        // 检查是否有匹配的进程路径
        let foundMatch = false;
        let hasGarbledPath = false;
        
        wmicLines.forEach(line => {
          const fullPath = line.trim();
          if (fullPath) {
            // 更宽松的乱码检测：包含非ASCII字符且看起来像乱码
            const hasGarbledChars = /[^\x00-\x7F]/.test(fullPath) && 
                                   (fullPath.includes('?') || fullPath.includes('�') || 
                                    fullPath.includes('ѧ') || fullPath.includes('ϰ') || 
                                    fullPath.includes('�') || fullPath.includes('�'));
            
            if (hasGarbledChars) {
              hasGarbledPath = true;
              // 如果wmic返回乱码，但tasklist找到了进程，则认为进程在运行
              foundMatch = lines.length > 0;
            } else {
              // 更宽松的路径匹配逻辑
              const normalizedFullPath = fullPath.toLowerCase().replace(/\\/g, '/');
              const normalizedTargetPath = processPath.toLowerCase().replace(/\\/g, '/');
              
              if (normalizedFullPath.includes(normalizedTargetPath)) {
                foundMatch = true;
              }
            }
          }
        });
        
        // 只在未找到匹配时输出日志
        if (!foundMatch) {
          console.log('[进程检测] 未找到匹配的进程路径');
        }
        
        resolve(foundMatch);
      });
    });
  });
}

// 启动进程监控
function startProcessMonitor(processPath, dllPath) {
  targetProcessPath = processPath;
  targetDllPath = dllPath;
  
  console.log(`[进程监控] 开始监控进程: ${processPath}`);
  console.log(`[进程监控] 目标DLL路径: ${dllPath}`);
  
  // 立即检查一次进程状态
  checkProcessStatus(processPath);
  
  // 每5秒检查一次进程状态
  processMonitorInterval = setInterval(() => {
    checkProcessStatus(processPath);
  }, 5000);
}

// 检查进程状态
async function checkProcessStatus(processPath) {
  const isRunning = await isProcessRunning(processPath);
  
  if (isRunning) {
    // 只在状态变化时显示
    if (!lastProcessStatus) {
      console.log(`[进程监控] 目标进程正在运行`);
    }
    lastProcessStatus = true;
  } else {
    // 只在进程停止时输出日志
    if (lastProcessStatus !== false) {
      console.log('[进程监控] 目标进程已停止，等待确认...');
    }
    
    // 等待3秒后再次确认进程状态，避免误判
    setTimeout(async () => {
      const confirmedStopped = await isProcessRunning(processPath);
      
      if (!confirmedStopped) {
        console.log('[进程监控] 确认目标进程已停止，开始清理...');
        
        // 立即停止进程监控，防止重复触发
        stopProcessMonitor();
        
        // 清理DLL文件
        await cleanupDllFile();
        
        // 不再需要删除authorization.js文件（已弃用）
        
        // 删除tiku.json文件
        const tikuFilePath = path.join(process.cwd(), 'tiku.json');
        if (fs.existsSync(tikuFilePath)) {
          try {
            fs.unlinkSync(tikuFilePath);
            console.log('[进程监控] 已删除题库缓存');
          } catch (error) {
            console.error('[进程监控] 删除题库缓存失败:', error.message);
          }
        }
        
        // 设置标志，防止重复退出
        if (!isExiting) {
          isExiting = true;
          
          // 延迟退出应用程序，确保所有异步操作完成
          setTimeout(() => {
            console.log('[进程监控] 正在退出应用程序...');
            app.quit(); // 退出应用程序
          }, 2000); // 增加延迟时间，确保所有异步操作完成
        }
      } else {
        console.log('[进程监控] 目标进程重新运行，继续监控...');
        lastProcessStatus = true;
      }
    }, 3000);
    lastProcessStatus = false;
  }
}

// 停止进程监控
function stopProcessMonitor() {
  if (processMonitorInterval) {
    clearInterval(processMonitorInterval);
    processMonitorInterval = null;
    console.log('[进程监控] 进程监控已停止');
  }
}

// 清理winmm.dll文件
function cleanupDllFile() {
  return new Promise((resolve) => {
    if (targetDllPath && fs.existsSync(targetDllPath)) {
      try {
        fs.unlinkSync(targetDllPath);
        console.log(`[清理] 已删除文件: ${targetDllPath}`);
        resolve(true);
      } catch (error) {
        console.error(`[清理] 删除文件失败: ${error.message}`);
        resolve(false);
      }
    } else {
      console.log('[清理] 目标文件不存在，无需清理');
      resolve(true);
    }
  });
}

// 关闭后端服务
function stopBackendService() {
  return new Promise((resolve) => {
    if (backendProcess && !backendProcess.killed) {
      console.log('[服务] 正在关闭服务...');
      
      // 发送SIGTERM信号优雅关闭
      backendProcess.kill('SIGTERM');
      
      // 设置强制关闭超时（5秒）
      const forceKillTimeout = setTimeout(() => {
        if (backendProcess && !backendProcess.killed) {
          console.log('[服务] 强制关闭服务');
          backendProcess.kill('SIGKILL');
        }
        backendProcess = null;
        resolve();
      }, 5000);
      
      backendProcess.on('close', () => {
        clearTimeout(forceKillTimeout);
        backendProcess = null;
        console.log('[服务] 服务已关闭');
        resolve();
      });
    } else {
      console.log('[服务] 服务未运行或已关闭');
      resolve();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  // 不再需要删除authorization.js文件（已弃用）
  
  // 删除tiku.json文件
  const tikuFilePath = path.join(process.cwd(), 'tiku.json');
  if (fs.existsSync(tikuFilePath)) {
    try {
      fs.unlinkSync(tikuFilePath);
      console.log('[应用关闭] 已删除题库文件: tiku.json');
    } catch (error) {
      console.error('删除题库文件失败:', error.message);
    }
  }
  
  // 关闭后端服务
  console.log('[应用关闭] 正在关闭服务...');
  await stopBackendService();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});