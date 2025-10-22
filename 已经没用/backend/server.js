const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// DeepSeek API配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_API_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';
const AI_MODEL = 'deepseek-chat';

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'AI答题服务运行正常' });
});

// 获取AI答案的API端点
app.post('/api/get-answer', async (req, res) => {
    try {
        const { question, options, questionType } = req.body;
        
        // 验证必填字段
        if (!question) {
            return res.status(400).json({ 
                error: true, 
                message: '题目内容不能为空' 
            });
        }
        
        if (!DEEPSEEK_API_KEY) {
            return res.status(500).json({ 
                error: true, 
                message: 'DeepSeek API Key未配置' 
            });
        }
        
        console.log(`[后端] 处理题目: ${question.substring(0, 50)}...`);
        
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
            
            console.log(`[后端] AI返回答案: ${cleanedAnswer}`);
            
            res.json({
                success: true,
                answer: cleanedAnswer,
                questionType: questionType || '未知类型'
            });
            
        } else {
            throw new Error('DeepSeek API 返回未知格式的响应');
        }
        
    } catch (error) {
        console.error('[后端] 处理AI请求时发生错误:', error.message);
        
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

// 批量获取答案的API端点
app.post('/api/get-batch-answers', async (req, res) => {
    try {
        const { questions } = req.body;
        
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ 
                error: true, 
                message: '题目列表不能为空' 
            });
        }
        
        if (!DEEPSEEK_API_KEY) {
            return res.status(500).json({ 
                error: true, 
                message: 'DeepSeek API Key未配置' 
            });
        }
        
        console.log(`[后端] 批量处理 ${questions.length} 道题目`);
        
        const answerPromises = questions.map(async (q, index) => {
            try {
                const response = await axios.post(`http://localhost:${PORT}/api/get-answer`, q);
                return {
                    questionHash: q.questionHash,
                    ...response.data
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
        
        res.json({
            success: true,
            answers: results,
            total: questions.length,
            processed: results.filter(r => !r.error).length
        });
        
    } catch (error) {
        console.error('[后端] 批量处理题目时发生错误:', error.message);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`AI答题后端服务运行在 http://localhost:${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    
    if (!DEEPSEEK_API_KEY) {
        console.warn('DeepSeek API Key未配置，请设置环境变量 DEEPSEEK_API_KEY');
    }
});

module.exports = app;