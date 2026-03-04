/**
 * 打包后对 app.asar 内所有 .js 进行 AES+RSA 混合加密；自定义 asar 内容。
 * - 格式: 魔数(8) + RSA(公钥加密的 32 字节 AES 密钥, 256 字节) + IV(16) + AES-256-CBC 密文(PKCS7)。
 * - 公钥来自 scripts/rsa_public.pem；私钥仅在 native_decrypt/key.h，运行时由原生模块配合 Node 解密。
 * - 诱饵：数量与大小均虚假。仅 1 个 1MB 真实文件；头里伪造 50000 个 1GB 条目，官方 asar 解包看到 50000 个 1GB 文件。
 */
const asar = require('@electron/asar');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

const DECOY_FAKE_COUNT = 50000;             // 头里伪造的条目数
const DECOY_REAL_SIZE = 1 * 1024 * 1024;   // 唯一真实诱饵文件大小 1MB
const DECOY_FAKE_SIZE = 1024 * 1024 * 1024; // 头里每个条目标为 1GB
const DECOY_NAME_LEN = 32;                  // 随机名长度（字母+数字）
const ALPHANUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomAlphanumeric(len) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHANUM[crypto.randomInt(0, ALPHANUM.length)];
  return s;
}

const MAGIC_LEN = 8;
const MAGIC = Buffer.from([0x8f, 0x3c, 0xa1, 0x6e, 0xd9, 0x52, 0xb4, 0x07]);
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
 * 单文件混合加密：魔数 + RSA 加密的 AES 密钥 + IV + AES 密文
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
      if (content.length > 0 && !content.slice(0, MAGIC_LEN).equals(MAGIC)) {
        const encrypted = encryptBuffer(publicKeyPem, content);
        fs.writeFileSync(full, encrypted);
      }
    }
  }
}

/**
 * 在 app 根目录下直接创建 1 个真实诱饵文件，随机字母数字命名，无子目录。
 */
function addDecoyFiles(tmpDir) {
  const name = randomAlphanumeric(DECOY_NAME_LEN);
  const buf = Buffer.alloc(DECOY_REAL_SIZE);
  fs.writeFileSync(path.join(tmpDir, name), buf);
  console.log(`encrypt-asar: 根目录 1 个诱饵 ${name} (1MB)，头中将伪造 ${DECOY_FAKE_COUNT} 个 1GB 条目（随机命名）`);
}

/**
 * 在 app 根目录头中：用唯一 1MB 文件的 offset，伪造 DECOY_FAKE_COUNT 个 1GB 条目，文件名均为随机字母数字。
 */
function patchDecoySizesInAsarHeader(asarPath) {
  const fd = fs.openSync(asarPath, 'r');
  const sizeBuf = Buffer.alloc(8);
  if (fs.readSync(fd, sizeBuf, 0, 8, null) !== 8) {
    fs.closeSync(fd);
    throw new Error('patchDecoy: 无法读取 asar 头长度');
  }
  const headerLength = sizeBuf.readUInt32LE(4);
  const headerBuf = Buffer.alloc(headerLength);
  if (fs.readSync(fd, headerBuf, 0, headerLength, 8) !== headerLength) {
    fs.closeSync(fd);
    throw new Error('patchDecoy: 无法读取 asar 头');
  }
  const dataOffset = 8 + headerLength;
  const jsonLen = headerBuf.readInt32LE(4);
  const header = JSON.parse(headerBuf.slice(8, 8 + jsonLen).toString('utf8'));

  const root = header.files || {};
  const decoyKey = Object.keys(root).find(
    (k) => root[k] && !root[k].files && typeof root[k].offset !== 'undefined' && root[k].size === DECOY_REAL_SIZE
  );
  if (!decoyKey) {
    fs.closeSync(fd);
    throw new Error('patchDecoy: 未找到根目录下 1MB 诱饵条目');
  }
  const baseOffset = root[decoyKey].offset;
  const decoyFirst = {};
  for (let i = 0; i < DECOY_FAKE_COUNT; i++) {
    decoyFirst[randomAlphanumeric(DECOY_NAME_LEN)] = {
      size: DECOY_FAKE_SIZE,
      offset: baseOffset,
    };
  }
  const rest = {};
  for (const k of Object.keys(root)) {
    if (k !== decoyKey) rest[k] = root[k];
  }
  header.files = { ...decoyFirst, ...rest };

  const newJson = JSON.stringify(header);
  const newJsonBuf = Buffer.from(newJson, 'utf8');
  const align4 = (n) => (n + 3) & ~3;
  const payloadSize = 4 + align4(newJsonBuf.length);
  const newHeaderBuf = Buffer.alloc(4 + payloadSize);
  newHeaderBuf.writeUInt32LE(payloadSize, 0);
  newHeaderBuf.writeInt32LE(newJsonBuf.length, 4);
  newJsonBuf.copy(newHeaderBuf, 8);

  const newSizeBuf = Buffer.alloc(8);
  newSizeBuf.writeUInt32LE(4, 0);
  newSizeBuf.writeUInt32LE(newHeaderBuf.length, 4);

  const tmpPath = asarPath + '.patch.tmp';
  const outFd = fs.openSync(tmpPath, 'w');
  fs.writeSync(outFd, newSizeBuf, 0, 8, null);
  fs.writeSync(outFd, newHeaderBuf, 0, newHeaderBuf.length, null);
  const chunk = Buffer.alloc(64 * 1024 * 1024);
  let offset = dataOffset;
  for (;;) {
    const n = fs.readSync(fd, chunk, 0, chunk.length, offset);
    if (n <= 0) break;
    fs.writeSync(outFd, chunk, 0, n, null);
    offset += n;
  }
  fs.closeSync(fd);
  fs.closeSync(outFd);
  fs.unlinkSync(asarPath);
  fs.renameSync(tmpPath, asarPath);
  console.log(`encrypt-asar: 已篡改 asar 头，伪造 ${DECOY_FAKE_COUNT} 个 1GB 条目（唯一真实数据为 1 个 1MB 文件）`);
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
    addDecoyFiles(tmpDir);
    fs.unlinkSync(asarPath);
    await asar.createPackage(tmpDir, asarPath);
    patchDecoySizesInAsarHeader(asarPath);
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
