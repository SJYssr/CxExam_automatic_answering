// 题目匹配工具 - 优化版本
const stringSimilarity = require('string-similarity');

class QuestionMatcher {
    constructor(options = {}) {
        this.minSimilarity = options.minSimilarity || 0.3;
        this.maxResults = options.maxResults || 5;
        this.questionTypes = ['单选题', '多选题', '判断题', '填空题', '简答题'];
    }

    /**
     * 搜索匹配的题目
     */
    searchQuestion(questionText, tikuData) {
        // 输入验证
        if (!this.validateInput(questionText, tikuData)) {
            return this.createErrorResult('输入参数无效');
        }

        try {
            console.log(`[题目匹配] 搜索题目: ${questionText.substring(0, 50)}...`);
            
            const cleanText = this.cleanQuestionText(questionText);
            const matches = this.calculateSimilarity(cleanText, tikuData.questions);
            const bestMatch = matches.find(match => match.similarity >= this.minSimilarity);
            
            if (!bestMatch) {
                console.log('[题目匹配] 未找到匹配的题目');
                return this.createErrorResult('未找到匹配的题目', 0);
            }

            console.log(`[题目匹配] 找到匹配题目，相似度: ${bestMatch.similarity.toFixed(3)}`);
            return this.createSuccessResult(bestMatch.question);
            
        } catch (error) {
            console.error('[题目匹配] 搜索失败:', error);
            return this.createErrorResult('题目匹配失败: ' + error.message);
        }
    }

    /**
     * 批量搜索题目
     */
    batchSearchQuestions(questions, tikuData) {
        if (!Array.isArray(questions) || questions.length === 0) {
            return [];
        }

        console.log(`[题目匹配] 批量搜索 ${questions.length} 道题目`);
        
        const results = questions.map(q => ({
            questionHash: q.questionHash,
            ...this.searchQuestion(q.question, tikuData)
        }));
        
        const successCount = results.filter(r => r.success).length;
        console.log(`[题目匹配] 批量搜索完成: ${successCount}/${questions.length} 成功`);
        
        return results;
    }

    /**
     * 清理题目文本
     */
    cleanQuestionText(text) {
        if (typeof text !== 'string') return '';
        
        return text
            .replace(/^\d+[\.、]\s*/, '') // 移除题号
            .replace(new RegExp(`^\\[(${this.questionTypes.join('|')})\\]\\s*`), '') // 移除题型标识
            .replace(new RegExp(`^(${this.questionTypes.join('|')})[:：]\\s*`), '') // 移除题型标识
            .replace(/\s+/g, ' ') // 合并多个空格
            .trim();
    }

    /**
     * 计算相似度
     */
    calculateSimilarity(targetText, questions) {
        if (!Array.isArray(questions)) return [];
        
        return questions
            .map(question => ({
                question,
                similarity: stringSimilarity.compareTwoStrings(
                    targetText, 
                    this.cleanQuestionText(question.questionText)
                )
            }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, this.maxResults);
    }

    /**
     * 设置匹配参数
     */
    setMatchParams(minSimilarity = 0.3, maxResults = 5) {
        this.minSimilarity = Math.max(0, Math.min(1, minSimilarity));
        this.maxResults = Math.max(1, Math.min(50, maxResults));
        console.log(`[题目匹配] 更新匹配参数: 最小相似度=${this.minSimilarity}, 最大结果数=${this.maxResults}`);
    }

    /**
     * 输入验证
     */
    validateInput(questionText, tikuData) {
        return typeof questionText === 'string' && 
               questionText.trim().length > 0 &&
               tikuData && 
               Array.isArray(tikuData.questions) && 
               tikuData.questions.length > 0;
    }

    /**
     * 创建成功结果
     */
    createSuccessResult(question) {
        return {
            success: true,
            answer: question.answer,
            questionType: question.questionType
        };
    }

    /**
     * 创建错误结果
     */
    createErrorResult(message, matchScore = null) {
        const result = {
            success: false,
            message
        };
        if (matchScore !== null) {
            result.matchScore = matchScore;
        }
        return result;
    }
}

module.exports = QuestionMatcher;
