// 本地题库前端脚本 - 与DLL注入器集成
// 功能：从本地题库服务获取答案，替代AI服务

(function() {
    'use strict';

    console.log('[本地题库前端] 脚本开始执行');

    // 本地题库API配置
    const LOCAL_TIKU_API_URL = 'http://localhost:3001';

    // =====页面检测逻辑=====
    function isChaoxingExamPage() {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;
        
        console.log('[本地题库前端] 当前页面:', hostname, pathname);
        
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
        console.log('不是超星学习通考试页面，本地题库前端脚本不加载');
        return;
    }

    console.log('[本地题库前端]页面检测通过，准备加载脚本...');

    // 检查是否已加载，避免重复加载
    if (window.__localTikuFrontendLoaded) {
        console.log('本地题库前端脚本已加载，避免重复执行');
        return;
    }
    window.__localTikuFrontendLoaded = true;

    // 初始化脚本
    function initLocalTikuScript() {
        console.log('[本地题库前端] 脚本初始化中');
        
        // 监听鼠标中键 - 填充本地题库答案
        document.addEventListener('mousedown', function(event) {
            if (event.button === 1) { // 鼠标中键
                event.preventDefault();
                console.log('[本地题库前端] 用户按下了鼠标中键');
                
                if (window.localTikuAnswersData && Object.keys(window.localTikuAnswersData).length > 0) {
                    console.log('[本地题库前端] 检测到本地题库答案数据，开始填充');
                    fillAnswersFromLocalTiku(window.localTikuAnswersData);
                    // 填充后清除数据
                    window.localTikuAnswersData = null;
                } else {
                    console.log('[本地题库前端] 未检测到本地题库答案数据，正在自动获取...');
                    fetchAllAnswersFromLocalTiku();
                }
            }
        });
        
        // 页面加载后自动获取答案
        console.log('[本地题库前端] 页面加载完成，开始自动获取本地题库答案...');
        fetchAllAnswersFromLocalTiku();
        
        console.log('[本地题库前端] 脚本初始化完成');
        console.log('[本地题库前端] 使用说明: 鼠标中键=填充答案 | 自动获取答案');
    }

    // 全局变量用于防止重复执行
    let isProcessing = false;

    /**
     * 获取所有题目的数据（题目和选项）
     */
    function getAllQuestionsData() {
        console.log('[本地题库前端] 开始获取题目数据...');
        
        const questions = document.querySelectorAll('div.questionLi');
        if (questions.length === 0) {
            console.error('[本地题库前端] 未找到题目元素 (div.questionLi)');
            return [];
        }
        
        console.log(`[本地题库前端] 检测到 ${questions.length} 道题目`);
        
        const questionsData = [];
        
        questions.forEach((question, index) => {
            const titleElement = question.querySelector('h3.mark_name');
            if (!titleElement) {
                return;
            }
            
            const questionTextFull = titleElement.textContent.trim();
            const questionHash = question.dataset.questionId || `q-${index}`;
            
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
            
            const options = [];
            const optionDivs = question.querySelectorAll('div.answerBg');
            if (optionDivs.length > 0) {
                optionDivs.forEach((optionDiv, optIndex) => {
                    const optionLabel = String.fromCharCode(65 + optIndex);
                    const clearfixDiv = optionDiv.querySelector('div.clearfix');
                    const optionContent = clearfixDiv ? clearfixDiv.textContent : optionDiv.textContent;
                    options.push(`${optionLabel}. ${optionContent.trim()}`);
                });
            }
            
            questionsData.push({
                questionHash: questionHash,
                question: questionTextFull,
                options: options,
                questionType: questionType
            });
        });
        
        console.log(`[本地题库前端] 成功获取 ${questionsData.length} 道题目数据`);
        return questionsData;
    }

    /**
     * 从本地题库服务获取所有题目的答案
     */
    async function fetchAllAnswersFromLocalTiku() {
        console.log('[本地题库前端] 开始从本地题库服务获取答案...');
        
        // 检查是否正在处理中
        if (isProcessing) {
            console.warn('[本地题库前端] 正在处理中，忽略重复请求');
            return;
        }
        
        // 设置处理状态
        isProcessing = true;
        
        try {
            // 首先检查本地题库服务是否可用
            const healthResponse = await fetch(`${LOCAL_TIKU_API_URL}/health`);
            if (!healthResponse.ok) {
                throw new Error('本地题库服务不可用');
            }
            
            const healthData = await healthResponse.json();
            if (!healthData.tikuLoaded) {
                throw new Error('本地题库未加载，请先导入题库文件');
            }
            
            console.log(`[本地题库前端] 本地题库服务正常，题库包含 ${healthData.questionCount} 道题目`);
            
            // 获取题目数据
            const questionsData = getAllQuestionsData();
            if (questionsData.length === 0) {
                console.error('[本地题库前端] 未获取到题目数据');
                isProcessing = false;
                return;
            }
            
            console.log(`[本地题库前端] 准备向本地题库服务发送 ${questionsData.length} 道题目`);
            
            // 向本地题库服务发送批量请求
            const response = await fetch(`${LOCAL_TIKU_API_URL}/api/get-batch-answers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ questions: questionsData })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.message);
            }
            
            console.log('[本地题库前端] 本地题库服务返回答案数据:', result);
            
            // 处理返回的答案数据
            const answersData = {};
            result.answers.forEach(answer => {
                if (!answer.error && answer.success) {
                    answersData[answer.questionHash] = {
                        answer: answer.answer,
                        type: answer.questionType
                    };
                } else {
                    console.warn(`[本地题库前端] 题目 ${answer.questionHash} 获取答案失败:`, answer.message);
                }
            });
            
            console.log(`[本地题库前端] 成功获取 ${Object.keys(answersData).length} 道题目的答案`);
            
            // 将答案数据存储到全局变量中供填充
            window.localTikuAnswersData = answersData;
            
            // 答案准备就绪，改变鼠标指针为手形
            document.body.style.cursor = 'pointer';
            
        } catch (error) {
            console.error('[本地题库前端] 从本地题库服务获取答案时发生错误:', error);
            
            // 获取答案失败，恢复鼠标指针
            document.body.style.cursor = 'default';
            
        } finally {
            // 重置处理状态
            isProcessing = false;
            console.log('🔄 处理状态已重置');
        }
    }

    /**
     * 根据本地题库答案数据填充到页面表单中
     */
    function fillAnswersFromLocalTiku(answersData = {}) {
        console.log('[本地题库前端] 开始填充本地题库答案到页面...');
        console.log('[本地题库前端] 答案数据包含:', Object.keys(answersData).length, '道题目');
        
        const questions = document.querySelectorAll('div.questionLi');
        
        if (questions.length === 0) {
            console.error('[本地题库前端] 未找到题目元素 (div.questionLi)');
            return;
        }
        
        console.log(`[本地题库前端] 检测到 ${questions.length} 道题目，开始填充...`);
        
        let filledCount = 0;
        
        questions.forEach((question, index) => {
            const questionHash = question.dataset.questionId || `q-${index}`;
            const answerData = answersData[questionHash];
            
            if (!answerData) {
                return;
            }
            
            const localAnswer = answerData.answer;
            const questionType = answerData.type;
            
            console.log(`[本地题库前端] 填充题目 ${questionHash}: ${localAnswer}`);
            
            if (questionType === '单选题' || questionType === '多选题') {
                const optionDivs = question.querySelectorAll('div.answerBg');
                const answerLetters = localAnswer.toUpperCase().split('');
                
                answerLetters.forEach(letter => {
                    const optionIndex = letter.charCodeAt(0) - 65; // A=0, B=1, C=2, D=3
                    
                    if (optionIndex >= 0 && optionIndex < optionDivs.length) {
                        const targetDiv = optionDivs[optionIndex];
                        
                        // 检查选项是否已经被选择
                        const isAlreadySelected = targetDiv.querySelector('.check_answer_dx') !== null ||
                            targetDiv.querySelector('.check_answer') !== null;
                        
                        if (!isAlreadySelected) {
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
                const isCorrect = localAnswer.includes('对') || localAnswer.includes('正确') || localAnswer.includes('True') || localAnswer.toLowerCase().includes('true');
                const targetIndex = isCorrect ? 0 : 1; // 对=0, 错=1
                
                if (targetIndex < optionDivs.length) {
                    const targetDiv = optionDivs[targetIndex];
                    
                    const isAlreadySelected = targetDiv.querySelector('.check_answer_dx') !== null ||
                        targetDiv.querySelector('.check_answer') !== null;
                    
                    if (!isAlreadySelected) {
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
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        if (iframeDoc) {
                            const pTags = iframeDoc.querySelectorAll('p');
                            pTags.forEach((pTag) => {
                                if (pTag.textContent.trim() === '' || pTag.innerHTML.trim() === '' || pTag.innerHTML === '<br>') {
                                    pTag.innerHTML = localAnswer;
                                    pTag.dispatchEvent(new Event('input', { bubbles: true }));
                                    filledCount++;
                                }
                            });
                        }
                    } catch (error) {
                        // 回退到textarea方式
                        const textareas = question.querySelectorAll('textarea');
                        textareas.forEach((textarea) => {
                            if (textarea.value.trim() === '') {
                                textarea.value = localAnswer;
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
                            textarea.value = localAnswer;
                            textarea.dispatchEvent(new Event('input', { bubbles: true }));
                            filledCount++;
                        }
                    });
                }
            }
        });
        
        console.log(`[本地题库前端] 填充完成！成功填充 ${filledCount} 个项目`);

        // 填充完成后，恢复鼠标指针
        document.body.style.cursor = 'default';
    }

    // 立即初始化脚本（不等待DOMContentLoaded）
    console.log('[本地题库前端] 调用 initLocalTikuScript()...');
    initLocalTikuScript();
})();
