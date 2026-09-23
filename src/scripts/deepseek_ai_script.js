// 超星学习通考试AI辅助填充脚本
// 功能：获取题目和选项，发送给DeepSeek AI解答，支持快捷键操作

(function() {
    'use strict';

    console.log('[AI答题] 脚本开始执行');

    // =====页面检测逻辑=====
    function isChaoxingExamPage() {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;
        
        console.log('[AI答题] 当前页面:', hostname, pathname);
        
        // 检查域名和路径是否符合考试页面
        return (
            (hostname.includes('chaoxing.com') || hostname.includes('.edu.cn')) &&
            (
                pathname.includes('/exam/test/') ||
                pathname.includes('/exam-ans/exam/test/') ||
                pathname.includes('/exam-ans/mooc2/exam/preview')
            )
        );
    }

    // 若不是考试页面，不执行
    if (!isChaoxingExamPage()) {
        console.log('不是超星学习通考试页面，AI脚本不加载');
        return;
    }

    console.log('[AI答题]页面检测通过，准备加载脚本...');

    // 检查是否已加载，避免重复加载
    if (window.__deepseekAILoaded) {
        console.log('AI答题脚本已加载，避免重复执行');
        return;
    }
    window.__deepseekAILoaded = true;

    // DeepSeek API配置
    // API Key 支持两种配置方式（无需修改脚本、无需重新编译 DLL）：
    //   1. 页面内设置面板：按 Ctrl+Alt+K 打开，Key 保存在本机浏览器中（优先级更高）
    //   2. config.json 文件：与 winmm.dll 同目录，内容 {"apiKey": "sk-xxxx"}，
    //      由 DLL 注入为 window.__CX_AI_CONFIG__
    const AI_API_KEY_STORAGE = '__cxAiApiKey';
    const DEEPSEEK_API_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
    const AI_MODEL = 'deepseek-chat';

    /**
     * 获取当前生效的 API Key 及其来源
     * 优先级：页面设置（localStorage）> config.json 注入值（window.__CX_AI_CONFIG__）
     */
    function getAIConfig() {
        try {
            const saved = localStorage.getItem(AI_API_KEY_STORAGE);
            if (saved && saved.trim()) {
                return { apiKey: saved.trim(), source: '页面设置' };
            }
        } catch (e) { /* localStorage 不可用时忽略 */ }

        const injected = window.__CX_AI_CONFIG__ && window.__CX_AI_CONFIG__.apiKey;
        if (injected && injected.trim()) {
            return { apiKey: injected.trim(), source: 'config.json' };
        }
        return { apiKey: '', source: '' };
    }

    // 设置面板是否已自动弹出过（避免每次自动获取答案都弹出）
    let settingsDialogShown = false;

    /**
     * 显示顶部提示气泡（自动消失），用于把错误信息直接呈现给用户
     * @param {string} message - 提示内容
     * @param {boolean} isError - 是否为错误样式
     */
    function showAIToast(message, isError) {
        try {
            const toast = document.createElement('div');
            toast.textContent = message;
            Object.assign(toast.style, {
                position: 'fixed',
                top: '70px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: isError ? 'rgba(231, 76, 60, 0.95)' : 'rgba(46, 204, 113, 0.95)',
                color: 'white',
                padding: '10px 18px',
                borderRadius: '8px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.25)',
                zIndex: '10000000',
                fontFamily: 'Arial, sans-serif',
                fontSize: '13px',
                maxWidth: '60%',
                lineHeight: '1.5'
            });
            document.body.appendChild(toast);
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 6000);
        } catch (e) { /* UI 异常不影响主流程 */ }
    }

    /**
     * 对 API Key 做脱敏显示
     */
    function maskApiKey(key) {
        if (!key) {
            return '（未设置）';
        }
        if (key.length <= 10) {
            return key.slice(0, 3) + '****';
        }
        return key.slice(0, 6) + '****' + key.slice(-4);
    }

    /**
     * 打开 API Key 设置面板
     * @param {string} notice - 打开原因说明（如错误信息），可为空
     */
    function openAISettingsDialog(notice) {
        try {
            // 已打开则不重复创建
            if (document.getElementById('__cx_ai_settings_overlay')) {
                return;
            }

            const config = getAIConfig();

            const overlay = document.createElement('div');
            overlay.id = '__cx_ai_settings_overlay';
            Object.assign(overlay.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.45)',
                zIndex: '10000001',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            });

            const panel = document.createElement('div');
            Object.assign(panel.style, {
                backgroundColor: 'white',
                borderRadius: '10px',
                padding: '20px 24px',
                width: '440px',
                maxWidth: '90%',
                fontFamily: 'Arial, sans-serif',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
            });

            const title = document.createElement('div');
            title.textContent = 'AI 答题设置';
            title.style.cssText = 'font-size:16px;font-weight:bold;margin-bottom:10px;';
            panel.appendChild(title);

            function closeDialog() {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }

            if (notice) {
                const noticeDiv = document.createElement('div');
                noticeDiv.textContent = notice;
                noticeDiv.style.cssText = 'font-size:13px;color:#e74c3c;margin-bottom:10px;line-height:1.5;';
                panel.appendChild(noticeDiv);
            }

            const currentDiv = document.createElement('div');
            currentDiv.textContent = '当前 API Key：' + maskApiKey(config.apiKey) + (config.source ? '（来源：' + config.source + '）' : '');
            currentDiv.style.cssText = 'font-size:13px;color:#555;margin-bottom:10px;word-break:break-all;';
            panel.appendChild(currentDiv);

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = '粘贴 DeepSeek API Key（sk-...）';
            Object.assign(input.style, {
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                fontSize: '13px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                marginBottom: '8px',
                outline: 'none'
            });
            panel.appendChild(input);

            const hint = document.createElement('div');
            hint.textContent = 'Key 保存在本机浏览器中，仅用于直接请求 DeepSeek 服务。也可以改用 winmm.dll 同目录的 config.json：{"apiKey": "sk-xxxx"}';
            hint.style.cssText = 'font-size:12px;color:#888;margin-bottom:14px;line-height:1.5;';
            panel.appendChild(hint);

            const btnRow = document.createElement('div');
            btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

            function makeButton(text, bg) {
                const btn = document.createElement('button');
                btn.textContent = text;
                Object.assign(btn.style, {
                    padding: '7px 16px',
                    fontSize: '13px',
                    color: 'white',
                    backgroundColor: bg,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                });
                return btn;
            }

            const saveBtn = makeButton('保存', '#2ecc71');
            saveBtn.addEventListener('click', function() {
                const val = (input.value || '').trim();
                if (!val) {
                    input.style.borderColor = '#e74c3c';
                    input.placeholder = 'API Key 不能为空';
                    return;
                }
                try {
                    localStorage.setItem(AI_API_KEY_STORAGE, val);
                } catch (e) {
                    showAIToast('[AI答题] 保存失败：浏览器本地存储不可用', true);
                    return;
                }
                closeDialog();
                showAIToast('[AI答题] API Key 已保存，开始获取答案…');
                isProcessing = false;
                fetchAllAnswers();
            });

            const clearBtn = makeButton('清除已保存', '#95a5a6');
            clearBtn.addEventListener('click', function() {
                try {
                    localStorage.removeItem(AI_API_KEY_STORAGE);
                } catch (e) { /* 忽略 */ }
                closeDialog();
                showAIToast('[AI答题] 已清除页面内保存的 API Key（config.json 中的配置仍会生效）');
            });

            const cancelBtn = makeButton('关闭', '#7f8c8d');
            cancelBtn.addEventListener('click', closeDialog);

            btnRow.appendChild(saveBtn);
            btnRow.appendChild(clearBtn);
            btnRow.appendChild(cancelBtn);
            panel.appendChild(btnRow);

            overlay.addEventListener('click', function(event) {
                if (event.target === overlay) {
                    closeDialog();
                }
            });

            overlay.appendChild(panel);
            document.body.appendChild(overlay);
            input.focus();
        } catch (e) {
            console.error('[AI答题] 打开设置面板失败:', e);
        }
    }

    // 初始化脚本
    function initScript() {
        console.log('[AI答题] 脚本初始化中');
        
        // 监听鼠标中键 - 填充AI答案
        document.addEventListener('mousedown', function(event) {
            if (event.button === 1) { // 鼠标中键
                event.preventDefault();
                console.log('[AI答题] 用户按下了鼠标中键');
                
                if (window.aiAnswersData && Object.keys(window.aiAnswersData).length > 0) {
                    console.log('[AI答题] 检测到AI答案数据，开始填充');
                    fillAnswersFromAI(window.aiAnswersData);
                    // 填充后清除数据
                    window.aiAnswersData = null;
                } else {
                    console.log('[AI答题] 未检测到AI答案数据，正在自动获取...');
                    fetchAllAnswers();
                }
            }
        });
        
        // 监听复制操作 - 用户复制内容后自动获取AI答案
        let lastClipboardText = '';
        
        // 方式1: 监听copy事件
        document.addEventListener('copy', async function(event) {
            // 延迟读取剪贴板，确保复制操作已完成
            setTimeout(async () => {
                try {
                    const clipboardText = await navigator.clipboard.readText();
                    const copiedText = clipboardText.trim();
                    
                    // 检查内容是否变化，避免重复处理
                    if (copiedText && copiedText.length > 0 && copiedText !== lastClipboardText) {
                        lastClipboardText = copiedText;
                        console.log('[AI答题] 检测到复制操作，复制内容:', copiedText);
                        // 自动获取AI答案
                        await handleCopyAIRequest(copiedText);
                    }
                } catch (error) {
                    console.error('[AI答题] 读取剪贴板失败:', error);
                }
            }, 150); // 延迟150ms确保复制完成
        });
        
        // 方式2: 监听Ctrl+C快捷键（备用方式，提高兼容性）
        document.addEventListener('keydown', async function(event) {
            if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
                // 延迟读取剪贴板
                setTimeout(async () => {
                    try {
                        const clipboardText = await navigator.clipboard.readText();
                        const copiedText = clipboardText.trim();
                        
                        // 检查内容是否变化，避免重复处理
                        if (copiedText && copiedText.length > 0 && copiedText !== lastClipboardText) {
                            lastClipboardText = copiedText;
                            console.log('[AI答题] 检测到Ctrl+C，复制内容:', copiedText);
                            // 自动获取AI答案
                            await handleCopyAIRequest(copiedText);
                        }
                    } catch (error) {
                        console.error('[AI答题] 读取剪贴板失败:', error);
                        // 如果剪贴板API不可用，尝试使用选中的文本
                        const selectedText = window.getSelection().toString().trim();
                        if (selectedText && selectedText.length > 0 && selectedText !== lastClipboardText) {
                            lastClipboardText = selectedText;
                            console.log('[AI答题] 使用选中文本作为替代:', selectedText);
                            await handleCopyAIRequest(selectedText);
                        }
                    }
                }, 150);
            }
        });
        
        // 监听点击事件 - 当用户点击输入框时自动填充答案
        document.addEventListener('click', function(event) {
            const targetElement = event.target;
            
            // 延迟执行，确保元素已获得焦点
            setTimeout(() => {
                // 使用点击的目标元素，因为activeElement在iframe情况下可能不准确
                const elementToFill = targetElement;
                
                // 如果有存储的答案
                if (elementToFill && elementToFill !== document.body && window.copiedAIAnswer) {
                    // 尝试填充答案（使用与自动答题相同的逻辑）
                    const answerToFill = window.copiedAIAnswer;
                    const filled = fillToInputElementForChaoxing(elementToFill, answerToFill);
                    
                    if (filled) {
                        console.log('[AI答题] 检测到点击输入框，自动填充答案:', answerToFill);
                        
                        // 填充后清除存储的答案，恢复鼠标指针
                        window.copiedAIAnswer = null;
                        document.body.style.cursor = 'default';
                        console.log('[AI答题] 答案已填充，已清除缓存');
                    } else {
                        // 如果超星填充方式失败，使用通用填充方式
                        console.warn('[AI答题] 超星填充方式失败，尝试使用通用填充方式');
                        const activeElement = document.activeElement;
                        if (activeElement && activeElement !== document.body) {
                            fillToInputElement(activeElement, answerToFill);
                            // 清除缓存
                            window.copiedAIAnswer = null;
                            document.body.style.cursor = 'default';
                        }
                    }
                }
            }, 50);
        });
        
        // 页面加载后自动获取答案
        console.log('[AI答题] 页面加载完成，开始自动获取AI答案...');
        fetchAllAnswers();
        
        // 监听 Ctrl+Alt+K - 打开 API Key 设置面板
        document.addEventListener('keydown', function(event) {
            if (event.ctrlKey && event.altKey && (event.code === 'KeyK' || event.key === 'k' || event.key === 'K')) {
                event.preventDefault();
                openAISettingsDialog('');
            }
        });

        console.log('[AI答题] 脚本初始化完成');
        console.log('[AI答题] 使用说明: 复制内容后自动获取AI答案，点击输入框自动填充 | 鼠标中键=填充全部答案 | Ctrl+Alt+K=配置API Key');
    }

    // 全局变量用于防止重复执行
    let isProcessing = false;

    /**
     * 处理复制操作的AI请求：将复制的内容发送给AI，获取答案并存储，改变鼠标指针
     * @param {string} copiedText - 用户复制的文本内容（来自剪贴板）
     */
    async function handleCopyAIRequest(copiedText) {
        // 检查API Key
        const { apiKey } = getAIConfig();
        if (!apiKey) {
            console.error('[AI答题] API Key 未配置，无法使用复制功能');
            showAIToast('[AI答题] 未配置 API Key，按 Ctrl+Alt+K 打开设置面板填写后，重新复制题目即可。', true);
            return;
        }
        
        // 防止重复请求
        if (isProcessing) {
            console.warn('[AI答题] 正在处理中，请稍候...');
            return;
        }
        
        isProcessing = true;
        
        try {
            // 检测题目类型（仅支持填空题和简答题）
            let questionType = '未知类型';
            if (copiedText.includes('填空题')) {
                questionType = '填空题';
            } else if (copiedText.includes('简答题')) {
                questionType = '简答题';
            }
            
            // 构建提示词（与自动答题保持一致）
            let prompt = `你是AI答题助手，分析以下试题，给出最合适的答案。仅返回答案，不要解释(如果解释将会导致返回格式错误)。规则：如果填空题或简答题，请给出简洁的填充内容（如：1，苹果;香蕉，等等），并且不能带有md格式字符。\n\n题目：${copiedText}\n`;
            
            // 根据题目类型调整提示词（与自动答题逻辑一致）
            if (questionType === '简答题') {
                prompt += `\n请直接给出完整的答案内容，不要有任何限制。如果是程序题，请输出完整的、可运行的代码。如果是普通简答题，请给出详细的解答。不要有任何字数限制，直接输出答案内容：`;
            } else if (questionType === '填空题') {
                prompt += `请根据题目类型，给出最佳答案。答案格式为：\n填空题： 建议填充内容，如 "1"\n\n你的答案：`;
            } else {
                // 如果无法判断类型，默认按填空题处理
                prompt += `请根据题目，给出简洁的填充内容，不要带有md格式字符。\n\n你的答案：`;
            }
            
            console.log('[AI答题] 正在向AI发送请求，题目类型:', questionType || '未识别（按填空题处理）');
            
            // 调用AI获取答案（内部已自动清理Markdown格式）
            const aiAnswer = await fetchDeepSeekAnswer(prompt);
            
            console.log('[AI答题] AI返回答案:', aiAnswer);
            
            // 存储答案到全局变量
            window.copiedAIAnswer = aiAnswer;
            
            // 改变鼠标指针为指针样式（表示答案已准备好，可以点击输入框填充）
            document.body.style.cursor = 'pointer';
            
            console.log('[AI答题] 答案已获取，请点击输入框自动填充！');
            
        } catch (error) {
            console.error('[AI答题] 复制AI请求失败:', error);
            showAIToast('[AI答题] 获取答案失败：' + (error.message || '未知错误'), true);
            // 清除存储的答案
            window.copiedAIAnswer = null;
        } finally {
            isProcessing = false;
        }
    }

    /**
     * 专门用于超星学习通的填充函数（按照原有自动答题的填充逻辑）
     * 查找题目容器内的iframe和p标签进行填充
     * @param {Element} element - 用户点击的元素
     * @param {string} answer - 要填充的答案
     * @returns {boolean} - 是否成功填充
     */
    function fillToInputElementForChaoxing(element, answer) {
        if (!element || !answer) {
            return false;
        }
        
        let filled = false;
        
        try {
            // 情况1: 如果点击的元素本身就是p标签（可能在iframe内），直接尝试填充
            if (element.tagName && element.tagName.toLowerCase() === 'p') {
                if (element.textContent.trim() === '' || element.innerHTML.trim() === '' || element.innerHTML === '<br>') {
                    element.innerHTML = answer;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    filled = true;
                    console.log('[AI答题] 已直接填充到p标签');
                    return true;
                }
            }
            
            // 情况2: 向上查找，找到包含该元素的题目容器（div.questionLi）
            let questionContainer = element;
            while (questionContainer && questionContainer !== document.body) {
                if (questionContainer.classList && questionContainer.classList.contains('questionLi')) {
                    break;
                }
                questionContainer = questionContainer.parentElement;
            }
            
            // 如果找到了题目容器
            if (questionContainer && questionContainer.classList.contains('questionLi')) {
                console.log('[AI答题] 找到题目容器，开始查找iframe和textarea');
                
                // 2. 查找题目容器内的iframe
                const iframes = questionContainer.querySelectorAll('iframe');
                if (iframes.length > 0) {
                    iframes.forEach((iframe) => {
                        if (filled) return; // 如果已经填充，跳过
                        
                        try {
                            // 获取iframe内的文档
                            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                            if (iframeDoc) {
                                // 查找iframe内的p标签
                                const pTags = iframeDoc.querySelectorAll('p');
                                pTags.forEach((pTag) => {
                                    if (filled) return; // 如果已经填充，跳过
                                    
                                    // 填充到空的p标签
                                    if (pTag.textContent.trim() === '' || pTag.innerHTML.trim() === '' || pTag.innerHTML === '<br>') {
                                        pTag.innerHTML = answer;
                                        // 触发输入事件以确保内容被保存
                                        pTag.dispatchEvent(new Event('input', { bubbles: true }));
                                        filled = true;
                                        console.log('[AI答题] 已填充到iframe内的p标签');
                                    }
                                });
                            }
                        } catch (error) {
                            console.warn('[AI答题] 无法访问iframe内容，尝试textarea:', error);
                        }
                    });
                }
                
                // 3. 如果没有填充成功，尝试查找textarea作为备用
                if (!filled) {
                    const textareas = questionContainer.querySelectorAll('textarea');
                    textareas.forEach((textarea) => {
                        if (filled) return; // 如果已经填充，跳过
                        
                        if (textarea.value.trim() === '') {
                            textarea.value = answer;
                            textarea.dispatchEvent(new Event('input', { bubbles: true }));
                            filled = true;
                            console.log('[AI答题] 已填充到textarea');
                        }
                    });
                }
                
                // 4. 如果还是没有填充成功，尝试查找input元素
                if (!filled) {
                    const inputs = questionContainer.querySelectorAll('input[type="text"], input:not([type])');
                    inputs.forEach((input) => {
                        if (filled) return; // 如果已经填充，跳过
                        
                        if (input.value.trim() === '') {
                            input.value = answer;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                            filled = true;
                            console.log('[AI答题] 已填充到input元素');
                        }
                    });
                }
            } else {
                console.warn('[AI答题] 未找到题目容器（div.questionLi），无法使用超星填充方式');
            }
        } catch (error) {
            console.error('[AI答题] 填充过程中发生错误:', error);
        }
        
        return filled;
    }

    /**
     * 将答案填充到用户点击的元素（通用填充函数，支持所有可输入元素）
     * @param {Element} element - 目标元素（用户点击的元素）
     * @param {string} answer - 要填充的答案
     */
    function fillToInputElement(element, answer) {
        if (!element || !answer) {
            console.warn('[AI答题] 元素或答案为空，无法填充');
            return;
        }
        
        const tagName = element.tagName.toLowerCase();
        let filled = false;
        
        try {
            // 方式1: 如果是input或textarea，使用value属性
            if ((tagName === 'input' || tagName === 'textarea') && 'value' in element) {
                element.value = answer;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                filled = true;
                console.log('[AI答题] 已填充到', tagName, '元素（value方式）');
            }
            // 方式2: 如果元素有contentEditable属性，使用innerHTML
            else if (element.contentEditable === 'true' || element.contentEditable === true) {
                element.textContent = answer;
                element.innerHTML = answer;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                filled = true;
                console.log('[AI答题] 已填充到contentEditable元素');
            }
            // 方式3: 如果是iframe，尝试访问内部元素
            else if (tagName === 'iframe') {
                try {
                    const iframeDoc = element.contentDocument || element.contentWindow.document;
                    if (iframeDoc) {
                        const body = iframeDoc.body;
                        
                        if (body.contentEditable === 'true' || body.contentEditable === true) {
                            body.innerHTML = answer;
                            body.dispatchEvent(new Event('input', { bubbles: true }));
                            filled = true;
                            console.log('[AI答题] 已填充到iframe body元素');
                        } else {
                            // 查找iframe内的可编辑元素
                            const editableElements = body.querySelectorAll('p, div[contenteditable="true"], textarea, input[type="text"]');
                            if (editableElements.length > 0) {
                                editableElements.forEach(el => {
                                    if (el.textContent.trim() === '' || el.innerHTML.trim() === '' || el.innerHTML === '<br>') {
                                        if ('value' in el) {
                                            el.value = answer;
                                        } else {
                                            el.innerHTML = answer;
                                        }
                                        el.dispatchEvent(new Event('input', { bubbles: true }));
                                        filled = true;
                                    }
                                });
                                if (filled) {
                                    console.log('[AI答题] 已填充到iframe内可编辑元素');
                                }
                            } else {
                                // 最后尝试直接设置body内容
                                body.innerHTML = answer;
                                body.dispatchEvent(new Event('input', { bubbles: true }));
                                filled = true;
                                console.log('[AI答题] 已填充到iframe body（备用方式）');
                            }
                        }
                    }
                } catch (error) {
                    console.error('[AI答题] 无法访问iframe内容（可能是跨域问题）:', error);
                }
            }
            // 方式4: 尝试直接设置textContent和innerHTML（适用于其他可编辑元素）
            else {
                try {
                    // 先尝试innerHTML（保留可能的格式）
                    if ('innerHTML' in element) {
                        element.innerHTML = answer;
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        filled = true;
                        console.log('[AI答题] 已填充到', tagName, '元素（innerHTML方式）');
                    }
                    // 如果没有innerHTML，尝试textContent
                    else if ('textContent' in element) {
                        element.textContent = answer;
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        filled = true;
                        console.log('[AI答题] 已填充到', tagName, '元素（textContent方式）');
                    }
                    // 最后尝试value属性
                    else if ('value' in element) {
                        element.value = answer;
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        filled = true;
                        console.log('[AI答题] 已填充到', tagName, '元素（value方式）');
                    }
                } catch (error) {
                    console.warn('[AI答题] 尝试填充到', tagName, '元素时失败:', error);
                }
            }
            
            if (!filled) {
                console.warn('[AI答题] 无法填充到元素:', tagName, element);
            }
        } catch (error) {
            console.error('[AI答题] 填充答案时发生错误:', error);
        }
    }

    /**
     * 获取所有题目的AI答案
     */
    async function fetchAllAnswers() {
        console.log('[AI答题] 开始获取AI答案...');
        
        // 检查是否正在处理中
        if (isProcessing) {
            console.warn('[AI答题] 正在处理中，忽略重复请求');
            return;
        }
        
        // 设置处理状态
        isProcessing = true;
        
        // 检查API Key
        const config = getAIConfig();
        if (!config.apiKey) {
            console.error('[AI答题]API Key 未配置');
            showAIToast('[AI答题] 未配置 API Key：按 Ctrl+Alt+K 打开设置面板填写，或在 winmm.dll 同目录的 config.json 中配置。', true);
            if (!settingsDialogShown) {
                settingsDialogShown = true;
                openAISettingsDialog('尚未配置 API Key，AI 答题功能未启用。可在此粘贴 DeepSeek API Key，或改用 winmm.dll 同目录的 config.json 配置。');
            }
            isProcessing = false;
            return;
        }

        console.log('[AI答题]API Key 已配置（来源：' + config.source + '），开始处理题目...');
        
        // 使用局部变量存储答案数据
        const answersData = {};
        
        const questions = document.querySelectorAll('div.questionLi');
        if (questions.length === 0) {
            console.error('[AI答题] 未找到题目元素 (div.questionLi)');
            isProcessing = false;
            return;
        }
        
        console.log(`[AI答题] 检测到 ${questions.length} 道题目`);
        
        const questionPromises = [];  // 存储所有题目请求的Promise
        
        questions.forEach((question, index) => {
            const titleElement = question.querySelector('h3.mark_name');
            if (!titleElement) {
                return;
            }
            
            const questionTextFull = titleElement.textContent.trim();
            const questionHash = question.dataset.questionId || `q-${index}`;
            
            let prompt = `你是AI答题助手，分析以下试题，给出最合适的答案。仅返回答案，不要解释(如果解释将会导致返回格式错误)。规则：选择题，请直接给出选项字母（如：A, B, AB, 对, 错）。如果填空题或简答题，请给出简洁的填充内容（如：1，苹果;香蕉，等等），并且不能带有md格式字符。\n\n题目：${questionTextFull}\n`;
            
            const options = [];
            let questionType = '未知类型';
            
            if (questionTextFull.includes('单选题')) {
                questionType = '单选题';
            } else if (questionTextFull.includes('多选题')) {
                questionType = '多选题';
            } else if (questionTextFull.includes('判断题')) {
                questionType = '判断题';
            } else if (questionTextFull.includes('填空题')) {
                questionType = '填空题';
            } else if (questionTextFull.includes('简答题')) {
                questionType = '简答题';
            }
            
            const optionDivs = question.querySelectorAll('div.answerBg');
            if (optionDivs.length > 0) {
                optionDivs.forEach((optionDiv, optIndex) => {
                    const optionLabel = String.fromCharCode(65 + optIndex);
                    const clearfixDiv = optionDiv.querySelector('div.clearfix');
                    const optionContent = clearfixDiv ? clearfixDiv.textContent : optionDiv.textContent;
                    options.push(`${optionLabel}. ${optionContent.trim()}`);
                });
                prompt += `选项：\n${options.join('\n')}\n`;
            }
            
            // 根据题目类型调整提示词 
            if (questionType === '简答题') {
                prompt += `\n请直接给出完整的答案内容，不要有任何限制。如果是程序题，请输出完整的、可运行的代码。如果是普通简答题，请给出详细的解答。不要有任何字数或格式限制，直接输出答案内容：`;
            } else { 
                prompt += `请根据题目类型和选项，给出最佳答案。答案格式为：\n单选题/多选题：仅字母，如 "A" 或 "AB"\n判断题： "对" 或 "错"\n填空题： 建议填充内容，如 "1"\n简答题： 答案,解析，如 "人工智能是模拟人类智能的技术,解析:因为人工智能通过算法模拟人类思维过程，数据分析帮助机器学习和决策"\n\n你的答案：`; 
            }
            
            questionPromises.push(
                fetchDeepSeekAnswer(prompt)
                    .then(aiResponse => {
                        answersData[questionHash] = {
                            answer: aiResponse,
                            type: questionType
                        };
                    })
                    .catch(error => {
                        answersData[questionHash] = {
                            error: true,
                            message: error.message || '请求失败',
                            type: questionType
                        };
                    })
            );
        });
        
        try {
            await Promise.all(questionPromises);
            
            console.log('[AI答题] 答案获取完成');
            console.log('[AI答题] 答案数据统计：', Object.keys(answersData).length, '道题目');
            
            // 统计失败的题目，给出汇总提示（避免逐题提示刷屏）
            const allResults = Object.values(answersData);
            const failedResults = allResults.filter(item => item && item.error);
            if (failedResults.length > 0) {
                const lastFailed = failedResults[failedResults.length - 1];
                showAIToast('[AI答题] ' + failedResults.length + '/' + allResults.length + ' 道题目获取失败。' + (lastFailed.message ? '最后错误：' + lastFailed.message : ''), true);
            }

            // 将答案数据存储到全局变量中供填充
            window.aiAnswersData = answersData;
            
            // 答案准备就绪，改变鼠标指针为手形
            document.body.style.cursor = 'pointer';

        } catch (error) {
            console.error('[AI答题] 获取AI答案时发生错误:', error);
            
            // 获取答案失败，恢复鼠标指针
            document.body.style.cursor = 'default';

        } finally {
            // 重置处理状态
            isProcessing = false;
            console.log('🔄 处理状态已重置');
        }
    }

    /**
     * 清理答案中的Markdown格式符号
     * @param {string} text - 需要清理的文本
     * @returns {string} - 清理后的文本
     */
    function cleanMarkdownFormat(text) {
        if (!text) return text;
        
        let cleaned = text;
        
        // 移除Markdown粗体：**text** 或 __text__
        cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
        cleaned = cleaned.replace(/__(.*?)__/g, '$1');
        
        // 移除Markdown斜体：*text* 或 _text_（但要注意不要误伤普通*）
        // 只匹配成对的 * 或 _
        cleaned = cleaned.replace(/\*([^*\n]+?)\*/g, '$1');
        cleaned = cleaned.replace(/_([^_\n]+?)_/g, '$1');
        
        // 移除Markdown标题：# text, ## text, ### text 等
        cleaned = cleaned.replace(/^#{1,6}\s+(.+)$/gm, '$1');
        
        // 移除Markdown代码块：```code``` 或 `code`
        cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
        cleaned = cleaned.replace(/`([^`]+?)`/g, '$1');
        
        // 移除Markdown链接：[text](url) -> text
        cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
        
        // 移除Markdown图片：![alt](url) -> alt
        cleaned = cleaned.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1');
        
        // 移除Markdown引用：> text -> text
        cleaned = cleaned.replace(/^>\s+(.+)$/gm, '$1');
        
        // 移除Markdown列表符号：- item, * item, 1. item 等
        cleaned = cleaned.replace(/^[\s]*[-*+]\s+(.+)$/gm, '$1');
        cleaned = cleaned.replace(/^\d+\.\s+(.+)$/gm, '$1');
        
        // 移除Markdown水平线：--- 或 ***
        cleaned = cleaned.replace(/^[-*]{3,}$/gm, '');
        
        // 移除多余的换行（连续的3个以上换行变成2个）
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        
        // 移除首尾空白字符
        cleaned = cleaned.trim();
        
        return cleaned;
    }

    /**
     * 向 DeepSeek API 发送请求获取答案
     */
    async function fetchDeepSeekAnswer(prompt) {
        const { apiKey } = getAIConfig();
        if (!apiKey) {
            openAISettingsDialog('尚未配置 API Key，无法请求 AI 服务。');
            throw new Error('API Key 未配置');
        }
        try {
            const response = await fetch(DEEPSEEK_API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: [
                        { role: "system", content: "你是一个专业的考试辅导AI，请根据题目和选项，直接给出最准确的答案。对于简答题，请返回格式为'答案,这样回答的原因'。不要解释，不要说任何多余的话。如果需要，请直接给出选项字母（如：A, B, AB），或者\"对\"、\"错\"，或者填充内容（如：1）。重要：请不要使用任何Markdown格式符号（如**粗体**、*斜体*、#标题、`代码`、-列表等），直接输出纯文本答案。" },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 1024,
                    stream: false
                })
            });
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    openAISettingsDialog('AI 服务返回 ' + response.status + '：API Key 无效或没有权限，请检查后重新填写。');
                    throw new Error('API Key 无效或没有权限（HTTP ' + response.status + '）');
                }
                throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
                const aiContent = data.choices[0].message.content.trim();
                
                // 先清理Markdown格式符号
                let cleanedAnswer = cleanMarkdownFormat(aiContent);
                
                // 再移除引号和开头的编号（保留原有的清理逻辑）
                cleanedAnswer = cleanedAnswer
                    .replace(/['""'"'.]/g, '')
                    .replace(/^\d+\.\s*/, '')
                    .trim();
                
                return cleanedAnswer;
            } else if (data.error) {
                let errorMessage = `API Error: ${data.error.message}`;
                if (data.error.code === 'invalid_api_key') {
                    errorMessage += " (API Key 无效，请在设置面板中更新)";
                    openAISettingsDialog('DeepSeek 返回 API Key 无效，请重新填写。');
                } else if (data.error.code === 'insufficient_quota') {
                    errorMessage += " (额度不足，请充值)";
                } else if (data.error.code === 'model_not_found') {
                    errorMessage += " (模型不存在或不可用)";
                }
                throw new Error(errorMessage);
            } else {
                throw new Error('DeepSeek API 返回未知格式的响应或空响应。');
            }
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('网络连接失败，请检查网络连接或稍后再试。');
            }
            throw error;
        }
    }

    /**
     * 根据AI答案数据填充到页面表单中
     */
    function fillAnswersFromAI(answersData = {}) {
        console.log('[AI答题] 开始填充AI答案到页面...');
        console.log('[AI答题] 答案数据包含:', Object.keys(answersData).length, '道题目');
        
        const questions = document.querySelectorAll('div.questionLi');
        
        if (questions.length === 0) {
            console.error('[AI答题] 未找到题目元素 (div.questionLi)');
            return;
        }
        
        console.log(`[AI答题] 检测到 ${questions.length} 道题目，开始填充...`);
        
        let filledCount = 0;
        
        questions.forEach((question, index) => {
            const questionHash = question.dataset.questionId || `q-${index}`;
            const answerData = answersData[questionHash];
            
            if (!answerData || answerData.error) {
                return;
            }
            
            const aiAnswer = answerData.answer;
            const questionType = answerData.type;
            
            if (questionType === '单选题' || questionType === '多选题') {
                const optionDivs = question.querySelectorAll('div.answerBg');
                const answerLetters = aiAnswer.toUpperCase().split('');
                
                answerLetters.forEach(letter => {
                    const optionIndex = letter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
                    
                    if (optionIndex >= 0 && optionIndex < optionDivs.length) {
                        const targetDiv = optionDivs[optionIndex];
                        
                        // 检查选项是否已经被选择（通过查找check_answer_dx或check_answer类）
                        const isAlreadySelected = targetDiv.querySelector('.check_answer_dx') !== null ||
                            targetDiv.querySelector('.check_answer') !== null;
                        
                        if (!isAlreadySelected) {
                            // 直接点击整个answerBg div来选择选项
                            try {
                                targetDiv.click();
                                filledCount++;
                            } catch (error) {
                                // 静默处理错误
                            }
                        }
                    }
                });
            } else if (questionType === '判断题') {
                const optionDivs = question.querySelectorAll('div.answerBg');
                const isCorrect = aiAnswer.includes('对') || aiAnswer.includes('正确') || aiAnswer.includes('True') || aiAnswer.toLowerCase().includes('true') ||
                    aiAnswer.includes('√') || aiAnswer.includes('T') || aiAnswer.includes('t');
                const targetIndex = isCorrect ? 0 : 1; // 对=0, 错=1
                
                if (targetIndex < optionDivs.length) {
                    const targetDiv = optionDivs[targetIndex];
                    
                    // 检查选项是否已经被选择（通过查找check_answer_dx或check_answer类）
                    const isAlreadySelected = targetDiv.querySelector('.check_answer_dx') !== null ||
                        targetDiv.querySelector('.check_answer') !== null;
                    
                    if (!isAlreadySelected) {
                        // 直接点击整个answerBg div来选择判断选项
                        try {
                            targetDiv.click();
                            filledCount++;
                        } catch (error) {
                            // 静默处理错误
                        }
                    }
                }
            } else if (questionType === '填空题' || questionType === '简答题') {
                // 查找题目DOM内的iframe
                const iframes = question.querySelectorAll('iframe');
                iframes.forEach((iframe) => {
                    try {
                        // 获取iframe内的文档
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        if (iframeDoc) {
                            // 查找iframe内的p标签
                            const pTags = iframeDoc.querySelectorAll('p');
                            pTags.forEach((pTag) => {
                                if (pTag.textContent.trim() === '' || pTag.innerHTML.trim() === '' || pTag.innerHTML === '<br>') {
                                    pTag.innerHTML = aiAnswer;
                                    // 触发输入事件以确保内容被保存
                                    pTag.dispatchEvent(new Event('input', { bubbles: true }));
                                    filledCount++;
                                }
                            });
                        }
                    } catch (error) {
                        // 如果无法访问iframe内容（跨域等问题），回退到原来的textarea方式
                        const textareas = question.querySelectorAll('textarea');
                        textareas.forEach((textarea) => {
                            if (textarea.value.trim() === '') {
                                textarea.value = aiAnswer;
                                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                                filledCount++;
                            }
                        });
                    }
                });
                
                // 如果没有找到iframe，也尝试textarea方式作为备用
                if (iframes.length === 0) {
                    const textareas = question.querySelectorAll('textarea');
                    textareas.forEach((textarea) => {
                        if (textarea.value.trim() === '') {
                            textarea.value = aiAnswer;
                            textarea.dispatchEvent(new Event('input', { bubbles: true }));
                            filledCount++;
                        }
                    });
                }
            }
        });
        
        console.log(`[AI答题] 填充完成！成功填充 ${filledCount} 个项目`);

        // 填充完成后，恢复鼠标指针
        document.body.style.cursor = 'default';
    }

    // 立即初始化脚本（不等待DOMContentLoaded）
    console.log('[AI答题] 调用 initScript()...');
    initScript();
})();