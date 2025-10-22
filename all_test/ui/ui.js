const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ps = require('ps-node');

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
    height: 550,
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
      const configPath = path.join(__dirname, 'config.json');
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
        const { spawn } = require('child_process');
        console.log('[注入] 注入成功，正在启动目标程序...');
        
        return new Promise((resolve) => {
          console.log('[启动] 正在启动目标程序...');
          
          // 使用spawn而不是exec，这样可以更好地控制进程
          const childProcess = spawn(`"${targetPath}"`, [], {
            shell: true,
            detached: true, // 让程序独立运行
            stdio: 'ignore' // 忽略标准输入输出，避免阻塞
          });
          
          // 程序启动后立即返回成功，因为程序已经成功启动
          childProcess.unref(); // 让子进程独立运行
          
          console.log('[启动] 目标程序已启动:', targetPath);
          
          // 启动进程监控
          startProcessMonitor(targetPath, targetDllPath);
          
          // 立即返回成功，因为程序已经成功启动
          resolve({ 
            success: true, 
            message: `成功注入并启动: ${targetPath}`,
            targetPath: targetDllPath
          });
        });
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
      const config = require('./config.json');
      if (!config.Card || config.Card.trim() === '') {
        console.log('[界面] 检测到未设置密钥，等待用户输入...');
      } else {
        console.log('[界面] 检测到已设置密钥，可以执行自动登录...');
      }
    } else {
      console.error('[界面] 服务启动失败:', backendResult.error);
    }
  });

  win.loadFile('index.html');
  // win.webContents.openDevTools(); // 打开开发者工具，方便调试
}

// 读取 config.json 文件中的配置值
ipcMain.handle('read-config', async () => {
  const configPath = path.join(__dirname, 'config.json');
  
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
  const configPath = path.join(__dirname, 'config.json');
  
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
  const { spawn } = require('child_process');
  const path = require('path');
  
  return new Promise((resolve) => {
    const mainJsPath = path.join(__dirname, 'main.js');
    
    // 使用 node 执行 main.js
    const childProcess = spawn('node', [mainJsPath], {
      cwd: __dirname
    });
    
    let output = '';
    let errorOutput = '';
    
    // 收集标准输出
    childProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    // 收集错误输出
    childProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // 进程结束
    childProcess.on('close', (code) => {
      const result = {
        success: code === 0,
        exitCode: code,
        output: output.trim(),
        errorOutput: errorOutput.trim(),
        fullOutput: output + errorOutput
      };
      
      // 如果登录成功，直接调用login.js获取token
      if (result.success) {
        const { login } = require('./model/login');
        const { getMacAddress } = require('./model/get_mac');
        const config = require('./config.json');
        
        // 使用与main.js相同的参数调用login函数
        const softid = '6G6G7V8C2T9L9U8A';
        const card = config.Card;
        const version = '1.0';
        const macAddress = getMacAddress();
        
        login(softid, card, version, macAddress)
          .then(loginResult => {
            if (loginResult.success && loginResult.token) {
              const token = loginResult.token;
              result.token = token;
              
              // 发送登录状态到后端（不再创建authorization.js文件）
              sendLoginStatusToBackend(true, token);
            } else {
              // 登录失败时发送重置状态
              sendLoginStatusToBackend(false, null);
            }
            
            resolve(result);
          })
          .catch(error => {
            console.error('调用login函数失败:', error.message);
            result.loginError = error.message;
            resolve(result);
          });
      } else {
        resolve(result);
      }
    });
    
    // 设置超时（30秒）
    setTimeout(() => {
      if (!childProcess.killed) {
        childProcess.kill();
        resolve({
          success: false,
          exitCode: -1,
          output: '',
          errorOutput: '登录超时',
          fullOutput: '登录过程超时（30秒）'
        });
      }
    }, 30000);
  });
});

// 检查是否已有server.js进程在运行
function isServerRunning() {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    
    // 检查是否有node进程正在运行server.js
    exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', (error, stdout, stderr) => {
      if (error) {
        console.error('检查node进程失败:', error);
        resolve(false);
        return;
      }
      
      // 解析tasklist输出，检查是否有server.js进程
      const lines = stdout.split('\n').filter(line => line.trim() && line.includes('node.exe'));
      
      if (lines.length === 0) {
        resolve(false);
        return;
      }
      
      // 使用wmic检查进程命令行参数
      exec('wmic process where "name=\'node.exe\'" get commandline', (wmicError, wmicStdout, wmicStderr) => {
        if (wmicError) {
          console.error('检查node进程命令行失败:', wmicError);
          resolve(false);
          return;
        }
        
        const wmicLines = wmicStdout.split('\n').filter(line => line.trim() && line.includes('server.js'));
        resolve(wmicLines.length > 0);
      });
    });
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
    
    const serverJsPath = path.join(__dirname, 'server.js');
    
    // 使用 node 执行 server.js
    backendProcess = spawn('node', [serverJsPath], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    let errorOutput = '';
    
    // 收集标准输出
    backendProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`[服务] ${data.toString().trim()}`);
      
      // 检查是否启动成功（监听端口3000）
      if (data.toString().includes('3000')) {
        console.log('[服务] 服务启动成功');
        resolve({ success: true, output: output });
      }
    });
    
    // 收集错误输出
    backendProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`[后端服务错误] ${data.toString().trim()}`);
    });
    
    // 进程错误处理
    backendProcess.on('error', (error) => {
      console.error('[后端服务] 启动失败:', error.message);
      resolve({ success: false, error: error.message });
    });
    
    // 进程退出处理
    backendProcess.on('close', (code) => {
      backendProcess = null;
    });
    
    // 设置启动超时（10秒）
    setTimeout(() => {
      if (backendProcess && !backendProcess.killed) {
        // 直接认为服务启动成功，不进行健康检查
        console.log('[服务] 服务启动成功');
        resolve({ success: true, output: output });
      }
    }, 10000);
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
        // 如果tasklist失败，尝试使用ps-node作为备用方案
        ps.lookup({ command: 'CXExam.exe' }, (err, resultList) => {
          if (err) {
            console.error('ps-node检查进程状态失败:', err);
            resolve(false);
            return;
          }
          
          // 检查是否有匹配的进程
          const matchingProcess = resultList.find(process => {
            // 检查进程路径是否匹配
            return process && process.arguments && 
                   process.arguments.some(arg => arg.includes(processPath));
          });
          
          resolve(!!matchingProcess);
        });
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
        const tikuFilePath = path.join(__dirname, 'tiku.json');
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
  const tikuFilePath = path.join(__dirname, 'tiku.json');
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