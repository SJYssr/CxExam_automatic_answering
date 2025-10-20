# 获取计算机MAC地址的Node.js应用

这是一个简单的Node.js应用程序，用于获取当前计算机的网络接口MAC地址。

## 功能特性

- 获取所有网络接口的MAC地址
- 识别主要网络接口的MAC地址
- 支持Windows、macOS和Linux系统
- 提供详细和简化两种版本

## 使用方法

### 方法1：运行完整版本（推荐）
```bash
node index.js
```

### 方法2：运行简化版本
```bash
node simple-mac.js
```

### 方法3：作为模块使用
```javascript
const macUtils = require('./index.js');

// 获取所有MAC地址
const allMacs = macUtils.getMacAddresses();
console.log('所有MAC地址:', allMacs);

// 获取主要MAC地址
const primaryMac = macUtils.getPrimaryMacAddress();
console.log('主要MAC地址:', primaryMac);
```

## 文件说明

- `index.js` - 完整版本，提供详细的网络接口信息
- `simple-mac.js` - 简化版本，直接输出MAC地址
- `package.json` - 项目配置文件

## 输出示例

运行 `node index.js` 会输出类似以下内容：

```
=== 计算机MAC地址信息 ===

所有网络接口的MAC地址：

接口名称: Ethernet0
  1. IP地址: 192.168.1.100
     MAC地址: 00:1B:44:11:3A:B7
     地址类型: IPv4
     内部接口: 否

=== 主要MAC地址 ===
主要MAC地址: 00:1B:44:11:3A:B7

=== 系统信息 ===
操作系统平台: win32
操作系统版本: 10.0.19044
主机名: DESKTOP-ABC123
```

## 注意事项

1. 程序需要网络权限来读取网络接口信息
2. 在某些系统上，虚拟网络接口（如VPN、虚拟机）也会被列出
3. MAC地址格式可能因操作系统而异
4. 程序会自动过滤掉内部（loopback）接口

## 依赖

- Node.js 10.0 或更高版本
- 内置 `os` 模块（无需额外安装）