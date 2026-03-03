/**
 * 引导入口：Hook Module._extensions['.js']，在读取文件后、编译前对 app.asar 内加密 JS 用原生模块解密。
 * 本文件保留在 asar 内（不加密），.node 在 app.asar.unpacked，运行时从 unpacked 加载。
 */
const Module = require('module');
const path = require('path');
const fs = require('fs');

let decryptNative = null;
let decryptAvailable = false;

function getUnpackedDir() {
  if (__dirname.includes('app.asar')) {
    return __dirname.replace(/app\.asar$/, 'app.asar.unpacked');
  }
  return __dirname;
}

function loadDecryptNative() {
  if (decryptNative !== null) return decryptNative;
  try {
    const unpacked = getUnpackedDir();
    const nodePath = path.join(unpacked, 'native_decrypt', 'build', 'Release', 'decrypt.node');
    decryptNative = require(nodePath);
    decryptAvailable = true;
  } catch (_) {
    decryptNative = false;
  }
  return decryptNative;
}

const MAGIC = Buffer.from('CXENC', 'utf8');

function isEncrypted(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 5 && buf.slice(0, 5).equals(MAGIC);
}

const originalJsExtension = Module._extensions['.js'];
Module._extensions['.js'] = function (module, filename) {
  let content = fs.readFileSync(filename);
  if (decryptAvailable && (filename.includes('app.asar') || filename.includes('app.asar.unpacked')) && isEncrypted(content)) {
    content = loadDecryptNative().decrypt(content);
  } else {
    content = content.toString('utf8');
  }
  module._compile(content, filename);
};

loadDecryptNative();
require('./electron-main.js');
