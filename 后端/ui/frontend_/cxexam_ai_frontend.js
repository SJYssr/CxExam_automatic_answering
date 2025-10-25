// 超星学习通考试AI辅助填充脚本 - 前端部分
// 功能：获取题目和选项，与后端通信获取AI答案，填充答案

(function() {
    'use strict';

    console.log('[AI答题前端] 脚本开始执行');

    // 后端API配置
    const BACKEND_API_URL = 'http://localhost:3000';

    // =====页面检测逻辑=====
    function isChaoxingExamPage() {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;
        
        console.log('[AI答题前端] 当前页面:', hostname, pathname);
        
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
        console.log('不是超星学习通考试页面，AI前端脚本不加载');
        return;
    }

    console.log('[AI答题前端]页面检测通过，准备加载脚本...');

    // 检查是否已加载，避免重复加载
    if (window.__deepseekAIFrontendLoaded) {
        console.log('AI答题前端脚本已加载，避免重复执行');
        return;
    }
    window.__deepseekAIFrontendLoaded = true;

    // 初始化脚本
    function initFrontendScript() {
        console.log('[AI答题前端] 脚本初始化中');
        
        // 监听鼠标中键 - 填充AI答案
        document.addEventListener('mousedown', function(event) {
            if (event.button === 1) { // 鼠标中键
                event.preventDefault();
                console.log('[AI答题前端] 用户按下了鼠标中键');
                
                if (window.aiAnswersData && Object.keys(window.aiAnswersData).length > 0) {
                    console.log('[AI答题前端] 检测到AI答案数据，开始填充');
                    fillAnswersFromAI(window.aiAnswersData);
                    // 填充后清除数据
                    window.aiAnswersData = null;
                } else {
                    console.log('[AI答题前端] 未检测到AI答案数据，正在自动获取...');
                    fetchAllAnswersFromBackend();
                }
            }
        });
        
        // 页面加载后自动获取答案
        console.log('[AI答题前端] 页面加载完成，开始自动获取AI答案...');
        fetchAllAnswersFromBackend();
        
        console.log('[AI答题前端] 脚本初始化完成');
        console.log('[AI答题前端] 使用说明: 鼠标中键=填充答案 | 自动获取答案');
    }

    // 全局变量用于防止重复执行
    let isProcessing = false;

    /**
     * 获取所有题目的数据（题目和选项）
     */
    function getAllQuestionsData() {
        console.log('[AI答题前端] 开始获取题目数据...');
        
        const questions = document.querySelectorAll('div.questionLi');
        if (questions.length === 0) {
            console.error('[AI答题前端] 未找到题目元素 (div.questionLi)');
            return [];
        }
        
        console.log(`[AI答题前端] 检测到 ${questions.length} 道题目`);
        
        const questionsData = [];
        
        questions.forEach((question, index) => {
            const titleElement = question.querySelector('h3.mark_name');
            if (!titleElement) {
                return;
            }
            
            // 移除题号前缀（如"1."、"2."等）
            const questionTextFull = titleElement.textContent.trim().replace(/^\d+\.\s*/, '');
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
        
        console.log(`[AI答题前端] 成功获取 ${questionsData.length} 道题目数据`);
        return questionsData;
    }

    /**
     * 从后端获取所有题目的AI答案
     */
    async function fetchAllAnswersFromBackend() {
        console.log('[AI答题前端] 开始从后端获取AI答案...');
        
        // 检查是否正在处理中
        if (isProcessing) {
            console.warn('[AI答题前端] 正在处理中，忽略重复请求');
            return;
        }
        
        // 设置处理状态
        isProcessing = true;
        
        try {
            // 获取题目数据
            const questionsData = getAllQuestionsData();
            if (questionsData.length === 0) {
                console.error('[AI答题前端] 未获取到题目数据');
                isProcessing = false;
                return;
            }
            
            console.log(`[AI答题前端] 准备向后端发送 ${questionsData.length} 道题目`);
            
            // 向后端发送批量请求
            const response = await fetch(`${BACKEND_API_URL}/api/get-batch-answers`, {
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
            
            console.log('[AI答题前端] 后端返回答案数据:', result);
            
            // 处理返回的答案数据
            const answersData = {};
            result.answers.forEach(answer => {
                if (!answer.error) {
                    answersData[answer.questionHash] = {
                        answer: answer.answer,
                        type: answer.questionType
                    };
                } else {
                    console.warn(`[AI答题前端] 题目 ${answer.questionHash} 获取答案失败:`, answer.message);
                }
            });
            
            console.log(`[AI答题前端] 成功获取 ${Object.keys(answersData).length} 道题目的答案`);
            
            // 将答案数据存储到全局变量中供填充
            window.aiAnswersData = answersData;
            
            // 只有当成功获取到答案时才改变鼠标指针为手形
            if (Object.keys(answersData).length > 0) {
                document.body.style.cursor = 'pointer';
            } else {
                // 没有获取到答案，保持默认鼠标指针
                document.body.style.cursor = 'default';
            }
            
        } catch (error) {
            console.error('[AI答题前端] 从后端获取AI答案时发生错误:', error);
            
            // 获取答案失败，恢复鼠标指针
            document.body.style.cursor = 'default';
            
        } finally {
            // 重置处理状态
            isProcessing = false;
            console.log('🔄 处理状态已重置');
        }
    }

    /**
     * 根据AI答案数据填充到页面表单中
     */
    function fillAnswersFromAI(answersData = {}) {
        console.log('[AI答题前端] 开始填充AI答案到页面...');
        console.log('[AI答题前端] 答案数据包含:', Object.keys(answersData).length, '道题目');
        
        const questions = document.querySelectorAll('div.questionLi');
        
        if (questions.length === 0) {
            console.error('[AI答题前端] 未找到题目元素 (div.questionLi)');
            return;
        }
        
        console.log(`[AI答题前端] 检测到 ${questions.length} 道题目，开始填充...`);
        
        let filledCount = 0;
        
        questions.forEach((question, index) => {
            const questionHash = question.dataset.questionId || `q-${index}`;
            const answerData = answersData[questionHash];
            
            if (!answerData) {
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
        
        console.log(`[AI答题前端] 填充完成！成功填充 ${filledCount} 个项目`);

        // 填充完成后，恢复鼠标指针
        document.body.style.cursor = 'default';
    }

    // 立即初始化脚本（不等待DOMContentLoaded）
    console.log('[AI答题前端] 调用 initFrontendScript()...');
    initFrontendScript();
})();