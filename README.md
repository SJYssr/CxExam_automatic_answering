# 超星考试自动答题工具

<div align="center">

<h1>🤖 超星考试自动答题助手</h1>

[![版本](https://img.shields.io/badge/版本-V1.0.0-brightgreen)](https://github.com/SJYssr/CxExam_automatic_answering/releases)
[![许可证](https://img.shields.io/badge/许可证-GPL--3.0-blue)](https://github.com/SJYssr/CxExam_automatic_answering/blob/main/LICENSE)
[![状态](https://img.shields.io/badge/状态-可用-success)](https://github.com/SJYssr/CxExam_automatic_answering)
[![贡献](https://img.shields.io/badge/欢迎-贡献-orange)](https://github.com/SJYssr/CxExam_automatic_answering/issues)

*本项目基于CEF钩子技术和DeepSeek AI，实现超星考试客户端的自动答题功能*

*开发者调试请自行解开注释，个人使用请直接使用release最新版本*

*仅用于个人学习交流，严禁用于商业用途！*

</div>

<p align="center">
  <a href="#项目起源">项目起源</a> •
  <a href="#功能特性">功能特性</a> •
  <a href="#实现原理">实现原理</a> •
  <a href="#使用方法">使用方法</a> •
  <a href="#赞赏支持">赞赏支持</a> •
  <a href="#免责声明">免责声明</a>
</p>

---

## 📖 项目起源

<table>
<tr>
<td width="60%">

本项目基于 [kazutoiris](https://github.com/kazutoiris) 的 [cef-hook](https://github.com/kazutoiris/cef-hook) 项目，结合DeepSeek AI技术，为超星考试客户端开发了自动答题功能。

**项目特色**：
- 版本：V2.1.0 (2025-5-16更新)
- 支持：超星考试客户端最新版(4.3.0.2)
- 技术：CEF钩子 + DeepSeek AI智能答题
- 开发者：[SJYssr](https://github.com/SJYssr)

**核心功能**：
- 自动识别考试题目类型（单选、多选、判断、填空、简答）
- 调用DeepSeek AI API进行智能答题
- 支持鼠标中键一键填充答案
- 绕过考试客户端的防作弊限制

</td>
<td width="40%">

<div align="center">
<h3>🔄 CEF渲染引擎</h3>
<p>基于Chromium的内嵌浏览器框架</p>
<p>↓</p>
<h3>🤖 AI智能分析</h3>
<p>DeepSeek AI自动答题</p>
<p>↓</p>
<h3>🛠️ DLL注入与钩子</h3>
<p>绕过防作弊限制</p>
</div>

</td>
</tr>
</table>

## 🚀 功能特性

<div align="center">

| 功能 | 描述 | 状态 |
|:----:|:-----|:----:|
| 🤖 **AI自动答题** | 调用DeepSeek AI API自动分析题目并给出答案 | ✅ |
| 🎯 **智能题型识别** | 自动识别单选、多选、判断、填空、简答等题型 | ✅ |
| 🖱️ **一键填充答案** | 鼠标中键一键填充所有AI答案到答题区域 | ✅ |
| 🛡️ **反反截屏** | 绕过考试客户端对截图和录屏的限制 | ✅ |
| 📋 **破除复制限制** | 解除考试客户端内容选择和复制限制 | ✅ |
| 🖱️ **破除选中限制** | 可以自由选择考试页面上的文本 | ✅ |
| 📝 **复制粘贴题目** | 支持题目内容的复制粘贴功能 | ✅ |
| 🛠️ **开发者调试** | 按下 ALT 键可以进入开发者调试模式（默认为注释状态）| ✅ |

</div>

## 💻 实现原理

<details open>
<summary><b>技术实现详解</b></summary>

<div align="center">
<h3>🔄 工作流程</h3>
</div>

```
超星客户端启动
    ↓
DLL注入到客户端
    ↓
Hook关键函数:
    ├── 1. SetWindowDisplayAffinity → 绕过防截图
    ├── 2. CEF浏览器函数 → 注入JavaScript脚本
    └── 3. 键盘事件处理 → 添加ALT快捷键
            ↓
JavaScript脚本执行:
    ├── crack_script.js → 解除复制和选中限制
    ├── deepseek_ai_script.js → AI自动答题功能
    └── notification_script.js → 通知和提示功能
            ↓
AI答题流程:
    ├── 检测考试页面 → 识别题目类型
    ├── 调用DeepSeek API → 获取AI答案
    └── 鼠标中键触发 → 自动填充答案
```

本项目主要通过以下技术实现功能：

- **CEF钩子技术**：使用 AheadLib 库进行函数转发和钩子，拦截CEF浏览器相关函数
- **DLL注入**：将自定义DLL注入到超星考试客户端进程中
- **JavaScript注入**：通过钩子函数向CEF浏览器注入自定义JavaScript脚本
- **AI集成**：集成DeepSeek AI API进行智能题目分析和答案生成
- **事件处理**：实现鼠标中键事件监听，支持一键填充答案功能

**核心脚本功能**：
- `crack_script.js`：解除页面复制、选中、右键菜单等限制
- `deepseek_ai_script.js`：AI自动答题核心逻辑，支持多种题型
- `notification_script.js`：提供用户交互和状态提示

</details>

## 📋 使用方法

### 🔧 环境准备

<div style="padding: 15px; border-left: 4px solid #5bc0de; background-color:rgb(7, 78, 114); margin: 10px 0;">
<b>⚠️ 注意</b>：请确保按照正确顺序配置环境，否则可能导致功能异常
</div>

1. **DeepSeek API Key配置**：
   - 访问 [DeepSeek官网](https://www.deepseek.com/) 获取API Key
   - 在 `src/scripts/deepseek_ai_script.js` 中配置您的API Key
   ```javascript
   const DEEPSEEK_API_KEY = '您的API Key';
   ```

2. **开发环境**：
   - 安装 Visual Studio 2019 或更高版本
   - 确保系统支持CMake构建

### 🔨 编译部署

```bash
# 克隆项目
git clone https://github.com/SJYssr/CxExam_automatic_answering.git

# 进入项目目录
cd CxExam_automatic_answering

# 使用CMake构建项目
mkdir build && cd build
cmake ..
cmake --build . --config Release
```

1. 使用 Visual Studio 或 CMake 编译项目，生成 DLL 文件
2. 将生成的 DLL 文件复制到超星考试客户端的安装目录下
3. 启动超星考试客户端，功能将自动生效

### 🤖 AI答题使用

<div style="padding: 15px; border-left: 4px solid #f0ad4e; background-color:rgb(58, 49, 3); margin: 10px 0;">
<b>重要提示</b>：使用前请仔细阅读以下内容
</div>

**自动答题流程**：
1. 进入超星考试页面后，脚本会自动检测并开始获取题目
2. AI会自动分析所有题目并生成答案
3. 当鼠标指针变为手形时，表示答案已准备就绪
4. **点击鼠标中键**（滚轮按下）一键填充所有答案
5. 若没有自动获取答案，点击鼠标中键获取答案

**支持题型**：
- ✅ 单选题：自动选择正确答案选项
- ✅ 多选题：自动选择多个正确答案选项
- ✅ 判断题：自动判断对错
- ✅ 填空题：自动填充答案内容
- ✅ 简答题：自动生成简要答案

### 📝 使用提示

- 登录考试前会显示注入成功的提示窗口
- ⚠️ **警告**: ALT 键可进入开发者调试模式，但误触可能导致无法正常考试
- 注入后可以正常使用 <kbd>Ctrl</kbd>+<kbd>C</kbd>、<kbd>Ctrl</kbd>+<kbd>V</kbd> 复制粘贴文本
- 可自由对考试页面进行截图和录屏

## 可能遇到的问题
1. 不同的考试客户端版本可能存在兼容性问题，建议直接将考试客户端升至最新版本
2. 不同的计算机可能因版本不同存在兼容性问题（目前win7,win11,23H2都可使用）
3. 无法正常加载可能是您自身的问题
4. AI API调用失败：检查API Key配置和网络连接

## 🎁 赞赏支持

<div align="center">
<p>如果您觉得此项目对您有所帮助，可以扫描以下二维码进行赞赏支持：</p>

<img src="https://github.com/SJYssr/img/raw/main/1/zanshang.jpg" alt="赞赏码" width="200">

<p><i>您的支持是我持续更新的动力</i></p>
</div>

## ⚖️ 免责声明

<div style="padding: 15px; border: 1px solid #d9534f; background-color:rgb(238, 156, 156); border-radius: 5px; margin: 10px 0;">
<h4>⚠️ 免责声明</h4>
<ul>
<li>本代码遵循 <a href="https://github.com/SJYssr/cef_cx_copy_tool/blob/main/LICENSE">GPL-3.0 License</a> 协议，允许<strong>开源/免费使用和引用/修改/衍生代码的开源/免费使用</strong>，不允许<strong>修改和衍生的代码作为闭源的商业软件发布和销售</strong>，禁止<strong>使用本代码盈利</strong>，以此代码为基础的程序<strong>必须</strong>同样遵守 <a href="https://github.com/SJYssr/cef_cx_copy_tool/blob/main/LICENSE">GPL-3.0 License</a>协议</li>
<li>本代码仅用于<strong>学习讨论</strong>，禁止<strong>用于盈利</strong>和<strong>非法用途</strong></li>
<li>他人或组织使用本代码进行的任何<strong>违法行为</strong>与本人无关</li>
<li>使用本项目造成的任何后果由使用者自行承担</li>
</ul>
</div>

---

<div align="center">
<p>Made with ❤️ by <a href="https://github.com/SJYssr">SJYssr</a></p>
<p>
  <a href="#">回到顶部</a> •
  <a href="https://github.com/SJYssr/cef_cx_copy_tool/issues">报告问题</a> •
  <a href="https://github.com/SJYssr/cef_cx_copy_tool/blob/main/LICENSE">许可协议</a>
</p>
</div>