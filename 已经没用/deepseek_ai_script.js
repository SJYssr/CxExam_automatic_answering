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
    const DEEPSEEK_API_KEY = '';
    const DEEPSEEK_API_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
    const AI_MODEL = 'deepseek-chat';

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
        
        // 页面加载后自动获取答案
        console.log('[AI答题] 页面加载完成，开始自动获取AI答案...');
        fetchAllAnswers();
        
        console.log('[AI答题] 脚本初始化完成');
        console.log('[AI答题] 使用说明: 鼠标中键=填充答案 | 自动获取答案');
    }

    // 全局变量用于防止重复执行
    let isProcessing = false;

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
        if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY.trim() === '') {
            console.error('[AI答题]API Key 未配置');
            isProcessing = false;
            return;
        }
        
        console.log('[AI答题]API Key 已配置，开始处理题目...');
        
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
            
            prompt += `请根据题目类型和选项，给出最佳答案。答案格式为：\n单选题/多选题：仅字母，如 "A" 或 "AB"\n判断题： "对" 或 "错"\n填空题： 建议填充内容，如 "1"\n简答题： 答案,解析，如 "人工智能是模拟人类智能的技术,解析:因为人工智能通过算法模拟人类思维过程，数据分析帮助机器学习和决策"\n\n你的答案：`;
            
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
     * 向 DeepSeek API 发送请求获取答案
     */
    async function fetchDeepSeekAnswer(prompt) {
        try {
            const response = await fetch(DEEPSEEK_API_ENDPOINT, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: AI_MODEL,
                    messages: [
                        { role: "system", content: "你是一个专业的考试辅导AI，请根据题目和选项，直接给出最准确的答案。对于简答题，请返回格式为'答案,这样回答的原因'。不要解释，不要说任何多余的话。如果需要，请直接给出选项字母（如：A, B, AB），或者\"对\"、\"错\"，或者填充内容（如：1）。" },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 100,
                    stream: false
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
                const aiContent = data.choices[0].message.content.trim();
                const cleanedAnswer = aiContent
                    .split('\n')[0]
                    .trim()
                    .replace(/['""'"'.]/g, '')
                    .replace(/^\d+\.\s*/, '');
                
                return cleanedAnswer;
            } else if (data.error) {
                let errorMessage = `API Error: ${data.error.message}`;
                if (data.error.code === 'invalid_api_key') {
                    errorMessage += " (API Key 无效，请检查)";
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
                const isCorrect = aiAnswer.includes('对') || aiAnswer.includes('正确') || aiAnswer.includes('True') || aiAnswer.toLowerCase().includes('true');
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