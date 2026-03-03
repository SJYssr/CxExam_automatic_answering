/**
 * 引导入口：Hook Module._extensions['.js']，在读取文件后、编译前对 app.asar 内加密 JS 解密。
 * 支持格式：CXHYB（AES+RSA 混合）— Node 用 RSA 私钥解密出 AES 密钥，原生模块用 AES 解密内容。
 * 本文件不加密；.node 在 app.asar.unpacked，运行时从 unpacked 加载。
 */
const Module = require('module');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

const MAGIC_HYBRID = Buffer.from('CXHYB', 'utf8');
const RSA_ENCRYPTED_KEY_LEN = 256;
const IV_LEN = 16;

function isEncrypted(buf) {
  return Buffer.isBuffer(buf) &&
    buf.length >= 5 + RSA_ENCRYPTED_KEY_LEN + IV_LEN + 16 &&
    buf.slice(0, 5).equals(MAGIC_HYBRID);
}

function decryptHybrid(content) {
  const nat = loadDecryptNative();
  if (!nat || typeof nat.getRsaPrivateKey !== 'function' || typeof nat.decryptAes !== 'function') {
    throw new Error('native_decrypt 未提供 getRsaPrivateKey/decryptAes');
  }
  const privatePem = nat.getRsaPrivateKey();
  const rsaEncryptedKey = content.slice(5, 5 + RSA_ENCRYPTED_KEY_LEN);
  const iv = content.slice(5 + RSA_ENCRYPTED_KEY_LEN, 5 + RSA_ENCRYPTED_KEY_LEN + IV_LEN);
  const ciphertext = content.slice(5 + RSA_ENCRYPTED_KEY_LEN + IV_LEN);

  const aesKey = crypto.privateDecrypt(
    { key: privatePem, padding: crypto.constants.RSA_PKCS1_PADDING },
    rsaEncryptedKey
  );
  if (aesKey.length !== 32) {
    throw new Error('RSA 解密得到的 AES 密钥长度应为 32');
  }
  return nat.decryptAes(aesKey, iv, ciphertext);
}

Module._extensions['.js'] = function (module, filename) {
  let content = fs.readFileSync(filename);
  if (decryptAvailable && (filename.includes('app.asar') || filename.includes('app.asar.unpacked')) && isEncrypted(content)) {
    content = decryptHybrid(content);
  } else {
    content = content.toString('utf8');
  }
  module._compile(content, filename);
};

loadDecryptNative();
require('./electron-main.js');
