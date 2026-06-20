/**
 * 在 Node.js 中直接执行 lLmnu 的初始化代码
 * 从 final.js 提取 lLmnu.mqZ 部分并运行它，然后调用 okq
 */

// 模拟浏览器全局环境
const window = global;
window.lLmnu = {};

// 直接从 final.js 读取并执行 lLmnu 初始化代码（前135行）
const fs = require('fs');
const path = require('path');
const finalJs = fs.readFileSync(path.join(__dirname, '../assets/deob-captcha/final.js'), 'utf8');

// 提取前135行（lLmnu 初始化部分）和 okq/pvH 注册部分（前141行）
const lines = finalJs.split('\n');
const initCode = lines.slice(0, 141).join('\n');

// 构建可执行代码
const evalCode = `
// lLmnu 对象（从 final.js 导入）
const lLmnu = {};
${initCode}

// 注册 okq 和 pvH
lLmnu.okq = function () {
  return typeof lLmnu.mqZ.qbL === 'function' ? lLmnu.mqZ.qbL.apply(lLmnu.mqZ, arguments) : lLmnu.mqZ.qbL;
};
lLmnu.pvH = function () {
  return typeof lLmnu.nFy.BDX === 'function' ? lLmnu.nFy.BDX.apply(lLmnu.nFy, arguments) : lLmnu.nFy.BDX;
};

// 测试关键索引
const indices = [70, 82, 88, 176, 329, 344, 345, 405, 411, 434, 452, 459, 463, 489, 502, 504, 512, 520, 525, 528, 538, 544, 552, 555, 557, 558, 559, 560, 564, 580, 588, 591];
const results = {};
indices.forEach(i => {
  try {
    results[i] = lLmnu.okq(i);
  } catch(e) {
    results[i] = 'ERR: ' + e.message;
  }
});
console.log(JSON.stringify(results, null, 2));
`;

try {
  eval(evalCode);
} catch(e) {
  console.error('执行失败:', e.message);
  console.error(e.stack);
}
