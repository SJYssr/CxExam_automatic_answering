// 题库导入工具 - 简单的Web界面
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = 3002;

// 配置multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../data');
        fs.ensureDirSync(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, 'tiku.txt');
    }
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.txt', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('只支持 .txt, .doc, .docx 格式的文件'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB限制
    }
});

// 静态文件服务
app.use(express.static('public'));

// 题库导入页面
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>题库导入工具</title>
    <style>
        body {
            font-family: 'Microsoft YaHei', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .upload-area {
            border: 2px dashed #ccc;
            border-radius: 10px;
            padding: 40px;
            text-align: center;
            margin: 20px 0;
            transition: border-color 0.3s;
        }
        .upload-area:hover {
            border-color: #007bff;
        }
        .upload-area.dragover {
            border-color: #007bff;
            background-color: #f8f9fa;
        }
        input[type="file"] {
            margin: 20px 0;
        }
        button {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
        }
        button:hover {
            background-color: #0056b3;
        }
        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        .status {
            margin: 20px 0;
            padding: 15px;
            border-radius: 5px;
            display: none;
        }
        .status.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .info {
            background-color: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        .format-example {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            font-family: monospace;
            white-space: pre-line;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📚 题库导入工具</h1>
        
        <div class="info">
            <strong>使用说明：</strong>
            <ul>
                <li>支持 .txt, .doc, .docx 格式的题库文件</li>
                <li>文件大小限制：10MB</li>
                <li>导入后会自动重命名为 tiku.txt 并缓存为 tiku.json</li>
                <li>支持多种编码格式：UTF-8, GBK, GB2312</li>
            </ul>
        </div>

        <div class="format-example">
<strong>题库文件格式示例：</strong>

1. 单选题：以下哪个是编程语言？
A. HTML
B. CSS
C. JavaScript
D. XML
答案：C

2. 多选题：以下哪些是前端技术？
A. HTML
B. CSS
C. JavaScript
D. Python
答案：ABC

3. 判断题：JavaScript只能在浏览器中运行。
A. 对
B. 错
答案：B

4. 填空题：请填写JavaScript的全称。
答案：JavaScript

5. 简答题：请简述JavaScript的特点。
答案：JavaScript是一种解释型、动态类型、基于原型的编程语言
        </div>

        <form id="uploadForm" enctype="multipart/form-data">
            <div class="upload-area" id="uploadArea">
                <p>点击选择文件或拖拽文件到此处</p>
                <input type="file" id="fileInput" name="tikuFile" accept=".txt,.doc,.docx" required>
            </div>
            <div style="text-align: center;">
                <button type="submit" id="uploadBtn">导入题库</button>
                <button type="button" id="checkBtn">检查题库状态</button>
            </div>
        </form>

        <div id="status" class="status"></div>
    </div>

    <script>
        const uploadForm = document.getElementById('uploadForm');
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadBtn');
        const checkBtn = document.getElementById('checkBtn');
        const status = document.getElementById('status');
        const uploadArea = document.getElementById('uploadArea');

        // 拖拽上传
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
            }
        });

        // 点击上传区域选择文件
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // 文件选择
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                uploadArea.innerHTML = '<p>已选择文件: ' + e.target.files[0].name + '</p>';
            }
        });

        // 表单提交
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!fileInput.files[0]) {
                showStatus('请选择要导入的题库文件', 'error');
                return;
            }

            uploadBtn.disabled = true;
            uploadBtn.textContent = '⏳ 导入中...';

            try {
                const formData = new FormData();
                formData.append('tikuFile', fileInput.files[0]);

                const response = await fetch('http://localhost:3001/api/import-tiku', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    showStatus('题库导入成功！\n题目数量: ' + result.questionCount + '\n' + JSON.stringify(result.meta, null, 2), 'success');
                } else {
                    showStatus('导入失败: ' + result.message, 'error');
                }
            } catch (error) {
                showStatus('导入失败: ' + error.message, 'error');
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = '导入题库';
            }
        });

        // 检查题库状态
        checkBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('http://localhost:3001/api/tiku-info');
                const result = await response.json();

                if (result.success) {
                    showStatus('题库状态:\n题目数量: ' + result.questionCount + '\n' + JSON.stringify(result.meta, null, 2), 'success');
                } else {
                    showStatus('获取题库信息失败: ' + result.message, 'error');
                }
            } catch (error) {
                showStatus('检查失败: ' + error.message, 'error');
            }
        });

        function showStatus(message, type) {
            status.textContent = message;
            status.className = 'status ' + type;
            status.style.display = 'block';
        }
    </script>
</body>
</html>
    `);
});

app.listen(PORT, () => {
    console.log(`题库导入工具运行在 http://localhost:${PORT}`);
});
