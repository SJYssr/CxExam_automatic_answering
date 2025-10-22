const { ipcRenderer } = require('electron');

// 读取 config.json 中的 Card 值
window.readConfig = async () => {
  try {
    const result = await ipcRenderer.invoke('read-config');
    return result;
  } catch (error) {
    console.error('读取配置失败:', error);
    return { success: false, error: error.message };
  }
};

// 保存 Card 值到 config.json
window.saveConfig = async (cardValue) => {
  try {
    const result = await ipcRenderer.invoke('save-config', cardValue);
    return result;
  } catch (error) {
    console.error('保存配置失败:', error);
    return { success: false, error: error.message };
  }
};

// 选择文件路径
window.selectFilePath = async () => {
  try {
    const result = await ipcRenderer.invoke('select-file-path');
    return result;
  } catch (error) {
    console.error('选择文件路径失败:', error);
    return { success: false, error: error.message };
  }
};

// 保存目标路径到 config.json
window.saveTargetPath = async (targetPath) => {
  try {
    const result = await ipcRenderer.invoke('save-target-path', targetPath);
    return result;
  } catch (error) {
    console.error('保存目标路径失败:', error);
    return { success: false, error: error.message };
  }
};

// 注入winmm.dll到目标路径
window.injectWinmmDll = async (targetPath) => {
  try {
    const result = await ipcRenderer.invoke('inject-winmm-dll', targetPath);
    return result;
  } catch (error) {
    console.error('注入失败:', error);
    return { success: false, error: error.message };
  }
};

// 执行自动登录
window.autoLogin = async () => {
  try {
    const result = await ipcRenderer.invoke('auto-login');
    return result;
  } catch (error) {
    console.error('自动登录失败:', error);
    return { success: false, error: error.message };
  }
};

// 窗口拖拽功能
let isDragging = false;
let dragStartPosition = { x: 0, y: 0 };

// 监听拖拽事件
document.addEventListener('DOMContentLoaded', () => {
    const draggableHeader = document.getElementById('draggable-header');
    
    if (draggableHeader) {
        draggableHeader.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragStartPosition.x = e.screenX;
            dragStartPosition.y = e.screenY;
            
            // 改变鼠标样式
            draggableHeader.style.cursor = 'grabbing';
            
            e.preventDefault();
        });
        
        // 添加悬停效果
        draggableHeader.addEventListener('mouseenter', () => {
            if (!isDragging) {
                draggableHeader.style.cursor = 'grab';
            }
        });
        
        draggableHeader.addEventListener('mouseleave', () => {
            if (!isDragging) {
                draggableHeader.style.cursor = 'default';
            }
        });
    }
});

// 全局鼠标事件
window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        // 使用屏幕坐标计算移动距离，避免窗口移动导致的坐标变化
        const deltaX = e.screenX - dragStartPosition.x;
        const deltaY = e.screenY - dragStartPosition.y;
        
        // 发送移动窗口的消息给主进程
        ipcRenderer.send('move-window', { deltaX, deltaY });
        
        // 更新起始位置为当前屏幕位置
        dragStartPosition.x = e.screenX;
        dragStartPosition.y = e.screenY;
    }
});

window.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        const draggableHeader = document.getElementById('draggable-header');
        if (draggableHeader) {
            draggableHeader.style.cursor = 'grab';
        }
    }
});

// 窗口控制功能
window.closeWindow = () => {
    ipcRenderer.send('close-window');
};

window.minimizeWindow = () => {
    ipcRenderer.send('minimize-window');
};

window.hideWindow = () => {
    ipcRenderer.send('hide-window');
};

