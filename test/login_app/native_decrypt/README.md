# ASAR JS 解密原生模块（AES+RSA 混合）

本目录为 Electron 主进程内 ASAR 加密 JS 的解密模块，采用 **AES+RSA 混合加密**：每文件随机 AES 密钥，用 RSA 公钥加密后与密文一起存放；运行时用仅存于本地的 RSA 私钥解密出 AES 密钥，再由本模块做 AES 解密。RSA 私钥仅存于 `key.h`，不进入打包产物。

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

## 密钥（RSA 2048）

在项目根目录执行一次：

```bash
npm run generate-key
```

会生成 RSA 2048 密钥对，并写入：

- `native_decrypt/key.h`：RSA **私钥** PEM（供原生模块运行时解密用，勿提交到公开仓库）
- `scripts/rsa_public.pem`：RSA **公钥** PEM（打包时 `encrypt-asar.js` 用其加密每文件的随机 AES 密钥）

- 执行后务必再执行 `npm run build:decrypt` 重新编译原生模块，再打包。
- 若需私钥仅本地持有，可将 `scripts/rsa_public.pem` 加入 `.gitignore`；反之可提交公钥以便他人也能打包。

## 加密格式（CXHYB）

- 魔术: `CXHYB`（5 字节）
- RSA 加密的 32 字节 AES 密钥: 256 字节（RSA 2048，PKCS#1）
- IV: 16 字节
- 密文: AES-256-CBC，PKCS7 填充
