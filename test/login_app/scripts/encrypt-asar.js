/**
 * 打包后对 app.asar 内所有 .js 进行 AES+RSA 混合加密。
 * 格式: "CXHYB"(5) + RSA(公钥加密的 32 字节 AES 密钥, 256 字节) + IV(16) + AES-256-CBC 密文(PKCS7)。
 * 公钥来自 scripts/rsa_public.pem；私钥仅在 native_decrypt/key.h，运行时由原生模块配合 Node 解密。
 */
const asar = require('@electron/asar');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

const MAGIC = Buffer.from('CXHYB', 'utf8');
const IV_LEN = 16;
const AES_KEY_LEN = 32;
const RSA_ENCRYPTED_KEY_LEN = 256; // 2048-bit RSA

function getPublicKey() {
  const pemPath = path.join(__dirname, 'rsa_public.pem');
  if (!fs.existsSync(pemPath)) {
    console.error('encrypt-asar: 未找到 rsa_public.pem，请先执行 npm run generate-key');
    process.exit(1);
  }
  return fs.readFileSync(pemPath, 'utf8');
}

/**
 * 单文件混合加密：随机 AES 密钥 + IV，AES 加密内容，RSA 加密 AES 密钥，拼成 CXHYB + rsa_key + iv + ciphertext
 */
function encryptBuffer(publicKeyPem, plain) {
  const aesKey = crypto.randomBytes(AES_KEY_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  const padded = Buffer.concat([
    cipher.update(plain),
    cipher.final()
  ]);
  const rsaEncryptedKey = crypto.publicEncrypt(
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
    aesKey
  );
  if (rsaEncryptedKey.length !== RSA_ENCRYPTED_KEY_LEN) {
    console.error('encrypt-asar: RSA 加密后长度应为 256，实际', rsaEncryptedKey.length);
    process.exit(1);
  }
  return Buffer.concat([MAGIC, rsaEncryptedKey, iv, padded]);
}

function encryptDir(dir, publicKeyPem, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      encryptDir(full, publicKeyPem, baseDir);
    } else if (e.isFile() && e.name.endsWith('.js')) {
      const skipNames = ['bootstrap.js', 'preload.js', 'renderer.js'];
      if (skipNames.includes(e.name)) continue;
      const content = fs.readFileSync(full);
      if (content.length > 0 && !content.slice(0, 5).equals(MAGIC)) {
        const encrypted = encryptBuffer(publicKeyPem, content);
        fs.writeFileSync(full, encrypted);
      }
    }
  }
}

async function run() {
  const appOutDir = process.env.ElectronBuilderAppOutDir || path.join(__dirname, '..', 'dist-1.0.12', 'win-unpacked');
  const asarPath = path.join(appOutDir, 'resources', 'app.asar');
  if (!fs.existsSync(asarPath)) {
    console.error('encrypt-asar: app.asar not found at', asarPath);
    process.exit(1);
  }
  const publicKeyPem = getPublicKey();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asar-encrypt-'));
  try {
    asar.extractAll(asarPath, tmpDir);
    if (!fs.existsSync(path.join(tmpDir, 'bootstrap.js'))) {
      console.error('encrypt-asar: bootstrap.js missing after extract');
      process.exit(1);
    }
    encryptDir(tmpDir, publicKeyPem);
    fs.unlinkSync(asarPath);
    await asar.createPackage(tmpDir, asarPath);
    const list = asar.listPackage(asarPath, {});
    const hasBootstrap = list.some(f => f.replace(/[/\\]/g, '/').endsWith('bootstrap.js'));
    if (!hasBootstrap) {
      console.error('encrypt-asar: bootstrap.js missing in repacked asar:', list.slice(0, 15));
      process.exit(1);
    }
    console.log('encrypt-asar: encrypted app.asar (AES+RSA hybrid) at', asarPath);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch (_) {}
  }
}

run().catch((err) => {
  console.error('encrypt-asar:', err);
  process.exit(1);
});
