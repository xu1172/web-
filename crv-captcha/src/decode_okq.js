/**
 * 解码 lLmnu.okq() 字符串数组
 * 从 final.js 第1-57行提取，使用 'TwIa[q' 作为 XOR 密钥
 */
const fs = require('fs');
const path = require('path');

// 读取 final.js 第17行（包含 uyM = decodeURI(...)）
const finalJs = fs.readFileSync(path.join(__dirname, '../assets/deob-captcha/final.js'), 'utf8');
const lines = finalJs.split('\n');
const line17 = lines[16]; // 第17行，0-indexed

// 提取 decodeURI('...') 的括号内容
// 由于字符串内含单引号 \', 需要找到 decodeURI(' 开头和最后的 ') 结尾
const startMarker = "decodeURI('";
const startIdx = line17.indexOf(startMarker);
if (startIdx === -1) {
  console.error('未找到 decodeURI...');
  process.exit(1);
}
const endIdx = line17.lastIndexOf("');");
if (endIdx === -1) {
  console.error('未找到结尾');
  process.exit(1);
}
const rawEncoded = line17.substring(startIdx + startMarker.length, endIdx);
// decodeURI (不是 decodeURIComponent) - 模拟原始代码
const encoded = decodeURI(rawEncoded);

const key = 'TwIa[q';
let vKs = '';
let tMs = 0, wUN = 0;
while (tMs < encoded.length) {
  vKs += String.fromCharCode(encoded.charCodeAt(tMs) ^ key.charCodeAt(wUN));
  tMs++;
  wUN++;
  if (wUN === key.length) wUN = 0;
}

const arr = vKs.split('^');
console.log('总字符串数量:', arr.length);

console.log('arr.length:', arr.length);

// 打印关键 index
const keyIndices = [10, 11, 12, 70, 82, 88, 176, 329, 344, 345, 405, 411, 434, 452, 459, 463, 489, 502, 504, 512, 520, 525, 528, 538, 544, 552, 555, 557, 558, 559, 560, 564, 580, 588, 591];
keyIndices.forEach(i => {
  console.log(`okq(${i}) = ${JSON.stringify(arr[i])}`);
});

// 打印所有非空且短的字符串
console.log('\n--- 所有 index 的值 ---');
for (let i = 0; i < arr.length; i++) {
  if (arr[i] !== undefined && arr[i].length <= 30) {
    console.log(`${i}: ${JSON.stringify(arr[i])}`);
  }
}

// 保存完整数组到文件供检查
fs.writeFileSync(path.join(__dirname, '../assets/okq_strings.json'), JSON.stringify(arr, null, 2));
console.log('\n完整数组已保存到 assets/okq_strings.json');
