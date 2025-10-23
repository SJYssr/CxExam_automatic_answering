const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// 导入日志系统
const logger = require('./logger');

// DeepSeek API配置
const DEEPSEEK_API_KEY = 'sk-b18807239d424cc19cdac7e9a8c20551';

// 登录状态管理
let loginStatus = {
    isLoggedIn: false,
    token: null,
    lastLoginTime: null,
    aiAccessEnabled: false  // AI调用权限状态
};

// 获取缓存token的函数（已弃用，保留函数结构）
function getCachedToken() {
    // 此函数已不再使用，返回null
    return null;
}

// 验证token是否有效
function validateToken() {
    // 真正的token验证：检查token是否有效（非空、有内容）
    if (loginStatus.token && loginStatus.token.trim() && loginStatus.token.length > 10) {
        loginStatus.aiAccessEnabled = true;
        loginStatus.isLoggedIn = true; // 确保登录状态同步
        logger.info('[验证] 验证通过，AI调用权限已开启');
        return true;
    } else {
        loginStatus.aiAccessEnabled = false;
        loginStatus.isLoggedIn = false; // 确保登录状态同步
        logger.info('[验证] 验证失败，AI调用权限已关闭');
        return false;
    }
}

// AI调用权限验证中间件
function requireAIAccess(req, res, next) {
    // 直接使用登录时设置的权限状态，不再每次验证
    req.aiAccessEnabled = loginStatus.aiAccessEnabled;
    
    if (req.aiAccessEnabled) {
        logger.info('[验证] AI调用权限已启用');
    } else {
        logger.info('[验证] AI调用权限未启用，仅使用本地题库');
    }
    next();
}

// 服务器配置
const PORT = 3000;

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// DeepSeek API配置
const DEEPSEEK_API_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const AI_MODEL = 'deepseek-chat';

// 题库文件路径
const TIKU_FILE_PATH = path.join(__dirname, 'tiku.txt');
const TIKU_CACHE_PATH = path.join(__dirname, 'tiku.json');

/**
 * 解析题库文件，转换为前端格式
 */
function parseTikuFile() {
    try {
        if (!fs.existsSync(TIKU_FILE_PATH)) {
            logger.warn('[题库解析] 题库文件不存在:', TIKU_FILE_PATH);
            return [];
        }
        
        const content = fs.readFileSync(TIKU_FILE_PATH, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        const questions = [];
        let currentQuestion = null;
        let currentOptions = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 检测题目开始（数字开头）
            if (/^\d+\./.test(line)) {
                // 保存上一个题目
                if (currentQuestion) {
                    questions.push(currentQuestion);
                }
                
                // 开始新题目
                const questionText = line.replace(/^\d+\.\s*/, '').trim();
                currentQuestion = {
                    questionHash: `tiku-${questions.length + 1}`,
                    question: questionText,
                    options: [],
                    questionType: '未知类型',
                    answer: '' // 新增答案字段
                };
                currentOptions = [];
                
                // 自动识别题目类型
                if (questionText.includes('______')) {
                    currentQuestion.questionType = '填空题';
                } else if (questionText.includes('简述') || questionText.includes('请简述')) {
                    currentQuestion.questionType = '简答题';
                }
            }
            // 检测选项（字母开头）
            else if (/^[A-D]\./.test(line)) {
                // 去除选项字母后的多余空格
                const cleanOption = line.replace(/^[A-D]\.\s*/, (match) => match.replace(/\s+$/, '')).trim();
                currentOptions.push(cleanOption);
                
                // 如果是判断题选项，设置题目类型
                if (line.includes('对') || line.includes('错')) {
                    currentQuestion.questionType = '判断题';
                }
            }
            // 检测答案行（支持中文冒号和英文冒号）
            else if (line.startsWith('答案:') || line.startsWith('答案：')) {
                const answer = line.replace(/^答案[:：]/, '').trim();
                
                // 根据答案格式确定题目类型
                if (currentQuestion.questionType === '未知类型') {
                    if (answer.length === 1 && /[A-D]/.test(answer)) {
                        currentQuestion.questionType = '单选题';
                    } else if (answer.length > 1 && /[A-D]+/.test(answer)) {
                        currentQuestion.questionType = '多选题';
                    } else if (answer === 'A' || answer === 'B') {
                        // 判断题答案通常是A或B
                        currentQuestion.questionType = '判断题';
                    } else {
                        // 其他情况默认为填空题
                        currentQuestion.questionType = '填空题';
                    }
                }
                
                // 设置选项
                if (currentOptions.length > 0) {
                    currentQuestion.options = currentOptions;
                }
                
                // 设置答案
                currentQuestion.answer = answer;
                
                // 保存题目
                questions.push(currentQuestion);
                currentQuestion = null;
                currentOptions = [];
            }
        }
        
        // 保存最后一个题目
        if (currentQuestion) {
            questions.push(currentQuestion);
        }
        
        return questions;
        
    } catch (error) {
        logger.error('[题库解析] 解析题库文件时发生错误:', error.message);
        return [];
    }
}

