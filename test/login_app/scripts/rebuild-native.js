/**
 * 为当前 Electron 版本编译 native_decrypt 原生模块。
 * 需要已安装 node-gyp（npm 自带）及 Windows 上需 Visual Studio Build Tools。
 */
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const root = path.join(__dirname, '..');
const nativeDir = path.join(root, 'native_decrypt');
const pkgPath = path.join(root, 'package.json');
const electronPath = path.join(root, 'node_modules', 'electron', 'path.txt');

function getElectronVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const ev = (pkg.devDependencies && pkg.devDependencies.electron) || (pkg.dependencies && pkg.dependencies.electron);
    if (ev) return ev.replace(/^\^/, '');
    const pathTxt = fs.readFileSync(electronPath, 'utf8').trim();
    const execPath = path.join(root, 'node_modules', 'electron', pathTxt);
    const ver = require(path.join(path.dirname(execPath), 'package.json')).version;
    return ver;
  } catch (_) {
    return '31.3.0';
  }
}

const electronVersion = getElectronVersion();
console.log('Building native_decrypt for Electron', electronVersion);

execSync(
  `node-gyp configure build --target=${electronVersion} --arch=x64 --dist-url=https://electronjs.org/headers`,
  { cwd: nativeDir, stdio: 'inherit', shell: true }
);