// 添加自定义窗口控制按钮到标题栏
document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('draggable-header');
    if (header) {
        // 创建窗口控制按钮容器
        const controlsContainer = document.createElement('div');
        controlsContainer.style.cssText = `
            position: absolute;
            top: 10px;
            right: 15px;
            display: flex;
            gap: 10px;
            z-index: 1000;
        `;
        
        // 关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            width: 20px;
            height: 20px;
            border: none;
            background: rgba(255,255,255,0.2);
            color: white;
            border-radius: 50%;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        `;
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,100,100,0.8)';
            closeBtn.style.transform = 'scale(1.1)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.2)';
            closeBtn.style.transform = 'scale(1)';
        });
        closeBtn.addEventListener('click', () => {
            window.closeWindow();
        });
        
        controlsContainer.appendChild(closeBtn);
        header.appendChild(controlsContainer);
        
        // 确保标题文字居中
        header.style.position = 'relative';
        header.style.display = 'flex';
        header.style.justifyContent = 'center';
        header.style.alignItems = 'center';
    }

    // 页面加载时自动读取 config.json 中的 Card 值和目标路径
    const passwordInput = document.getElementById('password-input');
    const targetPathInput = document.getElementById('target-path');
    const pathSelectButton = document.getElementById('path-select-button');
    const loginStatus = document.querySelector('.display-content');
    
    if (passwordInput && loginStatus) {
        window.readConfig().then(result => {
            if (result.success) {
                // 填充Card值
                if (result.card) {
                    passwordInput.value = result.card;
                }
                
                // 填充目标路径（但不自动触发任何注入相关操作）
                if (targetPathInput && result.targetPath) {
                    targetPathInput.value = result.targetPath;
                    // 仅更新按钮状态，不触发任何自动操作
                    setTimeout(() => {
                        if (typeof updateInjectButtonState === 'function') {
                            updateInjectButtonState();
                        }
                    }, 100);
                }
                
                // 添加文件选择按钮点击事件
                if (pathSelectButton && targetPathInput) {
                    pathSelectButton.addEventListener('click', async () => {
                        try {
                            const result = await window.selectFilePath();
                            if (result.success && result.filePath) {
                                targetPathInput.value = result.filePath;
                                
                                // 保存目标路径到config.json
                                await window.saveTargetPath(result.filePath);
                                console.log('目标路径已保存到config.json');
                                
                                // 手动触发按钮状态更新
                                setTimeout(() => {
                                    if (typeof updateInjectButtonState === 'function') {
                                        updateInjectButtonState();
                                    }
                                }, 100);
                            } else {
                                console.log('文件选择取消或失败:', result.message);
                            }
                        } catch (error) {
                            console.error('文件选择错误:', error);
                        }
                    });
                }
                
                // 如果有 Card 值，自动执行登录
                if (result.card.trim() !== '') {
                    loginStatus.textContent = '正在登录中...';
                    loginStatus.style.color = '#ffa500'; // 橙色表示进行中
                    
                    window.autoLogin().then(loginResult => {
                        if (loginResult.success) {
                            // 登录成功
                            loginStatus.textContent = '登录成功';
                            loginStatus.style.color = '#28a745'; // 绿色表示成功
                            
                            // 显示登录结果信息
                            if (loginResult.output) {
                                const lines = loginResult.output.split('\n');
                                let statusText = '登录成功';
                                
                                // 提取关键信息
                                for (const line of lines) {
                                    if (line.includes('到期时间:')) {
                                        statusText += ' - ' + line.trim();
                                    } else if (line.includes('最新版本:')) {
                                        statusText += ' - ' + line.trim();
                                    } else if (line.includes('当前已是最新版本')) {
                                        statusText += ' - 当前已是最新版本';
                                    }
                                }
                                
                                loginStatus.textContent = statusText;
                            }
                        } else {
                            // 登录失败
                            loginStatus.textContent = '登录失败';
                            loginStatus.style.color = '#dc3545'; // 红色表示失败
                            
                            // 显示错误信息
                            if (loginResult.errorOutput) {
                                const errorLines = loginResult.errorOutput.split('\n');
                                for (const line of errorLines) {
                                    if (line.includes('登录失败:') || line.includes('错误码:')) {
                                        loginStatus.textContent = line.trim();
                                        break;
                                    }
                                }
                            }
                        }
                    }).catch(error => {
                        loginStatus.textContent = '登录异常: ' + error.message;
                        loginStatus.style.color = '#dc3545';
                    });
                } else {
                    // 没有 Card 值，显示未登录状态
                    loginStatus.textContent = '未登录';
                    loginStatus.style.color = '#6c757d'; // 灰色表示未登录
                }
            }
        }).catch(error => {
            console.error('自动读取配置失败:', error);
            if (loginStatus) {
                loginStatus.textContent = '配置读取失败';
                loginStatus.style.color = '#dc3545';
            }
        });

        // 监听输入框变化，自动保存到 config.json
        let saveTimeout;
        passwordInput.addEventListener('input', () => {
            // 使用防抖功能，避免频繁保存
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                window.saveConfig(passwordInput.value).then(result => {
                    if (!result.success) {
                        console.error('保存配置失败:', result.error);
                        if (loginStatus) {
                            loginStatus.textContent = '保存配置失败';
                            loginStatus.style.color = '#dc3545';
                        }
                    } else {
                        // 保存成功后，如果有 Card 值，自动执行登录
                        if (passwordInput.value.trim() !== '') {
                            if (loginStatus) {
                                loginStatus.textContent = '正在登录中...';
                                loginStatus.style.color = '#ffa500';
                            }
                            
                            window.autoLogin().then(loginResult => {
                                if (loginResult.success) {
                                    if (loginStatus) {
                                        loginStatus.textContent = '登录成功';
                                        loginStatus.style.color = '#28a745';
                                        
                                        // 提取登录结果中的详细信息
                                        const lines = loginResult.output.split('\n');
                                        let loginInfo = '登录成功';
                                        
                                        for (const line of lines) {
                                            if (line.includes('到期时间:')) {
                                                loginInfo += ' | ' + line.trim();
                                            } else if (line.includes('当前已是最新版本') || line.includes('有新版本')) {
                                                loginInfo += ' | ' + line.trim();
                                            }
                                        }
                                        
                                        // 如果登录成功且有token，显示token保存状态
                                        if (loginResult.token) {
                                            if (loginResult.tokenSaved) {
                                                loginInfo += ' | Token已缓存';
                                            } else if (loginResult.tokenSaveError) {
                                                loginInfo += ' | Token缓存失败';
                                            }
                                        }
                                        
                                        loginStatus.textContent = loginInfo;
                                    }
                                } else {
                                    if (loginStatus) {
                                        loginStatus.textContent = '登录失败';
                                        loginStatus.style.color = '#dc3545';
                                        
                                        if (loginResult.errorOutput) {
                                            const errorLines = loginResult.errorOutput.split('\n');
                                            for (const line of errorLines) {
                                                if (line.includes('登录失败:') || line.includes('错误码:')) {
                                                    loginStatus.textContent = line.trim();
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                            }).catch(error => {
                                if (loginStatus) {
                                    loginStatus.textContent = '登录异常: ' + error.message;
                                    loginStatus.style.color = '#dc3545';
                                }
                            });
                        } else {
                            // 清空 Card 值，显示未登录
                            if (loginStatus) {
                                loginStatus.textContent = '未登录';
                                loginStatus.style.color = '#6c757d';
                            }
                        }
                    }
                });
            }, 1000); // 1秒后保存
        });
    }

    // 密码显示/隐藏功能
    const passwordToggle = document.getElementById('password-toggle');
    
    if (passwordInput && passwordToggle) {
        // 初始状态：密码隐藏，显示带斜线的眼睛图标
        passwordToggle.classList.remove('showing');
        
        passwordToggle.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            
            if (isPassword) {
                // 显示密码
                passwordInput.type = 'text';
                passwordToggle.classList.add('showing');
            } else {
                // 隐藏密码
                passwordInput.type = 'password';
                passwordToggle.classList.remove('showing');
            }
        });
    }

    // 注入按钮状态控制逻辑
    const injectButton = document.querySelector('.inject-button');
    let isAutoStartPrevented = false; // 防止自动触发注入的标志
    
    if (targetPathInput && injectButton) {
        // 路径验证函数：检查是否包含CXExam.exe
        function validateTargetPath(path) {
            return path && path.trim() !== '' && path.includes('CXExam.exe');
        }
        
        // 更新注入按钮状态
        function updateInjectButtonState() {
            const path = targetPathInput.value;
            const isValid = validateTargetPath(path);
            
            if (isValid) {
                // 路径有效：启用按钮
                injectButton.disabled = false;
                injectButton.style.opacity = '1';
                injectButton.style.cursor = 'pointer';
                injectButton.style.backgroundColor = '#007bff';
            } else {
                // 路径无效：禁用按钮
                injectButton.disabled = true;
                injectButton.style.opacity = '0.6';
                injectButton.style.cursor = 'not-allowed';
                injectButton.style.backgroundColor = '#6c757d';
            }
        }
        
        // 初始状态检查
        updateInjectButtonState();
        
        // 监听目标路径输入框变化
        targetPathInput.addEventListener('input', updateInjectButtonState);
        targetPathInput.addEventListener('change', updateInjectButtonState);
        
        // 监听文件选择按钮的路径更新
        if (pathSelectButton) {
            pathSelectButton.addEventListener('click', () => {
                // 文件选择完成后，延迟检查按钮状态（等待路径填充）
                setTimeout(updateInjectButtonState, 100);
            });
        }
        
        // 注入按钮点击事件
        injectButton.addEventListener('click', async () => {
            // 确保只有在用户明确点击时才执行注入操作
            if (isAutoStartPrevented) {
                return;
            }
            
            const path = targetPathInput.value;
            if (validateTargetPath(path)) {
                console.log('开始注入到:', path);
                
                // 禁用按钮防止重复点击
                injectButton.disabled = true;
                injectButton.textContent = '注入中...';
                
                try {
                    // 调用后端API复制winmm.dll文件
                    const result = await window.injectWinmmDll(path);
                    
                    if (result.success) {
                        console.log('注入成功:', result.message);
                        // 程序已经启动成功，立即显示成功状态
                        injectButton.textContent = '注入并启动成功';
                        injectButton.style.backgroundColor = '#28a745'; // 绿色表示成功
                        
                        // 成功后再隐藏窗口，让用户看到成功状态
                        setTimeout(() => {
                            window.hideWindow();
                            console.log('窗口已隐藏，开始监控CXExam.exe进程...');
                        }, 1000); // 1秒后隐藏窗口
                    } else {
                        console.error('注入失败:', result.error);
                        injectButton.textContent = '注入失败';
                        injectButton.style.backgroundColor = '#dc3545'; // 红色表示失败
                        
                        // 3秒后恢复按钮状态（失败时不隐藏窗口）
                        setTimeout(() => {
                            injectButton.textContent = '注入';
                            injectButton.style.backgroundColor = '#007bff';
                            updateInjectButtonState(); // 重新验证按钮状态
                        }, 3000);
                    }
                } catch (error) {
                    console.error('注入异常:', error);
                    injectButton.textContent = '注入异常';
                    injectButton.style.backgroundColor = '#dc3545';
                    
                    // 3秒后恢复按钮状态（异常时不隐藏窗口）
                    setTimeout(() => {
                        injectButton.textContent = '注入';
                        injectButton.style.backgroundColor = '#007bff';
                        updateInjectButtonState(); // 重新验证按钮状态
                    }, 3000);
                }
            }
        });
    }
});