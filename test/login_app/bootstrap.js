/**
 * 引导入口：Hook Module._extensions['.js']，在读取文件后、编译前对 app.asar 内加密 JS 用原生模块解密。
 * 密钥仅存在于原生模块中；此文件与 .node 通过 asarUnpack 放出，保证先于加密代码执行。
 * 开发环境未编译原生模块时自动退化为不解密直接运行。
 */
const Module = require('module');
const path = require('path');
const fs = require('fs');

const appAsarUnpacked = __dirname;
let decryptNative = null;
let decryptAvailable = false;

function loadDecryptNative() {
  if (decryptNative !== null) return decryptNative;
  try {
    const nodePath = path.join(appAsarUnpacked, 'native_decrypt', 'build', 'Release', 'decrypt.node');
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
