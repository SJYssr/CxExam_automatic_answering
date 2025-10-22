// 本地题库测试脚本 - 优化版本
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3002';

// 测试用例数据
const TEST_CASES = {
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

/**
 * 测试单个题目
 */
async function testSingleQuestion(questionData, testName) {
    try {
        console.log(`测试${testName}...`);
        const response = await axios.post(`${API_BASE_URL}/api/get-answer`, questionData);
        
        if (response.data.success) {
            console.log(`${testName}测试通过`);
            console.log(`题目: ${questionData.question.substring(0, 40)}...`);
            console.log(`AI答案: ${response.data.answer}`);
            console.log(`题目类型: ${response.data.questionType}`);
            return { success: true, data: response.data };
        } else {
            console.log(`${testName}测试失败: ${response.data.message}`);
            console.log(`题目: ${questionData.question.substring(0, 40)}...`);
            console.log(`匹配分数: ${response.data.matchScore || 0}`);
            return { success: false, error: response.data.message };
        }
    } catch (error) {
        console.log(`${testName}测试失败: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * 测试所有题目类型
 */
async function testAllQuestionTypes() {
    console.log('开始测试所有题目类型...\n');
    
    const results = {};
    const testNames = Object.keys(TEST_CASES);
    
    for (const testName of testNames) {
        results[testName] = await testSingleQuestion(TEST_CASES[testName], testName);
    }
    
    // 统计结果
    const successCount = Object.values(results).filter(r => r.success).length;
    const totalCount = testNames.length;
    
    console.log(`测试结果统计:`);
    console.log(`   总测试数: ${totalCount}`);
    console.log(`   成功数: ${successCount}`);
    console.log(`   失败数: ${totalCount - successCount}`);
    
    return results;
}

/**
 * 测试批量题目API
 */
async function testBatchQuestions() {
    console.log('开始测试批量题目API...');
    
    const batchQuestions = {
        questions: Object.entries(TEST_CASES).map(([key, testCase], index) => ({
            questionHash: `batch-q${index + 1}`,
            ...testCase
        }))
    };
    
    try {
        const response = await axios.post(`${API_BASE_URL}/api/get-batch-answers`, batchQuestions);
        console.log('批量题目API测试完成');
        console.log(`处理题目数量: ${response.data.total}`);
        console.log(`成功处理: ${response.data.processed}`);
        
        // 显示每个题目的结果
        console.log('批量处理详情:');
        response.data.answers.forEach((answer, index) => {
            const question = batchQuestions.questions[index];
            if (answer.success) {
                console.log(`${index + 1}. ${question.questionType}: [成功] ${answer.answer}`);
            } else {
                console.log(`${index + 1}. ${question.questionType}: [失败] ${answer.message || answer.error}`);
            }
        });
        
        return { success: true, data: response.data };
    } catch (error) {
        console.log(`批量题目API测试失败: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * 主测试函数
 */
async function testAPI() {
    console.log('开始全面测试本地题库API...\n');
    
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
        
        console.log(`详细统计:`);
        console.log(`单个题目测试: ${passedSingleTests}/${totalSingleTests} 通过`);
        console.log(`批量题目测试: ${batchResults.success ? '[通过]' : '[失败]'}`);
        
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
