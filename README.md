# CxExam 自动答题助手（winmm 注入 DLL）

通过代理 `winmm.dll` 注入基于 CEF 的超星学习通 Windows 客户端：

- 解除考试页面的复制/右键限制
- AI 辅助答题：自动抓取题目，调用 DeepSeek API 生成答案，支持复制作答与一键填充

本项目**不包含任何登录、卡密、设备绑定或有效期验证**，克隆后即可构建使用。
AI 功能使用你自己的 DeepSeek API Key，由你自行配置并承担相应费用。

## 使用方法

1. 将构建得到的 `winmm.dll` 放入学习通客户端主程序目录（`winmm.dll` 为系统 DLL 代理，客户端启动时会自动加载本 DLL）。
2. 配置 AI API Key（两种方式任选其一，无需重新编译）：
   - **config.json 文件**：在 `winmm.dll` 同目录创建 `config.json`：

     ```json
     { "apiKey": "sk-xxxxxxxxxxxxxxxx" }
     ```

     保存后重新打开考试页面即可生效。
   - **页面内设置面板**：在考试页面按 `Ctrl+Alt+K`，粘贴 API Key 并保存（保存在本机浏览器中）。
3. 打开考试页面，脚本自动开始获取答案。

### 答题操作

- 页面加载后自动开始获取 AI 答案
- 选中题目后 `Ctrl+C` 获取答案，等待获取完成后鼠标指针变为小手，左键点击空白处填充答案（答题框不能有任何内容，不要点击答题框！）
- 鼠标中键：填充全部答案

### 配置优先级与错误处理

- 页面内保存的 Key 优先于 `config.json`。
- 未配置或配置错误的 API Key 只影响 AI 功能（会弹出设置面板并给出明确提示），页面解锁功能不受影响。

## 构建（Windows x86）

依赖：Visual Studio 2019/2022（含 C++ 桌面开发）、CMake 3.10+、[vcpkg](https://github.com/microsoft/vcpkg)、CEF Windows 32 位二进制分发包。

```bat
:: 1. 安装 detours 依赖（x86）
vcpkg install detours:x86-windows

:: 2. 补齐 CEF 二进制：本仓库已包含 CEF 头文件与 wrapper 源码（cef/），
::    还需从 https://cef-builds.spotifycdn.com/ 下载与该源码匹配版本的
::    Windows 32 位分发包，将分发包中的 Release/、Resources/ 目录
::    和 libcef.lib 补到 cef/ 目录下。

:: 3. 生成并编译（工具链指向 vcpkg）
cmake -S . -B build -G "Visual Studio 17 2022" -A Win32 -DCMAKE_TOOLCHAIN_FILE=<vcpkg根目录>/scripts/buildsystems/vcpkg.cmake
cmake --build build --config Release
```

产物为 `build/src/Release/winmm.dll`。

> - 本 DLL 仅支持 **Windows x86（32 位）** 的 CEF 客户端：依赖 Windows API、winmm 代理机制与 x86 内联汇编，不支持 macOS / Linux，也不支持 64 位目标程序。
> - `src/scripts/` 中的 JS 脚本以资源形式编译进 DLL（见 `src/CefHook.rc`），修改任何脚本或 C++ 代码后都必须重新构建并替换 `winmm.dll`。

## 卸载

删除学习通客户端目录中的 `winmm.dll` 与 `config.json` 即可完全还原；如使用过页面内设置，可在设置面板（`Ctrl+Alt+K`）中点击"清除已保存"。

## 目录结构

```
├── CMakeLists.txt          # CMake 入口（CefHook 工程）
├── src/                    # DLL 源码（winmm 代理 + CEF Hook）
│   ├── thread.cpp          # 注入与脚本加载逻辑（含 config.json 读取）
│   ├── dllmain.cpp         # winmm 导出转发
│   └── scripts/            # 注入用的 JS 脚本（编译为 DLL 资源）
├── cef/                    # CEF 头文件与 wrapper 源码（二进制需自行补齐）
└── chromium/               # chromium 补充头文件
```

## 协议

见 [LICENSE](LICENSE)。
