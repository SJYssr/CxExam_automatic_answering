/**
 * 检查本机是否具备编译原生模块（node-gyp）所需环境：
 * - Windows: Visual Studio Build Tools 或 Visual Studio（含 C++ 工作负载）
 * - 可通过 npm 安装 windows-build-tools（旧版）或手动安装 VS Build Tools
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWin = process.platform === 'win32';

function checkWindows() {
  console.log('正在检查 Windows 构建环境...\n');

  // 1. 检查是否有 node-gyp（随 npm 全局提供，用 npx 调用）
  try {
    execSync('npx node-gyp --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log('  [√] node-gyp 已可用（随 npm 提供）');
  } catch (_) {
    console.log('  [ ] node-gyp 未找到，请确认已安装 Node.js 与 npm，或执行: npm install -g node-gyp');
    return false;
  }

  // 2. 检查是否有 Visual Studio 相关组件（通过 vswhere 或常见路径）
  let hasVS = false;
  const programFiles = process.env['ProgramFiles(x86)'] || process.env.ProgramFiles;
  const vsPath = programFiles && path.join(programFiles, 'Microsoft Visual Studio', '2022', 'Build Tools');
  const vsPathCommunity = programFiles && path.join(programFiles, 'Microsoft Visual Studio', '2022', 'Community');

  if (vsPath && fs.existsSync(vsPath)) {
    hasVS = true;
    console.log('  [√] 检测到 Visual Studio 2022 Build Tools:', vsPath);
  }
  if (vsPathCommunity && fs.existsSync(vsPathCommunity)) {
    hasVS = true;
    console.log('  [√] 检测到 Visual Studio 2022 Community:', vsPathCommunity);
  }

  // 尝试 vswhere（VS 自带的查找工具）
  if (!hasVS) {
    const vswherePaths = [
      path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe'),
      path.join(process.env.ProgramFiles || '', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe'),
    ];
    for (const vsp of vswherePaths) {
      if (fs.existsSync(vsp)) {
        try {
          const out = execSync(`"${vsp}" -latest -products * -requires Microsoft.Component.MSBuild -property installationPath`, { encoding: 'utf8' });
          const installPath = out.trim();
          if (installPath) {
            hasVS = true;
            console.log('  [√] 通过 vswhere 检测到 Visual Studio:', installPath);
            break;
          }
        } catch (_) {}
      }
    }
  }

  if (!hasVS) {
    console.log('  [ ] 未检测到 Visual Studio Build Tools / Visual Studio');
    console.log('\n  请安装以下之一：');
    console.log('  - Visual Studio 2022 Build Tools: https://visualstudio.microsoft.com/zh-hans/visual-cpp-build-tools/');
    console.log('    安装时勾选「使用 C++ 的桌面开发」');
    console.log('  - 或完整版 Visual Studio 2022，并勾选 C++ 工作负载');
    return false;
  }

  console.log('\n  环境就绪，可以执行: npm run build:decrypt');
  return true;
}

function checkOther() {
  console.log('当前系统:', process.platform);
  console.log('请确保已安装 node-gyp 所需依赖（如 GCC/Clang、make 等）');
  return true;
}

if (isWin) {
  const ok = checkWindows();
  process.exit(ok ? 0 : 1);
} else {
  checkOther();
}
