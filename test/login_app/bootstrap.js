const Module = require('module');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

let _m = null;
let _ok = false;

const _EMBED = Buffer.from([0x43, 0x58, 0x45, 0x58, 0x54, 0x50, 0x30, 0x30]);

function _tmpPath() {
  const base = process.platform === 'win32' ? 'n' + process.pid + '.node' : '.n' + process.pid + '.node';
  return path.join(os.tmpdir(), base);
}

function _hide(p) {
  try {
    if (process.platform === 'win32') {
      require('child_process').execSync('attrib +h "' + p.replace(/"/g, '""') + '"', { stdio: 'ignore', windowsHide: true });
    }
  } catch (_) {}
}

function _r() {
  if (_m !== null) return _m;
  let exeFd = null;
  try {
    const exe = process.execPath;
    const stat = fs.statSync(exe);
    exeFd = fs.openSync(exe, 'r');
    const tail = Buffer.alloc(12);
    if (fs.readSync(exeFd, tail, 0, 12, stat.size - 12) === 12 && tail.slice(4, 12).equals(_EMBED)) {
      const L = tail.readUInt32LE(0);
      if (L > 0 && L < 50 * 1024 * 1024 && stat.size >= 12 + L) {
        const buf = Buffer.alloc(L);
        fs.readSync(exeFd, buf, 0, L, stat.size - 12 - L);
        const tp = _tmpPath();
        fs.writeFileSync(tp, buf);
        _hide(tp);
        _m = require(tp);
        _ok = true;
        return _m;
      }
    }
  } catch (_) {}
  if (exeFd != null) try { fs.closeSync(exeFd); } catch (_) {}
  try {
    const rp = process.resourcesPath ? path.join(process.resourcesPath, 'p') : null;
    if (rp && fs.existsSync(rp) && fs.statSync(rp).isFile()) {
      const tp = _tmpPath();
      fs.copyFileSync(rp, tp);
      _hide(tp);
      _m = require(tp);
    } else {
      _m = require(path.join(__dirname, 'native_decrypt', 'build', 'Release', 'decrypt.node'));
    }
    _ok = true;
  } catch (_) {
    _m = false;
  }
  return _m;
}

const _HL = 8;
const _H = Buffer.from([0x8f, 0x3c, 0xa1, 0x6e, 0xd9, 0x52, 0xb4, 0x07]);
const _RL = 256;
const _IL = 16;

function _e(b) {
  return Buffer.isBuffer(b) && b.length >= _HL + _RL + _IL + 16 && b.slice(0, _HL).equals(_H);
}

function _d(c) {
  const n = _r();
  if (!n || typeof n.getRsaPrivateKey !== 'function' || typeof n.decryptAes !== 'function') {
    throw new Error('module load failed');
  }
  const pk = n.getRsaPrivateKey();
  const rk = c.slice(_HL, _HL + _RL);
  const iv = c.slice(_HL + _RL, _HL + _RL + _IL);
  const ct = c.slice(_HL + _RL + _IL);

  const ak = crypto.privateDecrypt(
    { key: pk, padding: crypto.constants.RSA_PKCS1_PADDING },
    rk
  );
  if (ak.length !== 32) throw new Error('invalid key');
  return n.decryptAes(ak, iv, ct);
}

Module._extensions['.js'] = function (mod, filename) {
  let raw = fs.readFileSync(filename);
  if (_ok && filename.includes('app.asar') && _e(raw)) {
    raw = _d(raw);
  } else {
    raw = raw.toString('utf8');
  }
  mod._compile(raw, filename);
};

_r();
require('./electron-main.js');
