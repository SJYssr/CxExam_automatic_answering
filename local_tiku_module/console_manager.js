// 本地题库控制台管理脚本
const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');

// 导入工具模块
const TikuParser = require('./utils/tiku_parser');
const QuestionMatcher = require('./utils/question_matcher');

class ConsoleManager {
    constructor() {
        this.tikuDir = path.join(__dirname, 'tiku');
        this.dataDir = path.join(__dirname, 'data');
        this.tikuJsonPath = path.join(this.dataDir, 'tiku.json');
        this.tikuTxtPath = path.join(this.dataDir, 'tiku.txt');
        
        this.tikuParser = new TikuParser();
        this.questionMatcher = new QuestionMatcher();
        
        // 确保目录存在
        fs.ensureDirSync(this.tikuDir);
        fs.ensureDirSync(this.dataDir);
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    /**
     * 显示欢迎信息
     */
    showWelcome() {
        console.clear();
        console.log(chalk.cyan('='.repeat(60)));
        console.log(chalk.cyan.bold('本地题库管理系统 v2.0'));
        console.log(chalk.cyan('='.repeat(60)));
        console.log(chalk.gray('功能：题库文件管理、解析、缓存和智能匹配'));
        console.log(chalk.gray('支持格式：.txt, .doc, .docx'));
        console.log(chalk.gray('编码支持：UTF-8, GBK, GB2312'));
        console.log(chalk.cyan('='.repeat(60)));
        console.log();
    }

    /**
     * 显示主菜单
     */
    showMainMenu() {
        console.log(chalk.yellow.bold('主菜单'));
        console.log(chalk.white('1. 扫描题库文件夹'));
        console.log(chalk.white('2. 选择并导入题库文件'));
        console.log(chalk.white('3. 查看当前题库状态'));
        console.log(chalk.white('4. 清空题库缓存'));
        console.log(chalk.white('5. 测试题库匹配'));
        console.log(chalk.white('6. 生成测试用例'));
        console.log(chalk.white('0. 退出'));
        console.log();
    }

    /**
     * 扫描题库文件夹
     */
    async scanTikuFolder() {
        console.log(chalk.blue('扫描题库文件夹...'));
        
        try {
            const files = await fs.readdir(this.tikuDir);
            const supportedFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.txt', '.doc', '.docx'].includes(ext);
            });

            if (supportedFiles.length === 0) {
                console.log(chalk.yellow('警告: 题库文件夹为空，请将题库文件放入 tiku 文件夹'));
                console.log(chalk.gray('支持的文件格式：.txt, .doc, .docx'));
                return [];
            }

            console.log(chalk.green(`找到 ${supportedFiles.length} 个支持的题库文件：`));
            supportedFiles.forEach((file, index) => {
                const filePath = path.join(this.tikuDir, file);
                const stats = fs.statSync(filePath);
                const sizeKB = Math.round(stats.size / 1024);
                console.log(chalk.white(`   ${index + 1}. ${file} (${sizeKB}KB)`));
            });

            return supportedFiles;
        } catch (error) {
            console.log(chalk.red(`扫描失败: ${error.message}`));
            return [];
        }
    }

    /**
     * 选择并导入题库文件
     */
    async selectAndImportFile() {
        const files = await this.scanTikuFolder();
        if (files.length === 0) {
            await this.waitForEnter();
            return;
        }

        console.log();
        const choice = await this.askQuestion('请选择要导入的文件 (输入序号): ');
        const fileIndex = parseInt(choice) - 1;

        if (fileIndex < 0 || fileIndex >= files.length) {
            console.log(chalk.red('无效的选择'));
            await this.waitForEnter();
            return;
        }

        const selectedFile = files[fileIndex];
        const sourcePath = path.join(this.tikuDir, selectedFile);
        
        console.log(chalk.blue(` 开始导入文件: ${selectedFile}`));
        
        try {
            // 复制文件到data目录并重命名为tiku.txt
            await fs.copy(sourcePath, this.tikuTxtPath);
            console.log(chalk.green(`文件已复制并重命名为 tiku.txt`));

            // 解析题库文件
            console.log(chalk.blue('开始解析题库文件...'));
            const parsedData = await this.tikuParser.parseTikuFile(this.tikuTxtPath);
            
            // 保存为JSON缓存
            await fs.writeJson(this.tikuJsonPath, parsedData, { spaces: 2 });
            console.log(chalk.green(`题库解析完成并缓存为 tiku.json`));
            
            // 显示解析结果
            this.showParseResult(parsedData);
            
        } catch (error) {
            console.log(chalk.red(`导入失败: ${error.message}`));
        }

        await this.waitForEnter();
    }

    /**
     * 显示解析结果
     */
    showParseResult(data) {
        console.log();
        console.log(chalk.cyan('解析结果统计'));
        console.log(chalk.white(`   题库名称: ${data.meta.name}`));
        console.log(chalk.white(`   题目总数: ${data.meta.totalQuestions}`));
        console.log(chalk.white(`   文件哈希: ${data.meta.fileHash.substring(0, 8)}...`));
        console.log(chalk.white(`   创建时间: ${data.meta.createdAt.toLocaleString()}`));
        console.log();
        
        console.log(chalk.yellow('题目类型分布:'));
        Object.entries(data.meta.questionTypeCount).forEach(([type, count]) => {
            if (count > 0) {
                console.log(chalk.white(`   ${type}: ${count} 道`));
            }
        });
    }

    /**
     * 查看当前题库状态
     */
    async showTikuStatus() {
        console.log(chalk.blue('查看题库状态...'));
        
        try {
            if (await fs.pathExists(this.tikuJsonPath)) {
                const data = await fs.readJson(this.tikuJsonPath);
                this.showParseResult(data);
            } else {
                console.log(chalk.yellow('警告: 未找到题库缓存文件'));
            }
        } catch (error) {
            console.log(chalk.red(`读取题库状态失败: ${error.message}`));
        }

        await this.waitForEnter();
    }

    /**
     * 清空题库缓存
     */
    async clearTikuCache() {
        console.log(chalk.blue('清空题库缓存...'));
        
        try {
            await fs.remove(this.tikuJsonPath);
            await fs.remove(this.tikuTxtPath);
            console.log(chalk.green('题库缓存已清空'));
        } catch (error) {
            console.log(chalk.red(`清空失败: ${error.message}`));
        }

        await this.waitForEnter();
    }

    /**
     * 测试题库匹配
     */
    async testTikuMatching() {
        console.log(chalk.blue('测试题库匹配功能...'));
        
        try {
            if (!await fs.pathExists(this.tikuJsonPath)) {
                console.log(chalk.yellow('警告: 请先导入题库文件'));
                await this.waitForEnter();
                return;
            }

            const tikuData = await fs.readJson(this.tikuJsonPath);
            
            // 测试题目
            const testQuestions = [
                '以下哪个是编程语言？',
                'JavaScript的特点是什么？',
                'HTML的全称是什么？'
            ];

            console.log(chalk.yellow('测试题目匹配:'));
            for (const question of testQuestions) {
                console.log(chalk.white(`\n题目: ${question}`));
                const result = this.questionMatcher.searchQuestion(question, tikuData);
                
                if (result.success) {
                    console.log(chalk.green(`匹配成功: ${result.answer}`));
                    console.log(chalk.gray(`   类型: ${result.questionType}`));
                } else {
                    console.log(chalk.red(`未找到匹配: ${result.message}`));
                }
            }
            
        } catch (error) {
            console.log(chalk.red(`测试失败: ${error.message}`));
        }

        await this.waitForEnter();
    }

    /**
     * 生成测试用例
     */
    async generateTestCases() {
        console.log(chalk.blue('生成测试用例...'));
        
        try {
            if (!await fs.pathExists(this.tikuJsonPath)) {
                console.log(chalk.yellow('警告: 请先导入题库文件'));
                await this.waitForEnter();
                return;
            }

            const tikuData = await fs.readJson(this.tikuJsonPath);
            
            // 生成测试用例数据 - 基于当前题库内容
            const testCases = {
                singleChoice: {
                    question: '[单选题] 微信小程序的主要开发语言是什么？',
                    options: ['A. Java', 'B. JavaScript', 'C. Python', 'D. C++'],
                    questionType: '单选题'
                },
                multipleChoice: {
                    question: '[多选题] 微信小程序支持哪些功能？',
                    options: ['A. 用户登录', 'B. 支付功能', 'C. 地理位置', 'D. 拍照功能'],
                    questionType: '多选题'
                },
                trueFalse: {
                    question: '[判断题] 微信小程序只能在微信中使用。',
                    options: ['A. 对', 'B. 错'],
                    questionType: '判断题'
                },
                fillBlank: {
                    question: '[填空题] 微信小程序的入口文件是______。',
                    options: [],
                    questionType: '填空题'
                },
                shortAnswer: {
                    question: '[简答题] 请简述微信小程序的生命周期。',
                    options: [],
                    questionType: '简答题'
                }
            };

            // 生成tiku_test.txt
            const testTxtContent = this.generateTestTxtContent(testCases);
            const testTxtPath = path.join(__dirname, 'tiku_test.txt');
            await fs.writeFile(testTxtPath, testTxtContent, 'utf8');
            
            // 生成tiku_test.js
            const testJsContent = this.generateTestJsContent(testCases);
            const testJsPath = path.join(__dirname, 'tiku_test.js');
            await fs.writeFile(testJsPath, testJsContent, 'utf8');
            
            console.log(chalk.green('测试用例生成完成'));
            console.log(chalk.white(`   tiku_test.txt - 测试题库文件`));
            console.log(chalk.white(`   tiku_test.js - 测试脚本文件`));
            
        } catch (error) {
            console.log(chalk.red(`生成失败: ${error.message}`));
        }

        await this.waitForEnter();
    }

    /**
     * 生成测试txt内容
     */
    generateTestTxtContent(testCases) {
        let content = '';
        let questionNum = 1;

        Object.values(testCases).forEach(testCase => {
            content += `${questionNum}. ${testCase.question}\n`;
            
            testCase.options.forEach(option => {
                content += `${option}\n`;
            });
            
            // 根据题目类型生成答案
            let answer = '';
            switch (testCase.questionType) {
                case '单选题':
                    answer = 'A';
                    break;
                case '多选题':
                    answer = 'ABC';
                    break;
                case '判断题':
                    answer = 'B';
                    break;
                case '填空题':
                    answer = 'HyperText Markup Language';
                    break;
                case '简答题':
                    answer = 'JavaScript是一种解释型、动态类型、基于原型的编程语言，具有跨平台、轻量级、灵活等特点';
                    break;
            }
            
            content += `答案：${answer}\n\n`;
            questionNum++;
        });

        return content;
    }

    /**
     * 生成测试js内容
     */
    generateTestJsContent(testCases) {
        return `// 本地题库测试脚本
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001';

// 测试用例数据
const testCases = ${JSON.stringify(testCases, null, 4)};

async function testSingleQuestion(questionData, testName) {
    try {
        console.log(\`测试\${testName}...\`);
        const response = await axios.post(\`\${API_BASE_URL}/api/get-answer\`, questionData);
        
        // 检查业务逻辑结果
        if (response.data.success) {
            console.log(\`\${testName}测试通过\`);
            console.log(\`题目: \${questionData.question.substring(0, 40)}...\`);
            console.log(\`AI答案: \${response.data.answer}\`);
            console.log(\`题目类型: \${response.data.questionType}\`);
            return { success: true, data: response.data };
        } else {
            console.log(\`\${testName}测试失败: \${response.data.message}\`);
            console.log(\`题目: \${questionData.question.substring(0, 40)}...\`);
            console.log(\`匹配分数: \${response.data.matchScore || 0}\`);
            return { success: false, error: response.data.message };
        }
    } catch (error) {
        console.log(\`\${testName}测试失败: \${error.message}\`);
        return { success: false, error: error.message };
    }
}

async function testAllQuestionTypes() {
    console.log('开始测试所有题目类型...\\n');
    
    const results = {};
    
    // 测试单选题
    results.singleChoice = await testSingleQuestion(testCases.singleChoice, '单选题');
    
    // 测试多选题
    results.multipleChoice = await testSingleQuestion(testCases.multipleChoice, '多选题');
    
    // 测试判断题
    results.trueFalse = await testSingleQuestion(testCases.trueFalse, '判断题');
    
    // 测试填空题
    results.fillBlank = await testSingleQuestion(testCases.fillBlank, '填空题');
    
    // 测试简答题
    results.shortAnswer = await testSingleQuestion(testCases.shortAnswer, '简答题');
    
    // 统计结果
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = Object.keys(results).length;
    
    console.log(\`测试结果统计:\`);
    console.log(\`   总测试数: \${totalCount}\`);
    console.log(\`   成功数: \${successCount}\`);
    console.log(\`   失败数: \${totalCount - successCount}\`);
    
    return results;
}

async function testBatchQuestions() {
    console.log('开始测试批量题目API...');
    
    const batchQuestions = {
        questions: [
            {
                questionHash: 'batch-q1',
                ...testCases.singleChoice
            },
            {
                questionHash: 'batch-q2',
                ...testCases.multipleChoice
            },
            {
                questionHash: 'batch-q3',
                ...testCases.trueFalse
            },
            {
                questionHash: 'batch-q4',
                ...testCases.fillBlank
            },
            {
                questionHash: 'batch-q5',
                ...testCases.shortAnswer
            }
        ]
    };
    
    try {
        const response = await axios.post(\`\${API_BASE_URL}/api/get-batch-answers\`, batchQuestions);
        console.log('批量题目API测试完成');
        console.log(\`处理题目数量: \${response.data.total}\`);
        console.log(\`成功处理: \${response.data.processed}\`);
        
        // 显示每个题目的结果
        console.log('批量处理详情:');
        response.data.answers.forEach((answer, index) => {
            const question = batchQuestions.questions[index];
            if (answer.success) {
                console.log(\`\${index + 1}. \${question.questionType}: [成功] \${answer.answer}\`);
            } else {
                console.log(\`\${index + 1}. \${question.questionType}: [失败] \${answer.message || answer.error}\`);
            }
        });
        
        return { success: true, data: response.data };
    } catch (error) {
        console.log(\`批量题目API测试失败: \${error.message}\`);
        return { success: false, error: error.message };
    }
}

async function testAPI() {
    console.log('开始全面测试本地题库API...\\n');
    
    try {
        // 测试所有题目类型
        console.log('测试所有题目类型...');
        const singleResults = await testAllQuestionTypes();
        
        // 测试批量题目API
        console.log('测试批量题目API...');
        const batchResults = await testBatchQuestions();
        
        // 最终统计
        console.log('测试完成！');
        console.log('测试总结:');
        console.log('单个题目测试:完成');
        console.log('批量题目测试:完成');
        
        const totalSingleTests = Object.keys(singleResults).length;
        const passedSingleTests = Object.values(singleResults).filter(r => r.success).length;
        
        console.log(\`详细统计:\`);
        console.log(\`单个题目测试: \${passedSingleTests}/\${totalSingleTests} 通过\`);
        console.log(\`批量题目测试: \${batchResults.success ? '[通过]' : '[失败]'}\`);
        
        if (passedSingleTests === totalSingleTests && batchResults.success) {
            console.log('所有测试通过！本地题库服务运行正常。');
        } else {
            console.log('部分测试失败，请检查本地题库服务配置。');
        }
        
    } catch (error) {
        console.error('API测试失败:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('提示: 请先启动本地题库服务: npm start');
        } else if (error.response) {
            console.log('错误详情:', error.response.data);
        }
    }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
    testAPI();
}

module.exports = testAPI;
`;
    }

    /**
     * 询问问题
     */
    askQuestion(question) {
        return new Promise((resolve) => {
            this.rl.question(question, resolve);
        });
    }

    /**
     * 等待回车
     */
    waitForEnter() {
        return new Promise((resolve) => {
            this.rl.question(chalk.gray('按回车键继续...'), () => {
                resolve();
            });
        });
    }

    /**
     * 运行主程序
     */
    async run() {
        this.showWelcome();
        
        while (true) {
            this.showMainMenu();
            const choice = await this.askQuestion('请选择操作 (0-6): ');
            
            switch (choice) {
                case '1':
                    await this.scanTikuFolder();
                    await this.waitForEnter();
                    break;
                case '2':
                    await this.selectAndImportFile();
                    break;
                case '3':
                    await this.showTikuStatus();
                    break;
                case '4':
                    await this.clearTikuCache();
                    break;
                case '5':
                    await this.testTikuMatching();
                    break;
                case '6':
                    await this.generateTestCases();
                    break;
                case '0':
                    console.log(chalk.green('感谢使用本地题库管理系统！'));
                    this.rl.close();
                    process.exit(0);
                default:
                    console.log(chalk.red('无效的选择，请重新输入'));
                    await this.waitForEnter();
            }
        }
    }
}

// 如果直接运行此文件，则启动控制台管理
if (require.main === module) {
    const manager = new ConsoleManager();
    manager.run().catch(console.error);
}

module.exports = ConsoleManager;
