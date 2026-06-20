/**
 * encrypt_w_helper.js - CRV 极验 w 参数生成器（Node.js 辅助脚本）
 * 被 Python 通过 subprocess 调用
 * 
 * 用法：node encrypt_w_helper.js '<collectData JSON>'
 * 输出：{"w": "...hex..."}
 * 
 * w 参数结构：AES密文hex + RSA密文hex
 * - AES-128-CBC: key=Latin1Parse(16hexChars), iv=Latin1Parse("0000000000000000")
 * - RSA-1024-PKCS1v1.5: N和E已知
 */
'use strict';

const NodeRSA = require('node-rsa');
const CryptoJS = require('crypto-js');

// RSA 公钥（已从浏览器运行时提取）
const RSA_N = 'A07FE9D66006CB5FF61B6AB0C77208BCA38A4674A96F121F9E8406C019DDD3B4C2FC0D76E54973328EA5CD08AF91AC7CD166A200708F4F5650F405A3AB1D14F9C2DD6B94D788DE87FA2249FF0826C0BB9B9A1D49D5662888AFAD8E891B2353587A89175CB4DC215764B067B8E4531414D4EFB2D7C3CFE7B1F69355968CD9B2AB';
const RSA_E = '10001';

// AES IV: okq(544)="0000000000000000", Latin1 parse → \x30*16
const AES_IV_STR = '0000000000000000';

// 随机 AES 密钥生成（模拟 c() = S4()*4）
function S4() {
  return ((1 + Math.random()) * 65536 | 0).toString(16).substr(1);
}
function generateAESKey() {
  return S4() + S4() + S4() + S4(); // 16 hex chars
}

// Latin1 parse（模拟 h.parse()）
function latin1Parse(str) {
  const words = new Array(Math.ceil(str.length / 4)).fill(0);
  for (let r = 0; r < str.length; r++) {
    words[r >>> 2] |= (str.charCodeAt(r) & 255) << (24 - (r % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, str.length);
}

// RSA 加密（PKCS1v1.5）
function rsaEncrypt(aesKeyStr) {
  const key = new NodeRSA();
  key.importKey({
    n: Buffer.from(RSA_N, 'hex'),
    e: parseInt(RSA_E, 16),
  }, 'components-public');
  key.setOptions({ encryptionScheme: 'pkcs1' });
  return key.encrypt(Buffer.from(aesKeyStr, 'utf8'), 'hex');
}

// AES-128-CBC 加密（模拟 pt.encrypt(t, i)）
function aesEncryptCaptcha(plaintext, hexKey) {
  const keyWA = latin1Parse(hexKey);
  const ivWA = latin1Parse(AES_IV_STR);
  
  const encrypted = CryptoJS.AES.encrypt(plaintext, keyWA, {
    iv: ivWA,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  
  // arrayToHex 模拟
  const words = encrypted.ciphertext.words;
  const sigBytes = encrypted.ciphertext.sigBytes;
  let hex = '';
  for (let o = 0; o < sigBytes; o++) {
    const b = (words[o >>> 2] >>> (24 - (o % 4) * 8)) & 255;
    hex += ('0' + b.toString(16)).slice(-2);
  }
  return hex;
}

// 主加密函数（模拟 captcha.js 的 encrypt 函数）
function encryptW(collectData) {
  const plaintext = JSON.stringify(collectData);
  
  let aesKey, rsaCipher;
  let attempt = 0;
  
  while (true) {
    aesKey = generateAESKey();
    try {
      rsaCipher = rsaEncrypt(aesKey);
      if (rsaCipher && rsaCipher.length === 256) break;
    } catch (e) {
      // RSA 加密偶尔失败，重试
    }
    if (++attempt > 100) throw new Error('RSA encrypt failed after 100 attempts');
  }
  
  const aesCipher = aesEncryptCaptcha(plaintext, aesKey);
  return aesCipher + rsaCipher; // AES密文hex + RSA密文hex
}

// 主程序
try {
  const mode = process.argv[2]; // 'collect' or 'slide'
  const dataStr = process.argv[3];
  if (!dataStr) {
    throw new Error('Usage: node encrypt_w_helper.js collect|slide <data JSON>');
  }
  
  const data = JSON.parse(dataStr);
  const w = encryptW(data);
  
  console.log(JSON.stringify({ w, success: true }));
  process.exit(0);
} catch (e) {
  console.error(JSON.stringify({ success: false, error: e.message }));
  process.exit(1);
}
