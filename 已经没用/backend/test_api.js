// 后端API测试脚本
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

// 测试用例数据
const testCases = {
    // 单选题测试
    singleChoice: {
        question: '[单选题] 以下哪个是编程语言？',
        options: [
            'A. Python',
            'B. HTML', 
            'C. CSS',
            'D. HTTP'
        ],
        questionType: '单选题'
    },
    
    // 多选题测试
    multipleChoice: {
        question: '[多选题] 以下哪些是水果？',
        options: [
            'A. 苹果',
            'B. 香蕉',
            'C. 土豆',
            'D. 西瓜',
            'E. 橘子',
            'F. 胡萝卜'
        ],
        questionType: '多选题'
    },
    
    // 判断题测试
    trueFalse: {
        question: '[判断题] 地球是平的。',
        options: ['A. 对', 'B. 错'],
        questionType: '判断题'
    },
    
    // 填空题测试
    fillBlank: {
        question: '[填空题] 中国的首都是______。',
        options: [],
        questionType: '填空题'
    },
    
    // 简答题测试
    shortAnswer: {
        question: '[简答题] 微信小程序的主要功能是什么？',
        options: [],
        questionType: '简答题'
    }
};

async function testSingleQuestion(questionData, testName) {
    try {
        console.log(`测试${testName}...`);
        const response = await axios.post(`${API_BASE_URL}/api/get-answer`, questionData);
        console.log(`${testName}测试通过`);
        console.log(`题目: ${questionData.question.substring(0, 40)}...`);
        console.log(`AI答案: ${response.data.answer}`);
        console.log(`题目类型: ${response.data.questionType}`);
        return { success: true, data: response.data };
    } catch (error) {
        console.log(`${testName}测试失败: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testAllQuestionTypes() {
    console.log('开始测试所有题目类型...\n');
    
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
    
    console.log(`测试结果统计:`);
    console.log(`   总测试数: ${totalCount}`);
    console.log(`   成功数: ${successCount}`);
    console.log(`   失败数: ${totalCount - successCount}`);
    
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
        const response = await axios.post(`${API_BASE_URL}/api/get-batch-answers`, batchQuestions);
        console.log('批量题目API测试通过');
        console.log(`处理题目数量: ${response.data.total}`);
        console.log(`成功处理: ${response.data.processed}`);
        
        // 显示每个题目的结果
        console.log('批量处理详情:');
        response.data.answers.forEach((answer, index) => {
            const question = batchQuestions.questions[index];
            console.log(`${index + 1}. ${question.questionType}: ${answer.error ? '❌' : '✅'} ${answer.error ? answer.message : answer.answer}`);
        });
        
        return { success: true, data: response.data };
    } catch (error) {
        console.log(`批量题目API测试失败: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function testAPI() {
    console.log('开始全面测试后端API...\n');
    
    try {
        // 测试健康检查
        console.log('测试健康检查端点...');
        const healthResponse = await axios.get(`${API_BASE_URL}/health`);
        console.log('健康检查通过:', healthResponse.data);
        
        // 测试所有题目类型
        console.log('测试所有题目类型...');
        const singleResults = await testAllQuestionTypes();
        
        // 测试批量题目API
        console.log('测试批量题目API...');
        const batchResults = await testBatchQuestions();
        
        // 最终统计
        console.log('测试完成！');
        console.log('测试总结:');
        console.log('健康检查:通过');
        console.log('单个题目测试:完成');
        console.log('批量题目测试:完成');
        
        const totalSingleTests = Object.keys(singleResults).length;
        const passedSingleTests = Object.values(singleResults).filter(r => r.success).length;
        
        console.log(`详细统计:`);
        console.log(`单个题目测试: ${passedSingleTests}/${totalSingleTests} 通过`);
        console.log(`批量题目测试: ${batchResults.success ? '✅ 通过' : '❌ 失败'}`);
        
        if (passedSingleTests === totalSingleTests && batchResults.success) {
            console.log('所有测试通过！后端服务运行正常。');
        } else {
            console.log('部分测试失败，请检查后端服务配置。');
        }
        
    } catch (error) {
        console.error('API测试失败:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('提示: 请先启动后端服务: npm start');
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