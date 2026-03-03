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
    'native_decrypt/build/Release/decrypt.node',
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
  asarUnpack: [
    'bootstrap.js',
    'native_decrypt/build/Release/decrypt.node',
  ],
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
    const script = path.join(__dirname, 'scripts', 'encrypt-asar.js');
    execSync(`node "${script}"`, {
      env: { ...process.env, ElectronBuilderAppOutDir: context.appOutDir },
      stdio: 'inherit',
    });
  },
};
