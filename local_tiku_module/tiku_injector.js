// 题库注入器脚本 - 将txt转换为js并注入到DLL
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class TikuInjector {
    constructor() {
        this.tikuDir = path.join(__dirname, 'tiku');
        this.srcDir = path.join(__dirname, '../src');
        this.scriptsDir = path.join(this.srcDir, 'scripts');
        
        // 确保目录存在
        fs.ensureDirSync(this.tikuDir);
        fs.ensureDirSync(this.scriptsDir);
    }

    /**
     * 扫描tiku文件夹中的txt文件
     */
    async scanTikuFiles() {
        try {
            const files = await fs.readdir(this.tikuDir);
            const txtFiles = files.filter(file => path.extname(file).toLowerCase() === '.txt');
            
            console.log(chalk.blue(`扫描到 ${txtFiles.length} 个txt文件:`));
            txtFiles.forEach((file, index) => {
                const filePath = path.join(this.tikuDir, file);
                const stats = fs.statSync(filePath);
                const sizeKB = Math.round(stats.size / 1024);
                console.log(chalk.white(`   ${index + 1}. ${file} (${sizeKB}KB)`));
            });
            
            return txtFiles;
        } catch (error) {
            console.log(chalk.red(`扫描失败: ${error.message}`));
            return [];
        }
    }

    /**
     * 将txt文件转换为js注入脚本
     */
    async convertTxtToJs(txtFileName) {
        try {
            const txtPath = path.join(this.tikuDir, txtFileName);
            const content = await fs.readFile(txtPath, 'utf8');
            
            // 解析txt内容为题目数据
            const questions = this.parseTxtContent(content);
            
            // 生成js注入脚本
            const jsContent = this.generateInjectScript(questions, txtFileName);
            
            // 保存js文件
            const jsFileName = txtFileName.replace('.txt', '.js');
            const jsPath = path.join(this.scriptsDir, jsFileName);
            await fs.writeFile(jsPath, jsContent, 'utf8');
            
            console.log(chalk.green(`转换完成: ${txtFileName} -> ${jsFileName}`));
            console.log(chalk.white(`   题目数量: ${questions.length}`));
            console.log(chalk.white(`   保存路径: ${jsPath}`));
            
            return { success: true, jsPath, questionCount: questions.length };
            
        } catch (error) {
            console.log(chalk.red(`转换失败: ${error.message}`));
            return { success: false, error: error.message };
        }
    }

    /**
     * 解析txt内容为题目数据
     */
    parseTxtContent(content) {
        const questions = [];
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        
        let currentQuestion = null;
        let questionIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 检测题目开始
            if (/^\d+[\.、]\s*/.test(line)) {
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
     * 完成题目解析
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
     * 生成注入脚本
     */
    generateInjectScript(questions, originalFileName) {
        const timestamp = new Date().toISOString();
        const questionCount = questions.length;
        
        return `// 题库注入脚本 - 自动生成
// 源文件: ${originalFileName}
// 生成时间: ${timestamp}
// 题目数量: ${questionCount}

(function() {
    'use strict';

    console.log('[题库注入器] 开始加载题库数据...');
    console.log('[题库注入器] 源文件: ${originalFileName}');
    console.log('[题库注入器] 题目数量: ${questionCount}');

    // 题库数据
    const tikuData = ${JSON.stringify(questions, null, 4)};

    // 题目匹配器
    function findMatchingQuestion(targetQuestion) {
        const cleanTarget = targetQuestion
            .replace(/^\\d+[\\.、]\\s*/, '')
            .replace(/^(单选题|多选题|判断题|填空题|简答题)[:：]\\s*/, '')
            .replace(/\\s+/g, ' ')
            .trim();

        let bestMatch = null;
        let bestScore = 0;

        tikuData.forEach(question => {
            const cleanTiku = question.questionText
                .replace(/^\\d+[\\.、]\\s*/, '')
                .replace(/^(单选题|多选题|判断题|填空题|简答题)[:：]\\s*/, '')
                .replace(/\\s+/g, ' ')
                .trim();

            // 简单的相似度计算
            const similarity = calculateSimilarity(cleanTarget, cleanTiku);
            
            if (similarity > bestScore && similarity > 0.6) {
                bestScore = similarity;
                bestMatch = question;
            }
        });

        return bestMatch;
    }

    // 计算字符串相似度
    function calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    // 计算编辑距离
    function levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // 获取题目答案
    function getAnswer(questionText) {
        const match = findMatchingQuestion(questionText);
        if (match) {
            console.log('[题库注入器] 找到匹配题目:', match.questionText.substring(0, 50) + '...');
            return {
                success: true,
                answer: match.answer,
                questionType: match.questionType,
                matchScore: calculateSimilarity(
                    questionText.replace(/^\\d+[\\.、]\\s*/, '').replace(/^(单选题|多选题|判断题|填空题|简答题)[:：]\\s*/, '').trim(),
                    match.questionText.replace(/^\\d+[\\.、]\\s*/, '').replace(/^(单选题|多选题|判断题|填空题|简答题)[:：]\\s*/, '').trim()
                )
            };
        } else {
            console.log('[题库注入器] 未找到匹配题目:', questionText.substring(0, 50) + '...');
            return {
                success: false,
                message: '未找到匹配的题目'
            };
        }
    }

    // 批量获取答案
    function getBatchAnswers(questions) {
        console.log('[题库注入器] 批量处理', questions.length, '道题目');
        
        const results = questions.map(q => {
            const result = getAnswer(q.question);
            return {
                questionHash: q.questionHash,
                ...result
            };
        });
        
        const successCount = results.filter(r => r.success).length;
        console.log('[题库注入器] 批量处理完成:', successCount + '/' + questions.length, '成功');
        
        return {
            success: true,
            answers: results,
            total: questions.length,
            processed: successCount
        };
    }

    // 将函数暴露到全局
    window.tikuInjector = {
        getAnswer: getAnswer,
        getBatchAnswers: getBatchAnswers,
        tikuData: tikuData,
        questionCount: ${questionCount}
    };

    console.log('[题库注入器] 题库数据加载完成，已暴露到 window.tikuInjector');
})();
`;
    }

    /**
     * 运行注入器
     */
    async run() {
        console.log(chalk.cyan('='.repeat(60)));
        console.log(chalk.cyan.bold('题库注入器 v1.0'));
        console.log(chalk.cyan('='.repeat(60)));
        console.log(chalk.gray('功能：将txt题库文件转换为js注入脚本'));
        console.log(chalk.cyan('='.repeat(60)));
        console.log();

        const txtFiles = await this.scanTikuFiles();
        
        if (txtFiles.length === 0) {
            console.log(chalk.yellow('警告: tiku文件夹中没有txt文件'));
            console.log(chalk.gray('请将题库txt文件放入tiku文件夹'));
            return;
        }

        console.log();
        console.log(chalk.yellow.bold('选择要转换的文件:'));
        
        for (let i = 0; i < txtFiles.length; i++) {
            console.log(chalk.white(`${i + 1}. ${txtFiles[i]}`));
        }
        
        console.log(chalk.white('0. 转换所有文件'));
        console.log();

        // 这里简化处理，直接转换所有文件
        console.log(chalk.blue('🔄 开始转换所有txt文件...'));
        
        for (const txtFile of txtFiles) {
            await this.convertTxtToJs(txtFile);
            console.log();
        }

        console.log(chalk.green('所有文件转换完成！'));
        console.log(chalk.white(`生成的js文件保存在: ${this.scriptsDir}`));
        console.log(chalk.gray('提示：可以将生成的js文件注入到DLL中使用'));
    }
}

// 如果直接运行此文件，则启动注入器
if (require.main === module) {
    const injector = new TikuInjector();
    injector.run().catch(console.error);
}

module.exports = TikuInjector;
