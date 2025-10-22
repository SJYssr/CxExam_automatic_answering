// 本地题库后端服务 - 优化版本
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

// 导入工具模块
const TikuParser = require('../utils/tiku_parser');
const QuestionMatcher = require('../utils/question_matcher');

const app = express();
const PORT = process.env.PORT || 3002;

// 配置
const CONFIG = {
    DATA_DIR: path.join(__dirname, '../data'),
    TIKU_DIR: path.join(__dirname, '../tiku'),
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_EXTENSIONS: ['.txt', '.doc', '.docx']
};

// 全局变量
let tikuData = null;
let tikuParser = new TikuParser();
let questionMatcher = new QuestionMatcher();

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// 文件上传配置
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            fs.ensureDirSync(CONFIG.DATA_DIR);
            cb(null, CONFIG.DATA_DIR);
        },
        filename: (req, file, cb) => {
            cb(null, 'tiku.txt');
        }
    }),
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`只支持 ${CONFIG.ALLOWED_EXTENSIONS.join(', ')} 格式的文件`));
        }
    },
    limits: { fileSize: CONFIG.MAX_FILE_SIZE }
});

// 确保目录存在
fs.ensureDirSync(CONFIG.DATA_DIR);
fs.ensureDirSync(CONFIG.TIKU_DIR);

// 启动时加载题库
loadTikuData();

/**
 * 加载题库数据
 */
async function loadTikuData() {
    try {
        const tikuJsonPath = path.join(CONFIG.DATA_DIR, 'tiku.json');
        if (await fs.pathExists(tikuJsonPath)) {
            const data = await fs.readJson(tikuJsonPath);
            tikuData = data;
            console.log(chalk.green(`[题库服务] 题库加载成功: ${data.meta.totalQuestions} 道题目`));
        } else {
            console.log(chalk.yellow('[题库服务] 未找到题库文件，请先导入题库'));
        }
    } catch (error) {
        console.error(chalk.red('[题库服务] 加载题库失败:'), error);
    }
}

/**
 * 保存题库数据
 */
async function saveTikuData(data) {
    try {
        const tikuJsonPath = path.join(CONFIG.DATA_DIR, 'tiku.json');
        await fs.writeJson(tikuJsonPath, data, { spaces: 2 });
        tikuData = data;
        console.log(chalk.green(`[题库服务] 题库保存成功: ${data.meta.totalQuestions} 道题目`));
        return true;
    } catch (error) {
        console.error(chalk.red('[题库服务] 保存题库失败:'), error);
        return false;
    }
}

/**
 * 验证请求参数
 */
function validateRequest(req, requiredFields = []) {
    for (const field of requiredFields) {
        if (!req.body[field]) {
            return { valid: false, message: `${field} 不能为空` };
        }
    }
    return { valid: true };
}

/**
 * 统一错误处理
 */
function handleError(res, error, message = '操作失败') {
    console.error(chalk.red(`[题库服务] ${message}:`), error);
    res.status(500).json({
        error: true,
        message: `${message}: ${error.message}`
    });
}

/**
 * 检查题库是否加载
 */
function checkTikuLoaded(res) {
    if (!tikuData) {
        res.status(500).json({
            error: true,
            message: '题库未加载，请先导入题库文件'
        });
        return false;
    }
    return true;
}

// ==================== API 端点 ====================

/**
 * 获取题库信息
 */
app.get('/api/tiku-info', (req, res) => {
    if (!checkTikuLoaded(res)) return;
    
    res.json({
        success: true,
        meta: tikuData.meta,
        questionCount: tikuData.questions.length
    });
});

/**
 * 扫描tiku文件夹
 */
app.get('/api/scan-tiku-folder', async (req, res) => {
    try {
        const files = await fs.readdir(CONFIG.TIKU_DIR);
        const supportedFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return CONFIG.ALLOWED_EXTENSIONS.includes(ext);
        });

        const fileDetails = await Promise.all(
            supportedFiles.map(async (file) => {
                const filePath = path.join(CONFIG.TIKU_DIR, file);
                const stats = await fs.stat(filePath);
                return {
                    name: file,
                    size: stats.size,
                    sizeKB: Math.round(stats.size / 1024),
                    lastModified: stats.mtime
                };
            })
        );

        res.json({
            success: true,
            files: fileDetails,
            count: fileDetails.length
        });
    } catch (error) {
        handleError(res, error, '扫描tiku文件夹失败');
    }
});

/**
 * 从tiku文件夹导入指定文件
 */