/**
 * 生成题库缓存文件
 */
function generateTikuCache() {
    try {
        const questions = parseTikuFile();
        if (questions.length === 0) {
            logger.warn('[题库] 未解析到题目，跳过');
            return;
        }
        
        const cacheData = {
            timestamp: new Date().toISOString(),
            total: questions.length,
            questions: questions
        };
        
        fs.writeFileSync(TIKU_CACHE_PATH, JSON.stringify(cacheData, null, 2), 'utf8');
        
    } catch (error) {
        logger.error('[题库] 发生错误:', error.message);
    }
}

/**
 * 调用AI解答问题的函数
 */
async function getAIAnswer(question, options, questionType) {
    // 构建AI提示词
    let prompt = `你是AI答题助手，分析以下试题，给出最合适的答案。仅返回答案，不要解释(如果解释将会导致返回格式错误)。规则：选择题，请直接给出选项字母（如：A, B, AB, 对, 错）。如果填空题或简答题，请给出简洁的填充内容（如：1，苹果;香蕉，等等），并且不能带有md格式字符。\n\n题目：${question}\n`;
    
    if (options && options.length > 0) {
        prompt += `选项：\n${options.join('\n')}\n`;
    }
    
    // 根据题目类型调整提示词
    if (questionType === '简答题') {
        prompt += `\n【简答题答题要求】
1. 答案结构：核心观点 + 详细阐述 + 总结
2. 内容要求：
   - 核心观点：用1-2句话概括核心答案
   - 详细阐述：分点说明，每点不超过30字
   - 总结：用1句话总结答案要点
3. 格式要求：答案内容控制在100-200字之间，语言简洁专业
4. 质量要求：答案要准确、完整、逻辑清晰，避免口语化表达

【示例格式】
核心观点：人工智能是模拟人类智能的技术。
详细阐述：
1. 通过算法模拟人类思维过程
2. 数据分析帮助机器学习和决策
3. 能够处理复杂任务和模式识别
总结：人工智能技术正在改变人类生活和工作方式。

请根据以上要求，给出专业、准确的简答题答案：`;
    } else {
        prompt += `请根据题目类型和选项，给出最佳答案。答案格式为：\n单选题/多选题：仅字母，如 \"A\" 或 \"AB\"\n判断题： \"对\" 或 \"错\"\n填空题： 建议填充内容，如 \"1\"\n\n你的答案：`;
    }
    
    // 调用DeepSeek API
    const response = await axios.post(DEEPSEEK_API_ENDPOINT, {
        model: AI_MODEL,
        messages: [
            { 
                role: "system", 
                content: "你是一个专业的考试辅导AI，请根据题目和选项，直接给出最准确的答案。对于简答题，请按照'核心观点 + 详细阐述 + 总结'的结构给出专业答案，答案控制在100-200字之间，语言简洁专业。对于选择题，请直接给出选项字母（如：A, B, AB），判断题给出\"对\"或\"错\"，填空题给出简洁填充内容。不要解释，不要说任何多余的话。绝对不要使用任何Markdown格式字符，包括：* ** # - > ` [ ] ( ) 等符号。" 
            },
            { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 100,
        stream: false
    }, {
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        }
    });
    
    if (response.data.choices && response.data.choices.length > 0 && 
        response.data.choices[0].message && response.data.choices[0].message.content) {
        
        const aiContent = response.data.choices[0].message.content.trim();
        const cleanedAnswer = aiContent
            .split('\n')[0]
            .trim()
            .replace(/['"""'.]/g, '')
            .replace(/^\d+\.\s*/, '')
            // 移除所有Markdown格式字符
            .replace(/[*#_\-`>\[\]()]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        logger.info(`[AI] AI返回答案: ${cleanedAnswer}`);
        
        return cleanedAnswer;
        
    } else {
        throw new Error('DeepSeek API 返回未知格式的响应');
    }
}

/**
 * 中文分词函数 - 简单的按字符分割
 */
function simpleChineseTokenizer(text) {
    // 移除标点符号和空格，然后按字符分割
    const cleanedText = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
    return cleanedText.split('').filter(char => char.length > 0);
}

/**
 * 计算词频向量
 */
function calculateTermFrequencyVector(tokens) {
    const vector = {};
    tokens.forEach(token => {
        vector[token] = (vector[token] || 0) + 1;
    });
    return vector;
}

/**
 * 计算余弦相似度
 */
function calculateCosineSimilarity(vec1, vec2) {
    // 获取所有唯一的词
    const allTerms = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (const term of allTerms) {
        const v1 = vec1[term] || 0;
        const v2 = vec2[term] || 0;
        
        dotProduct += v1 * v2;
        magnitude1 += v1 * v1;
        magnitude2 += v2 * v2;
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) {
        return 0;
    }
    
    return dotProduct / (magnitude1 * magnitude2);
}

/**
 * 提取选项内容（移除选项字母前缀）
 */
function extractOptionContent(option) {
    // 移除 "A.", "B." 等前缀，保留选项内容
    return option.replace(/^[A-D]\.\s*/, '').trim();
}

/**
 * 计算选项列表的相似度（使用词频向量和余弦相似度）
 */
function calculateOptionsSimilarity(options1, options2) {
    if (options1.length !== options2.length) {
        return 0; // 选项数量不同，相似度为0
    }
    
    // 提取选项内容
    const content1 = options1.map(extractOptionContent);
    const content2 = options2.map(extractOptionContent);
    
    // 首先检查是否完全匹配（快速路径）
    const sorted1 = [...content1].sort();
    const sorted2 = [...content2].sort();
    const isExactMatch = sorted1.every((content, index) => content === sorted2[index]);
    
    if (isExactMatch) {
        return 1.0; // 完全匹配，相似度为1.0
    }
    
    // 计算每个选项的相似度
    let totalSimilarity = 0;
    let matchedPairs = 0;
    
    // 使用贪心算法找到最佳匹配对
    const usedIndices = new Set();
    
    for (let i = 0; i < content1.length; i++) {
        let bestMatchIndex = -1;
        let bestSimilarity = 0;
        
        for (let j = 0; j < content2.length; j++) {
            if (usedIndices.has(j)) continue;
            
            // 计算两个选项内容的相似度
            const tokens1 = simpleChineseTokenizer(content1[i]);
            const tokens2 = simpleChineseTokenizer(content2[j]);
            
            // 如果内容完全相同，相似度为1.0
            if (content1[i] === content2[j]) {
                bestSimilarity = 1.0;
                bestMatchIndex = j;
                break;
            }
            
            const vector1 = calculateTermFrequencyVector(tokens1);
            const vector2 = calculateTermFrequencyVector(tokens2);
            
            const similarity = calculateCosineSimilarity(vector1, vector2);
            
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatchIndex = j;
            }
        }
        
        if (bestMatchIndex !== -1) {
            totalSimilarity += bestSimilarity;
            matchedPairs++;
            usedIndices.add(bestMatchIndex);
        }
    }
    
    // 计算平均相似度
    return matchedPairs > 0 ? totalSimilarity / matchedPairs : 0;
}

/**
 * 检查两个选项列表是否包含相同的选项内容（忽略顺序）
 */
function areOptionsEquivalent(options1, options2) {
    if (options1.length !== options2.length) {
        return false;
    }
    
    // 提取选项内容并排序
    const content1 = options1.map(extractOptionContent).sort();
    const content2 = options2.map(extractOptionContent).sort();
    
    // 比较排序后的选项内容
    return content1.every((content, index) => content === content2[index]);
}

/**
 * 检查是否为判断题选项
 */
function isTrueFalseQuestion(options) {
    if (options.length !== 2) return false;
    
    const contents = options.map(extractOptionContent);
    return (contents.includes('对') && contents.includes('错')) ||
           (contents.includes('正确') && contents.includes('错误')) ||
           (contents.includes('是') && contents.includes('否'));
}

/**
 * 根据选项顺序映射答案
 */
function mapAnswerByOptionOrder(cachedAnswer, cachedOptions, currentOptions) {
    // 如果是判断题，直接返回原答案（判断题答案不随选项顺序变化）
    if (isTrueFalseQuestion(cachedOptions) && isTrueFalseQuestion(currentOptions)) {
        return cachedAnswer;
    }
    
    // 如果是填空题、简答题或没有选项，直接返回原答案
    if (!cachedOptions || cachedOptions.length === 0) {
        return cachedAnswer;
    }
    
    // 提取选项内容
    const cachedContents = cachedOptions.map(extractOptionContent);
    const currentContents = currentOptions.map(extractOptionContent);
    
    let mappedAnswer = '';
    
    // 处理单选题和多选题
    for (let i = 0; i < cachedAnswer.length; i++) {
        const answerChar = cachedAnswer[i];
        const answerIndex = answerChar.charCodeAt(0) - 'A'.charCodeAt(0);
        
        if (answerIndex >= 0 && answerIndex < cachedContents.length) {
            const correctContent = cachedContents[answerIndex];
            
            // 在当前选项中查找相同内容的选项
            const currentIndex = currentContents.findIndex(content => content === correctContent);
            
            if (currentIndex >= 0) {
                // 找到对应的选项，映射到新的选项字母
                const newAnswerChar = String.fromCharCode('A'.charCodeAt(0) + currentIndex);
                mappedAnswer += newAnswerChar;
            } else {
                // 如果找不到对应的选项，返回原答案
                return cachedAnswer;
            }
        }
    }
    
    return mappedAnswer || cachedAnswer; // 如果映射失败，返回原答案
}

/**
 * 在题库缓存中搜索匹配的题目（使用余弦相似度）
 */
function searchInTikuCache(question, options = []) {
    try {
        if (!fs.existsSync(TIKU_CACHE_PATH)) {
            return null;
        }
        
        const cacheData = JSON.parse(fs.readFileSync(TIKU_CACHE_PATH, 'utf8'));
        const questions = cacheData.questions || [];
        
        // 对搜索题目进行分词和词频向量计算
        const searchTokens = simpleChineseTokenizer(question);
        const searchVector = calculateTermFrequencyVector(searchTokens);
        
        let bestMatch = null;
        let highestSimilarity = 0;
        const similarityThreshold = 0.7; // 相似度阈值
        
        for (const cachedQuestion of questions) {
            // 对缓存题目进行分词和词频向量计算
            const cachedTokens = simpleChineseTokenizer(cachedQuestion.question);
            const cachedVector = calculateTermFrequencyVector(cachedTokens);
            
            // 计算余弦相似度
            const similarity = calculateCosineSimilarity(searchVector, cachedVector);
            
            // 记录最佳匹配
            if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
                bestMatch = {
                    question: cachedQuestion.question,
                    answer: cachedQuestion.answer,
                    questionType: cachedQuestion.questionType,
                    options: cachedQuestion.options || [],
                    similarity: similarity
                };
            }
        }
        
        // 如果找到相似度超过阈值的匹配
        if (bestMatch && highestSimilarity >= similarityThreshold) {
            logger.info(`[题库检索] 在中找到匹配题目`);
            logger.info(`[题库检索] 搜索题目: 长度${question.length}字符`);
            logger.info(`[题库检索] 题库题目: 长度${bestMatch.question.length}字符`);
            logger.info(`[题库检索] 相似度: ${highestSimilarity.toFixed(4)}`);
            
            // 检查选项相似度
            if (options.length > 0 && bestMatch.options.length > 0) {
                const optionsSimilarity = calculateOptionsSimilarity(options, bestMatch.options);
                logger.info(`[题库检索] 选项相似度: ${optionsSimilarity.toFixed(4)}`);
                
                // 设置选项相似度阈值
                const optionsSimilarityThreshold = 0.8;
                
                if (optionsSimilarity >= optionsSimilarityThreshold) {
                    logger.info(`[题库检索] 选项相似度超过阈值，进行答案映射`);
                    
                    // 根据当前选项顺序映射答案
                    const mappedAnswer = mapAnswerByOptionOrder(
                        bestMatch.answer, 
                        bestMatch.options, 
                        options
                    );
                    
                    if (mappedAnswer !== bestMatch.answer) {
                        logger.info(`[题库检索] 答案映射: ${bestMatch.answer} -> ${mappedAnswer}`);
                        bestMatch.answer = mappedAnswer;
                    }
                } else {
                    logger.info(`[题库检索] 选项相似度低于阈值，不进行匹配`);
                    // 选项相似度不足，返回null调用AI
                    return null;
                }
            }
            
            return bestMatch;
        }
        
        logger.info(`[题库检索] 未找到匹配题目: 长度${question.length}字符`);
        if (bestMatch) {
            logger.info(`[题库检索] 最高相似度: ${highestSimilarity.toFixed(4)} (低于阈值 ${similarityThreshold})`);
        }
        return null;
        
    } catch (error) {
        logger.error('[题库检索] 搜索题库时发生错误:', error.message);
        return null;
    }
}

/**
 * 清理题库缓存文件
 */
function cleanupTikuCache() {
    try {
        if (fs.existsSync(TIKU_CACHE_PATH)) {
            fs.unlinkSync(TIKU_CACHE_PATH);
        }
    } catch (error) {
        logger.error('[题库清理] 发生错误:', error.message);
    }
}

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'AI答题服务运行正常' });
});

