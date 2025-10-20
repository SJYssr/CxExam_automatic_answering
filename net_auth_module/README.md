# 网络认证模块 (Net Auth Module)

这是一个基于Node.js的网络认证系统，用于软件授权和版本管理。系统通过MAC地址识别设备，并与远程服务器进行认证交互。

## 功能特性

- **设备识别**: 自动获取计算机MAC地址进行设备绑定
- **用户认证**: 通过软件ID、单码和版本号进行用户身份验证
- **版本控制**: 自动检查软件版本更新
- **错误处理**: 完善的错误代码和异常处理机制

## 系统架构

```
net_auth_module/
├── main.js              # 主程序入口，处理认证流程
├── config.js            # 配置文件，存储单码等常量
├── package.json         # 项目配置和依赖管理
└── model/               # 核心功能模块
    ├── error_code.js    # 错误代码定义
    ├── get_mac.js       # MAC地址获取模块
    ├── get_time.js      # 时间获取模块
    ├── get_version.js   # 版本管理模块
    └── login.js         # 登录认证模块
```

## 使用方法

### 方法1：直接运行认证流程
```bash
node main.js
```

### 方法2：作为模块集成使用
```javascript
const { executeLoginProcess } = require('./main.js');

// 执行认证流程
async function authenticate() {
    const result = await executeLoginProcess();
    
    if (result.success) {
        console.log('认证成功');
        console.log('到期时间:', result.expireTime);
        console.log('授权信息:', result.authorized);
    } else {
        console.log('认证失败:', result.error);
    }
}

authenticate();
```

## 认证流程

1. **设备识别**: 获取本地计算机MAC地址
2. **用户登录**: 使用软件ID、单码、版本号和MAC地址进行认证
3. **到期时间验证**: 获取软件到期时间信息
4. **版本检查**: 对比本地版本与远程版本，提示更新

## 配置说明

### 配置文件 (config.js)
```javascript
// 单码配置
const Card = 'scx4W8X4T2O8U9N0';
```

### 主程序常量 (main.js)
```javascript
const Softid = '6G6G7V8C2T9L9U8A';    // 软件ID
const Version = '1.0';               // 版本号
const LocalVersion = 'v1.0.0';       // 本地版本号
```

## 输出示例

成功认证的输出：
```
登录成功
到期时间: 2024-12-31 23:59:59
当前已是最新版本
```

失败认证的输出：
```
登录失败: 认证信息无效
```

## 依赖

- Node.js 12.0 或更高版本
- 内置模块: `os`, `fs`, `http`

## 注意事项

1. **网络连接**: 需要稳定的网络连接进行远程认证
2. **MAC地址**: 系统依赖MAC地址进行设备绑定，请确保网络接口正常工作
3. **配置文件**: 请妥善保管config.js中的单码信息
4. **版本管理**: 定期检查版本更新以确保功能完整性
5. **错误处理**: 系统提供详细的错误代码，便于问题排查

## 错误代码参考

系统使用标准化的错误代码机制，具体错误代码定义请参考 `model/error_code.js` 文件。