app.post('/api/import-from-tiku', async (req, res) => {
    try {
        const validation = validateRequest(req, ['fileName']);
        if (!validation.valid) {
            return res.status(400).json({
                error: true,
                message: validation.message
            });
        }

        const { fileName } = req.body;
        const sourcePath = path.join(CONFIG.TIKU_DIR, fileName);
        
        if (!await fs.pathExists(sourcePath)) {
            return res.status(404).json({
                error: true,
                message: '指定的文件不存在'
            });
        }

        console.log(chalk.blue(`[题库服务] 开始从tiku文件夹导入: ${fileName}`));
        
        // 复制文件到data目录并重命名为tiku.txt
        const targetPath = path.join(CONFIG.DATA_DIR, 'tiku.txt');
        await fs.copy(sourcePath, targetPath);
        console.log(chalk.green(`[题库服务] 文件已复制并重命名为 tiku.txt`));

        // 解析题库文件
        console.log(chalk.blue(`[题库服务] 开始解析题库文件...`));
        const parsedData = await tikuParser.parseTikuFile(targetPath);
        
        // 保存为JSON缓存
        const saveSuccess = await saveTikuData(parsedData);
        
        if (saveSuccess) {
            res.json({
                success: true,
                message: '题库导入成功',
                meta: parsedData.meta,
                questionCount: parsedData.questions.length
            });
        } else {
            res.status(500).json({
                error: true,
                message: '题库保存失败'
            });
        }
        
    } catch (error) {
        handleError(res, error, '从tiku文件夹导入失败');
    }
});

/**
 * 导入题库文件
 */
app.post('/api/import-tiku', upload.single('tikuFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: true,
                message: '请选择要导入的题库文件'
            });
        }

        console.log(chalk.blue(`[题库服务] 开始导入题库文件: ${req.file.originalname}`));
        
        // 解析题库文件
        const parsedData = await tikuParser.parseTikuFile(req.file.path);
        
        // 保存解析结果
        const saveSuccess = await saveTikuData(parsedData);
        
        if (saveSuccess) {
            res.json({
                success: true,
                message: '题库导入成功',
                meta: parsedData.meta,
                questionCount: parsedData.questions.length
            });
        } else {
            res.status(500).json({
                error: true,
                message: '题库保存失败'
            });
        }
        
    } catch (error) {
        handleError(res, error, '导入失败');
    }
});

/**
 * 获取单个题目答案
 */
app.post('/api/get-answer', async (req, res) => {
    try {
        const validation = validateRequest(req, ['question']);
        if (!validation.valid) {
            return res.status(400).json({
                error: true,
                message: validation.message
            });
        }

        if (!checkTikuLoaded(res)) return;
        
        const { question, options, questionType } = req.body;
        console.log(`[题库服务] 处理题目: ${question.substring(0, 50)}...`);
        
        // 在题库中搜索匹配的题目
        const matchResult = questionMatcher.searchQuestion(question, tikuData);
        
        if (matchResult.success) {
            res.json({
                success: true,
                answer: matchResult.answer,
                questionType: matchResult.questionType || questionType || '未知类型'
            });
        } else {
            res.json({
                success: false,
                error: true,
                message: matchResult.message || '未找到匹配的题目',
                matchScore: matchResult.matchScore || 0
            });
        }
        
    } catch (error) {
        handleError(res, error, '处理题目时发生错误');
    }
});

/**
 * 批量获取答案
 */
app.post('/api/get-batch-answers', async (req, res) => {
    try {
        const validation = validateRequest(req, ['questions']);
        if (!validation.valid) {
            return res.status(400).json({
                error: true,
                message: validation.message
            });
        }

        const { questions } = req.body;
        
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({
                error: true,
                message: '题目列表不能为空'
            });
        }

        if (!checkTikuLoaded(res)) return;
        
        console.log(`[题库服务] 批量处理 ${questions.length} 道题目`);
        
        // 批量搜索题目
        const results = questionMatcher.batchSearchQuestions(questions, tikuData);
        const successCount = results.filter(r => r.success).length;
        
        res.json({
            success: true,
            answers: results,
            total: questions.length,
            processed: successCount
        });
        
    } catch (error) {
        handleError(res, error, '批量处理题目时发生错误');
    }
});

/**
 * 更新匹配参数
 */