// 登录状态更新端点
app.post('/api/login-status', (req, res) => {
    try {
        const { isLoggedIn, token } = req.body;
        
        if (isLoggedIn && token) {
            loginStatus.token = token;
            loginStatus.lastLoginTime = new Date();
            
            logger.info('[登录状态] 登录成功，token已更新');
            
            // 调用验证函数，只要获取到token就视为登录成功
            const isValid = validateToken();
            
            if (isValid) {
                logger.info('[验证] 登录成功，AI调用权限已开启');
                res.json({
                    success: true,
                    message: '登录状态更新成功，AI调用权限已开启'
                });
            } else {
                logger.info('[验证] 登录失败');
                res.json({
                    success: false,
                    message: '登录状态更新失败'
                });
            }
        } else {
            loginStatus.token = null;
            loginStatus.lastLoginTime = null;
            
            // 调用验证函数，清除登录状态
            validateToken();
            
            logger.info('[登录状态] 登录状态已重置');
            res.json({
                success: true,
                message: '登录状态已重置'
            });
        }
    } catch (error) {
        logger.error('[登录状态] 更新登录状态时发生错误:', error.message);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取登录状态端点
app.get('/api/login-status', (req, res) => {
    const cachedToken = getCachedToken();
    const tokenValid = validateToken();
    
    res.json({
        isLoggedIn: loginStatus.isLoggedIn,
        tokenValid: tokenValid,
        hasCachedToken: !!cachedToken,
        lastLoginTime: loginStatus.lastLoginTime
    });
});

// 获取AI答案的API端点
app.post('/api/get-answer', requireAIAccess, async (req, res) => {
    try {
        const { question, options, questionType } = req.body;
        
        // 验证必填字段
        if (!question) {
            return res.status(400).json({ 
                error: true, 
                message: '题目内容不能为空' 
            });
        }
        
        // 处理中文字符显示问题，使用ASCII字符显示题目长度
        logger.info(`[答题] 处理题目: 长度${question.length}字符`);
        
        // 第一步：先在本地题库缓存中搜索匹配的题目（无论权限验证是否通过）
        const cachedResult = searchInTikuCache(question, options);
        if (cachedResult) {
            logger.info(`[题库检索] 使用题库答案: ${cachedResult.answer}`);
            return res.json({
                success: true,
                answer: cachedResult.answer,
                questionType: cachedResult.questionType || questionType || '未知类型',
                source: 'local_cache',
                similarity: cachedResult.similarity
            });
        }
        
        // 第二步：如果本地题库没有找到答案，检查AI调用权限
        if (!req.aiAccessEnabled) {
            logger.info(`[权限验证] AI调用权限未通过，无法调用DeepSeek`);
            return res.status(403).json({
                error: true,
                message: 'AI调用权限验证失败，且本地题库中未找到匹配答案',
                fallbackToLocal: true
            });
        }
        
        // 第三步：权限验证通过，调用AI解答
        
        if (!DEEPSEEK_API_KEY) {
            return res.status(500).json({ 
                error: true, 
                message: 'API Key未配置，且本地题库中未找到匹配答案' 
            });
        }
        
        logger.info(`[题库] 本地题库未找到匹配，调用AI解答`);
        
        // 构建AI提示词
        let prompt = `你是AI答题助手，分析以下试题，给出最合适的答案。仅返回答案，不要解释(如果解释将会导致返回格式错误)。规则：选择题，请直接给出选项字母（如：A, B, AB, 对, 错）。如果填空题或简答题，请给出简洁的填充内容（如：1，苹果;香蕉，等等），并且不能带有md格式字符。\n\n题目：${question}\n`;
        
        if (options && options.length > 0) {
            prompt += `选项：\n${options.join('\n')}\n`;
        }
        
        prompt += `请根据题目类型和选项，给出最佳答案。答案格式为：\n单选题/多选题：仅字母，如 "A" 或 "AB"\n判断题： "对" 或 "错"\n填空题： 建议填充内容，如 "1"\n简答题： 答案,解析，如 "人工智能是模拟人类智能的技术,解析:因为人工智能通过算法模拟人类思维过程，数据分析帮助机器学习和决策"\n\n你的答案：`;
        
        // 调用DeepSeek API
        const response = await axios.post(DEEPSEEK_API_ENDPOINT, {
            model: AI_MODEL,
            messages: [
                { 
                    role: "system", 
                    content: "你是一个专业的考试辅导AI，请根据题目和选项，直接给出最准确的答案。对于简答题，请返回格式为'答案,这样回答的原因'。不要解释，不要说任何多余的话。如果需要，请直接给出选项字母（如：A, B, AB），或者\"对\"、\"错\"，或者填充内容（如：1）。" 
                },
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 100,
            stream: false
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
            }
        });
        
        if (response.data.choices && response.data.choices.length > 0 && 
            response.data.choices[0].message && response.data.choices[0].message.content) {
            
            const aiContent = response.data.choices[0].message.content.trim();
            const cleanedAnswer = aiContent
                .split('\n')[0]
                .trim()
                .replace(/['"""'.]/g, '')
                .replace(/^\d+\.\s*/, '');
            
            logger.info(`[AI] AI返回答案: ${cleanedAnswer}`);
            
            res.json({
                success: true,
                answer: cleanedAnswer,
                questionType: questionType || '未知类型',
                source: 'ai'
            });
            
        } else {
            throw new Error('DeepSeek API 返回未知格式的响应');
        }
        
    } catch (error) {
        logger.error('[后端] 处理AI请求时发生错误:', error.message);
        
        let errorMessage = error.message;
        
        if (error.response && error.response.data && error.response.data.error) {
            const apiError = error.response.data.error;
            errorMessage = `API Error: ${apiError.message}`;
            
            if (apiError.code === 'invalid_api_key') {
                errorMessage += " (API Key 无效，请检查)";
            } else if (apiError.code === 'insufficient_quota') {
                errorMessage += " (额度不足，请充值)";
            } else if (apiError.code === 'model_not_found') {
                errorMessage += " (模型不存在或不可用)";
            }
        }
        
        res.status(500).json({
            error: true,
            message: errorMessage
        });
    }
});

// 批量获取AI答案的API端点
app.post('/api/get-batch-answers', requireAIAccess, async (req, res) => {
    try {
        const { questions } = req.body;
        
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ 
                error: true, 
                message: '题目列表不能为空' 
            });
        }
        
        logger.info(`[后端] 批量处理 ${questions.length} 道题目`);
        
        const answerPromises = questions.map(async (q, index) => {
            try {
                // 第一步：先在本地题库缓存中搜索匹配的题目（无论权限验证是否通过）
                const cachedResult = searchInTikuCache(q.question, q.options);
                if (cachedResult) {
                    logger.info(`[题库检索] 题目 ${index + 1} 使用题库答案: ${cachedResult.answer}`);
                    return {
                        questionHash: q.questionHash,
                        success: true,
                        answer: cachedResult.answer,
                        questionType: cachedResult.questionType || q.questionType || '未知类型',
                        source: 'local_cache',
                        similarity: cachedResult.similarity
                    };
                }
                
                // 第二步：如果本地题库没有找到答案，检查AI调用权限
                if (!req.aiAccessEnabled) {
                    logger.info(`[权限验证] 题目 ${index + 1} AI调用权限未通过，无法调用DeepSeek`);
                    return {
                        questionHash: q.questionHash,
                        error: true,
                        message: 'AI调用权限验证失败，且本地题库中未找到匹配答案',
                        fallbackToLocal: true
                    };
                }
                
                // 第三步：权限验证通过，检查API Key配置
                if (!DEEPSEEK_API_KEY) {
                    return {
                        questionHash: q.questionHash,
                        error: true,
                        message: 'DeepSeek API Key未配置，且本地题库中未找到匹配答案'
                    };
                }

                // 第四步：直接调用AI解答（不通过API端点，避免权限验证绕过）
                const aiAnswer = await getAIAnswer(q.question, q.options, q.questionType);
                return {
                    questionHash: q.questionHash,
                    success: true,
                    answer: aiAnswer,
                    questionType: q.questionType,
                    source: 'ai'
                };
            } catch (error) {
                return {
                    questionHash: q.questionHash,
                    error: true,
                    message: error.message
                };
            }
        });
        
        const results = await Promise.all(answerPromises);
        
        // 统计缓存使用情况
        const cachedCount = results.filter(r => r.source === 'local_cache').length;
        const aiCount = results.filter(r => r.source === 'ai').length;
        const errorCount = results.filter(r => r.error).length;
        
        logger.info(`[答题] 批量处理完成: 题库答案 ${cachedCount} 道, AI答案 ${aiCount} 道, 错误 ${errorCount} 道`);
        
        res.json({
            success: true,
            answers: results,
            total: questions.length,
            processed: results.filter(r => !r.error).length,
            cached: cachedCount,
            ai: aiCount,
            errors: errorCount
        });
        
    } catch (error) {
        logger.error('[后端] 批量处理题目时发生错误:', error.message);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

// 题库缓存相关API端点
app.get('/api/tiku/cache', (req, res) => {
    try {
        if (!fs.existsSync(TIKU_CACHE_PATH)) {
            return res.status(404).json({
                error: true,
                message: '文件不存在'
            });
        }
        
        const cacheData = JSON.parse(fs.readFileSync(TIKU_CACHE_PATH, 'utf8'));
        res.json({
            success: true,
            ...cacheData
        });
        
    } catch (error) {
        logger.error('[题库API] 发生错误:', error.message);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

app.post('/api/tiku/refresh', (req, res) => {
    try {
        generateTikuCache();
        
        if (fs.existsSync(TIKU_CACHE_PATH)) {
            const cacheData = JSON.parse(fs.readFileSync(TIKU_CACHE_PATH, 'utf8'));
            res.json({
                success: true,
                message: `题库已刷新，包含 ${cacheData.total} 道题目`,
                ...cacheData
            });
        } else {
            res.json({
                success: false,
                message: '题库生成失败'
            });
        }
        
    } catch (error) {
        logger.error('[题库API] 刷新题库时发生错误:', error.message);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

// 启动服务器函数
function startServer() {
    const server = app.listen(PORT, () => {
        logger.info(`[服务] 后端服务已启动，监听端口 ${PORT}`);
        // 启动时生成题库缓存
        generateTikuCache();
    });
    
    // 优雅关闭处理
    process.on('SIGINT', () => {
        logger.info('\n[服务] 收到关闭信号，正在清理...');
        
        // 清理题库缓存
        cleanupTikuCache();
        
        server.close(() => {
            logger.info('[服务] 服务已关闭');
            process.exit(0);
        });
    });

    process.on('SIGTERM', () => {
        logger.info('\n[服务] 收到终止信号，正在清理...');
        
        // 清理题库缓存
        cleanupTikuCache();
        
        server.close(() => {
            logger.info('[服务] 服务已关闭');
            process.exit(0);
        });
    });

    // 未捕获异常处理
    process.on('uncaughtException', (error) => {
        logger.error('[服务器] 未捕获异常:', error.message);
        
        // 清理题库缓存
        cleanupTikuCache();
        
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('[服务器] 未处理的Promise拒绝:', reason);
        
        // 清理题库缓存
        cleanupTikuCache();
        
        process.exit(1);
    });
    
    return server;
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
    startServer();
}

module.exports = {
    app,
    startServer
};