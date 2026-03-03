# ASAR JS 解密原生模块

本目录为 Electron 主进程内 ASAR 加密 JS 的解密模块，密钥仅存于此处（`key.h`），运行时通过 Hook `Module._extensions['.js']` 在读取后、编译前解密。

## 检查本机是否有 Visual Studio Build Tools（Windows）

在项目根目录执行：

```bash
npm run check-build-tools
```

若未检测到，请安装 [Visual Studio 2022 生成工具](https://visualstudio.microsoft.com/zh-hans/visual-cpp-build-tools/)，安装时勾选 **「使用 C++ 的桌面开发」**。

## 构建原生模块

在项目根目录执行：

```bash
npm run build:decrypt
```

## 密钥（建议使用强随机密钥）

在项目根目录执行一次：

```bash
npm run generate-key
```

会生成 32 字节加密安全随机密钥，并写入 `native_decrypt/key.h` 与 `scripts/asar-key.hex`，打包时 `encrypt-asar.js` 会优先使用 `asar-key.hex`。AES-256 下 2^256 种密钥在理论上不可暴力破解。

- 执行后务必再执行 `npm run build:decrypt` 重新编译原生模块，再打包。
- 建议将 `scripts/asar-key.hex` 加入 `.gitignore`（已包含在项目 .gitignore），避免密钥进入版本库。
- 若需覆盖密钥，可设置环境变量 `ASAR_ENCRYPT_KEY`（64 位 hex）再打包；此时仍需保证 `key.h` 与之一致（或仅用 asar-key.hex + generate-key 生成 key.h）。

## 加密格式

- 魔术: `CXENC`（5 字节）
- IV: 16 字节
- 密文: AES-256-CBC，PKCS7 填充