app.post('/api/update-match-params', (req, res) => {
    try {
        const { minSimilarity, maxResults } = req.body;
        
        if (minSimilarity !== undefined) {
            questionMatcher.minSimilarity = Math.max(0, Math.min(1, minSimilarity));
        }
        
        if (maxResults !== undefined) {
            questionMatcher.maxResults = Math.max(1, Math.min(50, maxResults));
        }
        
        res.json({
            success: true,
            message: '匹配参数更新成功',
            params: {
                minSimilarity: questionMatcher.minSimilarity,
                maxResults: questionMatcher.maxResults
            }
        });
        
    } catch (error) {
        handleError(res, error, '更新匹配参数失败');
    }
});

/**
 * 清空题库
 */
app.delete('/api/clear-tiku', async (req, res) => {
    try {
        const tikuJsonPath = path.join(CONFIG.DATA_DIR, 'tiku.json');
        const tikuTxtPath = path.join(CONFIG.DATA_DIR, 'tiku.txt');
        
        await fs.remove(tikuJsonPath);
        await fs.remove(tikuTxtPath);
        
        tikuData = null;
        
        res.json({
            success: true,
            message: '题库已清空'
        });
        
    } catch (error) {
        handleError(res, error, '清空题库失败');
    }
});

// 错误处理中间件
app.use((error, req, res, next) => {
    handleError(res, error, '服务器错误');
});

// 启动服务器
app.listen(PORT, () => {
    console.log(chalk.green(`[题库服务] 本地题库服务运行在 http://localhost:${PORT}`));
    
    if (tikuData) {
        console.log(chalk.blue(`[题库服务] 当前题库: ${tikuData.meta.totalQuestions} 道题目`));
    } else {
        console.log(chalk.yellow('[题库服务] 请通过 /api/import-tiku 导入题库文件'));
    }
});

module.exports = app;

// ==================== API 端点 ====================


/**
 * 获取题库信息
 */
app.get('/api/tiku-info', (req, res) => {
    if (!tikuData) {
        return res.status(404).json({
            error: true,
            message: '题库未加载，请先导入题库文件'
        });
    }
    
    res.json({
        success: true,
        meta: tikuData.meta,
        questionCount: tikuData.questions.length
    });
});

/**
 * 扫描tiku文件夹
 */
app.get('/api/scan-tiku-folder', async (req, res) => {
    try {
        const files = await fs.readdir(TIKU_DIR);
        const supportedFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.txt', '.doc', '.docx'].includes(ext);
        });

        const fileDetails = await Promise.all(
            supportedFiles.map(async (file) => {
                const filePath = path.join(TIKU_DIR, file);
                const stats = await fs.stat(filePath);
                return {
                    name: file,
                    size: stats.size,
                    sizeKB: Math.round(stats.size / 1024),
                    lastModified: stats.mtime
                };
            })
        );

        res.json({
            success: true,
            files: fileDetails,
            count: fileDetails.length
        });
    } catch (error) {
        res.status(500).json({
            error: true,
            message: '扫描tiku文件夹失败: ' + error.message
        });
    }
});

/**
 * 从tiku文件夹导入指定文件
 */
app.post('/api/import-from-tiku', async (req, res) => {
    try {
        const { fileName } = req.body;
        
        if (!fileName) {
            return res.status(400).json({
                error: true,
                message: '请指定要导入的文件名'
            });
        }

        const sourcePath = path.join(TIKU_DIR, fileName);
        
        // 检查文件是否存在
        if (!await fs.pathExists(sourcePath)) {
            return res.status(404).json({
                error: true,
                message: '指定的文件不存在'
            });
        }

        console.log(chalk.blue(`[题库服务] 开始从tiku文件夹导入: ${fileName}`));
        
        // 复制文件到data目录并重命名为tiku.txt
        const targetPath = path.join(DATA_DIR, 'tiku.txt');
        await fs.copy(sourcePath, targetPath);
        console.log(chalk.green(`[题库服务] 文件已复制并重命名为 tiku.txt`));

        // 解析题库文件
        console.log(chalk.blue(`[题库服务] 开始解析题库文件...`));
        const parsedData = await tikuParser.parseTikuFile(targetPath);
        
        // 保存为JSON缓存
        const saveSuccess = await saveTikuData(parsedData);
        
        if (saveSuccess) {
            res.json({
                success: true,
                message: '题库导入成功',
                meta: parsedData.meta,
                questionCount: parsedData.questions.length
            });
        } else {
            res.status(500).json({
                error: true,
                message: '题库保存失败'
            });
        }
        
    } catch (error) {
        console.error(chalk.red('[题库服务] 从tiku文件夹导入失败:'), error);
        res.status(500).json({
            error: true,
            message: '题库导入失败: ' + error.message
        });
    }
});

