// 题库文件解析工具
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const iconv = require('iconv-lite');
const { QuestionSchema, TikuMetaSchema } = require('./schemas');

class TikuParser {
    constructor() {
        this.supportedEncodings = ['utf8', 'gbk', 'gb2312', 'utf16le'];
        this.questionPatterns = {
            // 单选题模式
            single: /^\d+[\.、]\s*(.*?)(?=\n|$)/,
            // 多选题模式  
            multiple: /^\d+[\.、]\s*(.*?)(?=\n|$)/,
            // 判断题模式
            judge: /^\d+[\.、]\s*(.*?)(?=\n|$)/,
            // 填空题模式
            fill: /^\d+[\.、]\s*(.*?)(?=\n|$)/,
            // 简答题模式
            essay: /^\d+[\.、]\s*(.*?)(?=\n|$)/
        };
    }

    /**
     * 检测文件编码
     */
    async detectEncoding(filePath) {
        try {
            const buffer = await fs.readFile(filePath);
            
            // 检测BOM
            if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
                return 'utf8';
            }
            if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
                return 'utf16le';
            }
            if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
                return 'utf16be';
            }

            // 尝试不同编码解析
            for (const encoding of this.supportedEncodings) {
                try {
                    const text = iconv.decode(buffer, encoding);
                    // 检查是否包含中文字符
                    if (/[\u4e00-\u9fa5]/.test(text)) {
                        return encoding;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            return 'utf8'; // 默认UTF-8
        } catch (error) {
            console.error('检测文件编码失败:', error);
            return 'utf8';
        }
    }

    /**
     * 检测题库文件中是否包含解析内容
     */
    checkForExplanation(content) {
        const explanationPatterns = [
            /解析[:：]/g,
            /详解[:：]/g,
            /分析[:：]/g,
            /说明[:：]/g,
            /解释[:：]/g,
            /解答[:：]/g,
            /评析[:：]/g,
            /点评[:：]/g
        ];
        
        const foundPatterns = [];
        
        explanationPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                foundPatterns.push(pattern.source);
            }
        });
        
        return foundPatterns;
    }

    /**
     * 解析题库文件
     */
    async parseTikuFile(filePath) {
        try {
            console.log(`[题库解析] 开始解析文件: ${filePath}`);
            
            // 检测编码
            const encoding = await this.detectEncoding(filePath);
            console.log(`[题库解析] 检测到编码: ${encoding}`);
            
            // 读取文件内容
            const buffer = await fs.readFile(filePath);
            const content = iconv.decode(buffer, encoding);
            
            // 检测是否包含解析内容
            const explanationPatterns = this.checkForExplanation(content);
            if (explanationPatterns.length > 0) {
                const errorMessage = `题库文件包含解析内容，请删除以下内容后重新上传：\n${explanationPatterns.join('\n')}\n\n请删除所有包含"解析"、"详解"、"分析"、"说明"等字样的行，只保留题目、选项和答案。`;
                throw new Error(errorMessage);
            }
            
            // 计算文件哈希
            const fileHash = crypto.createHash('md5').update(buffer).digest('hex');
            
            // 解析题目
            const questions = this.parseQuestions(content);
            
            // 生成题库元数据
            const meta = this.generateMeta(questions, fileHash);
            
            console.log(`[题库解析] 解析完成: ${questions.length} 道题目`);
            
            return {
                meta,
                questions,
                fileHash
            };
            
        } catch (error) {
            console.error('[题库解析] 解析失败:', error);
            throw error;
        }
    }

    /**
     * 解析题目内容
     */
    parseQuestions(content) {
        const questions = [];
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        
        let currentQuestion = null;
        let questionIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 检测题目开始
            if (this.isQuestionStart(line)) {
                // 保存上一个题目
                if (currentQuestion) {
                    questions.push(this.finalizeQuestion(currentQuestion, questionIndex++));
                }
                
                // 开始新题目
                currentQuestion = this.parseQuestionHeader(line);
            } else if (currentQuestion) {
                // 解析选项或答案
                this.parseQuestionContent(line, currentQuestion);
            }
        }
        
        // 保存最后一个题目
        if (currentQuestion) {
            questions.push(this.finalizeQuestion(currentQuestion, questionIndex++));
        }
        
        return questions;
    }

    /**
     * 检测是否为题目开始
     */
    isQuestionStart(line) {
        // 匹配数字开头的行
        return /^\d+[\.、]\s*/.test(line);
    }

    /**
     * 解析题目头部
     */
    parseQuestionHeader(line) {
        const match = line.match(/^(\d+)[\.、]\s*(.*)/);
        if (!match) return null;
        
        const questionNumber = parseInt(match[1]);
        const questionText = match[2].trim();
        
        // 检测题目类型
        const questionType = this.detectQuestionType(questionText);
        
        return {
            questionNumber,
            questionText,
            questionFull: line,
            questionType,
            options: [],
            answer: ''
        };
    }

    /**
     * 检测题目类型
     */
    detectQuestionType(questionText) {
        if (questionText.includes('单选题') || questionText.includes('单项选择')) {
            return '单选题';
        } else if (questionText.includes('多选题') || questionText.includes('多项选择')) {
            return '多选题';
        } else if (questionText.includes('判断题') || questionText.includes('判断')) {
            return '判断题';
        } else if (questionText.includes('填空题') || questionText.includes('填空')) {
            return '填空题';
        } else if (questionText.includes('简答题') || questionText.includes('论述题')) {
            return '简答题';
        }
        
        // 根据选项数量推断
        return '单选题'; // 默认单选题
    }

    /**
     * 解析题目内容（选项、答案等）
     */
    parseQuestionContent(line, question) {
        // 检测选项
        if (/^[A-Z][\.、]\s*/.test(line)) {
            const optionText = line.replace(/^[A-Z][\.、]\s*/, '').trim();
            question.options.push(optionText);
        }
        // 检测答案
        else if (/^(答案|正确答案|参考答案)[:：]\s*/.test(line)) {
            const answerText = line.replace(/^(答案|正确答案|参考答案)[:：]\s*/, '').trim();
            question.answer = answerText;
        }
        // 其他内容作为题目补充
        else if (line && !question.answer) {
            question.questionText += ' ' + line;
        }
    }

    /**
     * 完成题目解析（严格按照ai_test数据结构）
     */
    finalizeQuestion(question, index) {
        return {
            questionId: `q_${index + 1}`,
            questionText: question.questionText.trim(),
            questionFull: question.questionFull,
            questionType: question.questionType,
            options: question.options,
            answer: question.answer
        };
    }

    /**
     * 生成题库元数据
     */
    generateMeta(questions, fileHash) {
        const questionTypeCount = {
            '单选题': 0,
            '多选题': 0,
            '判断题': 0,
            '填空题': 0,
            '简答题': 0
        };
        
        questions.forEach(q => {
            if (questionTypeCount[q.questionType] !== undefined) {
                questionTypeCount[q.questionType]++;
            }
        });
        
        return {
            name: '本地题库',
            description: '用户导入的本地题库',
            version: '1.0.0',
            totalQuestions: questions.length,
            questionTypeCount,
            createdAt: new Date(),
            lastUpdated: new Date(),
            fileHash
        };
    }
}

module.exports = TikuParser;
