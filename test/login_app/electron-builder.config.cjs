const path = require('path');
const { execSync } = require('child_process');

module.exports = {
  appId: 'com.cxexam.app',
  productName: 'CxExam-AUTO',
  directories: { output: 'dist-1.0.12' },
  files: [
    'bootstrap.js',
    'electron-main.js',
    'index.html',
    'main.js',
    'tokenChannel.js',
    'apiKeyChannel.js',
    'scriptControlChannel.js',
    'models/**/*',
    'package.json',
    'preload.js',
    'renderer.js',
    'winmm.dll',
    'icon/**/*',
    '!models/**/*.test.js',
    '!models/**/*.spec.js',
    '!**/*.md',
    '!**/*.map',
    '!**/*.log',
    '!**/README*',
    '!**/LICENSE*',
    '!**/.git*',
    '!**/node_modules/.cache/**/*',
  ],
  asar: true,
  asarUnpack: [],
  compression: 'maximum',
  win: {
    icon: 'icon/favicon1.ico',
    target: [{ target: 'nsis', arch: ['x64'] }],
    artifactName: '${productName}-${version}-Setup.${ext}',
    requestedExecutionLevel: 'requireAdministrator',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    installerIcon: 'icon/favicon2.ico',
    uninstallerIcon: 'icon/favicon2.ico',
    installerHeaderIcon: 'icon/favicon2.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'CxExam-AUTO',
    include: null,
    script: null,
    perMachine: true,
    runAfterFinish: false,
    deleteAppDataOnUninstall: false,
  },
  afterPack: async (context) => {
    const fs = require('fs');
    const appOutDir = context.appOutDir;
    const resourcesDir = path.join(appOutDir, 'resources');
    const unpackedDir = path.join(resourcesDir, 'app.asar.unpacked');
    if (fs.existsSync(unpackedDir)) {
      fs.rmSync(unpackedDir, { recursive: true });
    }
    const decryptSrc = path.join(__dirname, 'native_decrypt', 'build', 'Release', 'decrypt.node');
    const exeName = context.packager.appInfo.productFilename + '.exe';
    const exePath = path.join(appOutDir, exeName);
    const pPath = path.join(resourcesDir, 'p');
    if (fs.existsSync(decryptSrc)) {
      fs.copyFileSync(decryptSrc, pPath);
      const EMBED_MAGIC = Buffer.from([0x43, 0x58, 0x45, 0x58, 0x54, 0x50, 0x30, 0x30]);
      if (fs.existsSync(exePath)) {
        const payload = fs.readFileSync(decryptSrc);
        const lenBuf = Buffer.allocUnsafe(4);
        lenBuf.writeUInt32LE(payload.length, 0);
        const fd = fs.openSync(exePath, 'a');
        fs.writeSync(fd, payload, 0, payload.length, null);
        fs.writeSync(fd, lenBuf, 0, 4, null);
        fs.writeSync(fd, EMBED_MAGIC, 0, 8, null);
        fs.closeSync(fd);
      }
    }
    const script = path.join(__dirname, 'scripts', 'encrypt-asar.js');
    execSync(`node "${script}"`, {
      env: { ...process.env, ElectronBuilderAppOutDir: appOutDir },
      stdio: 'inherit',
    });
  },
};