/**
 * 导入题库文件
 */
app.post('/api/import-tiku', upload.single('tikuFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: true,
                message: '请选择要导入的题库文件'
            });
        }

        console.log(chalk.blue(`[题库服务] 开始导入题库文件: ${req.file.originalname}`));
        
        // 解析题库文件
        const parsedData = await tikuParser.parseTikuFile(req.file.path);
        
        // 保存解析结果
        const saveSuccess = await saveTikuData(parsedData);
        
        if (saveSuccess) {
            res.json({
                success: true,
                message: '题库导入成功',
                meta: parsedData.meta,
                questionCount: parsedData.questions.length
            });
        } else {
            res.status(500).json({
                error: true,
                message: '题库保存失败'
            });
        }
        
    } catch (error) {
        console.error(chalk.red('[题库服务] 导入失败:'), error);
        res.status(500).json({
            error: true,
            message: '题库导入失败: ' + error.message
        });
    }
});

/**
 * 获取单个题目答案（与AI服务API保持一致）
 */
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
        
        if (!tikuData) {
            return res.status(500).json({ 
                error: true, 
                message: '题库未加载，请先导入题库文件' 
            });
        }
        
        console.log(`[题库服务] 处理题目: ${question.substring(0, 50)}...`);
        
        // 在题库中搜索匹配的题目
        const matchResult = questionMatcher.searchQuestion(question, tikuData);
        
        if (matchResult.success) {
            res.json({
                success: true,
                answer: matchResult.answer,
                questionType: matchResult.questionType || questionType || '未知类型'
            });
        } else {
            res.json({
                success: false,
                error: true,
                message: matchResult.message || '未找到匹配的题目',
                matchScore: matchResult.matchScore || 0
            });
        }
        
    } catch (error) {
        console.error('[题库服务] 处理题目时发生错误:', error);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

/**
 * 批量获取答案（与AI服务API保持一致）
 */
app.post('/api/get-batch-answers', async (req, res) => {
    try {
        const { questions } = req.body;
        
        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ 
                error: true, 
                message: '题目列表不能为空' 
            });
        }
        
        if (!tikuData) {
            return res.status(500).json({ 
                error: true, 
                message: '题库未加载，请先导入题库文件' 
            });
        }
        
        console.log(`[题库服务] 批量处理 ${questions.length} 道题目`);
        
        // 批量搜索题目
        const results = questionMatcher.batchSearchQuestions(questions, tikuData);
        
        const successCount = results.filter(r => r.success).length;
        
        res.json({
            success: true,
            answers: results,
            total: questions.length,
            processed: successCount
        });
        
    } catch (error) {
        console.error('[题库服务] 批量处理题目时发生错误:', error);
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

/**
 * 更新匹配参数
 */
app.post('/api/update-match-params', (req, res) => {
    try {
        const { minSimilarity, maxResults } = req.body;
        
        if (minSimilarity !== undefined) {
            questionMatcher.minSimilarity = Math.max(0, Math.min(1, minSimilarity));
        }
        
        if (maxResults !== undefined) {
            questionMatcher.maxResults = Math.max(1, Math.min(50, maxResults));
        }
        
        res.json({
            success: true,
            message: '匹配参数更新成功',
            params: {
                minSimilarity: questionMatcher.minSimilarity,
                maxResults: questionMatcher.maxResults
            }
        });
        
    } catch (error) {
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

/**
 * 清空题库
 */
app.delete('/api/clear-tiku', async (req, res) => {
    try {
        // 删除题库文件
        await fs.remove(TIKU_JSON_PATH);
        await fs.remove(path.join(DATA_DIR, 'tiku.txt'));
        
        tikuData = null;
        
        res.json({
            success: true,
            message: '题库已清空'
        });
        
    } catch (error) {
        res.status(500).json({
            error: true,
            message: error.message
        });
    }
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error(chalk.red('[题库服务] 错误:'), error);
    res.status(500).json({
        error: true,
        message: error.message
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(chalk.green(`[题库服务] 本地题库服务运行在 http://localhost:${PORT}`));
    
    if (tikuData) {
        console.log(chalk.blue(`[题库服务] 当前题库: ${tikuData.meta.totalQuestions} 道题目`));
    } else {
        console.log(chalk.yellow('[题库服务] 请通过 /api/import-tiku 导入题库文件'));
    }
});

module.exports = app;
