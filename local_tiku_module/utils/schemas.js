// 本地题库数据结构定义
// 参考ai_test模块的数据结构，保持API接口一致性

/**
 * 题库题目数据结构（与ai_test完全一致）
 */
const QuestionSchema = {
    // 题目唯一标识
    questionId: String,
    // 题目内容（去除序号和类型标识）
    questionText: String,
    // 题目完整内容（包含序号和类型）
    questionFull: String,
    // 题目类型：单选题, 多选题, 判断题, 填空题, 简答题
    questionType: String,
    // 选项列表（选择题和判断题）
    options: [String],
    // 正确答案
    answer: String
};

/**
 * 题库元数据结构
 */
const TikuMetaSchema = {
    // 题库名称
    name: String,
    // 题库描述
    description: String,
    // 题库版本
    version: String,
    // 题目总数
    totalQuestions: Number,
    // 各类型题目数量
    questionTypeCount: {
        '单选题': Number,
        '多选题': Number,
        '判断题': Number,
        '填空题': Number,
        '简答题': Number
    },
    // 创建时间
    createdAt: Date,
    // 最后更新时间
    lastUpdated: Date,
    // 文件哈希（用于检测更新）
    fileHash: String
};

/**
 * API响应数据结构（与ai_test完全一致）
 */
const ApiResponseSchema = {
    // 成功标识
    success: Boolean,
    // 答案内容
    answer: String,
    // 题目类型
    questionType: String,
    // 题目标识（批量请求时）
    questionHash: String,
    // 错误信息（可选）
    error: Boolean,
    // 错误消息（可选）
    message: String
};

/**
 * 批量答题响应结构
 */
const BatchResponseSchema = {
    // 成功标识
    success: Boolean,
    // 答案列表
    answers: [ApiResponseSchema],
    // 总题目数
    total: Number,
    // 成功处理数
    processed: Number,
    // 错误信息（可选）
    error: Boolean,
    // 错误消息（可选）
    message: String
};

module.exports = {
    QuestionSchema,
    TikuMetaSchema,
    ApiResponseSchema,
    BatchResponseSchema
};
