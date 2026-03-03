/**
 * 打包后对 app.asar 内所有 .js 进行 AES-256-CBC 加密。
 * 格式: "CXENC"(5) + IV(16) + ciphertext(PKCS7)。
 * 密钥需与 native_decrypt/key.h 中一致；可通过环境变量 ASAR_ENCRYPT_KEY(64 位 hex) 覆盖。
 */
const asar = require('@electron/asar');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

const MAGIC = Buffer.from('CXENC', 'utf8');
const IV_LEN = 16;
const KEY_LEN = 32;

// 仅当未使用 asar-key.hex 或 ASAR_ENCRYPT_KEY 时使用的兜底密钥（建议运行 npm run generate-key 生成强密钥）
const DEFAULT_KEY = Buffer.from([
  0x43, 0x78, 0x45, 0x78, 0x61, 0x6d, 0x41, 0x53,
  0x41, 0x52, 0x4b, 0x65, 0x79, 0x32, 0x30, 0x32,
  0x35, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

function getKey() {
  const envKey = process.env.ASAR_ENCRYPT_KEY;
  if (envKey && envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    return Buffer.from(envKey, 'hex');
  }
  const keyPath = path.join(__dirname, 'asar-key.hex');
  if (fs.existsSync(keyPath)) {
    const hex = fs.readFileSync(keyPath, 'utf8').trim();
    if (hex.length === 64 && /^[0-9a-fA-F]+$/.test(hex)) {
      return Buffer.from(hex, 'hex');
    }
  }
  return DEFAULT_KEY;
}

function encryptBuffer(key, plain) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const padded = Buffer.concat([
    cipher.update(plain),
    cipher.final()
  ]);
  return Buffer.concat([MAGIC, iv, padded]);
}

function encryptDir(dir, key, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const rel = path.relative(baseDir, full);
    if (e.isDirectory()) {
      encryptDir(full, key, baseDir);
    } else if (e.isFile() && e.name.endsWith('.js')) {
      const content = fs.readFileSync(full);
      if (content.length > 0 && !content.slice(0, 5).equals(MAGIC)) {
        const encrypted = encryptBuffer(key, content);
        fs.writeFileSync(full, encrypted);
      }
    }
  }
}

function run() {
  const appOutDir = process.env.ElectronBuilderAppOutDir || path.join(__dirname, '..', 'dist-1.0.12', 'win-unpacked');
  const asarPath = path.join(appOutDir, 'resources', 'app.asar');
  if (!fs.existsSync(asarPath)) {
    console.error('encrypt-asar: app.asar not found at', asarPath);
    process.exit(1);
  }
  const key = getKey();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asar-encrypt-'));
  try {
    asar.extractAll(asarPath, tmpDir);
    encryptDir(tmpDir, key);
    fs.unlinkSync(asarPath);
    asar.createPackage(tmpDir, asarPath);
    console.log('encrypt-asar: encrypted app.asar at', asarPath);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch (_) {}
  }
}

run();
