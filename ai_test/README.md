# 超星学习通考试AI辅助填充系统

这是一个前后端分离的超星学习通考试AI辅助填充系统，将原来的单脚本重构为前端和后端两个独立部分。

## 系统架构

### 前端部分 (`frontend/cxexam_ai_frontend.js`)
- **功能**：获取题目和选项、填充答案
- **职责**：
  - 检测超星学习通考试页面
  - 提取题目内容和选项
  - 与后端API通信
  - 将AI答案填充到页面表单

### 后端部分 (`backend/`)
- **功能**：接收题目数据，调用AI API获取答案
- **职责**：
  - 提供RESTful API接口
  - 调用DeepSeek AI API
  - 处理AI返回结果
  - 批量处理题目

## 文件结构

```
ai_test/
├── frontend/
│   └── cxexam_ai_frontend.js    # 前端脚本
├── backend/
│   ├── server.js                # 后端服务器
│   ├── package.json             # 后端依赖配置
│   └── .env.example             # 环境变量示例
└── README.md                    # 使用说明
```

## 安装和配置

### 后端配置

1. 进入后端目录：
```bash
cd backend
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量：
```bash
# 复制示例文件
cp .env .env

# 编辑.env文件，设置你的DeepSeek API Key
DEEPSEEK_API_KEY=your_actual_api_key_here
```

4. 启动后端服务：
```bash
npm start
```

后端服务将运行在 `http://localhost:3000`

5. 测试后端服务（可选）：
```bash
node test_api.js
```

### 前端使用

1. 在浏览器中打开超星学习通考试页面
2. 在开发者工具的控制台中粘贴并执行 `frontend/cxexam_ai_frontend.js` 的内容
3. 或者使用浏览器扩展（如Tampermonkey）创建用户脚本

## 使用说明

### 自动模式
- 脚本加载后会自动获取所有题目并发送到后端获取AI答案
- 答案获取完成后，鼠标指针会变为手形提示

### 手动触发
- **鼠标中键**：填充AI答案到页面表单
- 如果答案尚未获取，会自动触发获取流程

### 支持的题目类型
- ✅ 单选题
- ✅ 多选题  
- ✅ 判断题
- ✅ 填空题
- ✅ 简答题

## API接口说明

### 健康检查
```
GET /health
```

### 获取单个题目答案
```
POST /api/get-answer
Content-Type: application/json

{
  "question": "题目内容",
  "options": ["A. 选项1", "B. 选项2"],
  "questionType": "单选题"
}
```

### 批量获取题目答案
```
POST /api/get-batch-answers
Content-Type: application/json

{
  "questions": [
    {
      "questionHash": "q-1",
      "question": "题目1内容",
      "options": ["A. 选项1", "B. 选项2"],
      "questionType": "单选题"
    },
    {
      "questionHash": "q-2", 
      "question": "题目2内容",
      "options": [],
      "questionType": "填空题"
    }
  ]
}
```

## 注意事项

1. **API Key配置**：确保在 `.env` 文件中正确设置 DeepSeek API Key
2. **跨域问题**：后端已配置CORS，支持跨域访问
3. **网络连接**：确保前端可以访问后端服务（localhost:3000）
4. **浏览器控制台**：使用前请打开浏览器开发者工具查看日志

## 故障排除

### 后端服务无法启动
- 检查Node.js版本（需要 >= 14.0.0）
- 检查端口3000是否被占用
- 检查 `.env` 文件配置

### 前端无法连接后端
- 确认后端服务正在运行
- 检查浏览器控制台是否有跨域错误
- 确认后端URL配置正确

### AI答案获取失败
- 检查DeepSeek API Key是否正确
- 查看后端日志获取详细错误信息
- 检查网络连接

## 更新日志

### v1.0.0
- 重构为前后端分离架构
- 支持批量题目处理
- 改进错误处理和日志记录
- 优化答案填充逻辑