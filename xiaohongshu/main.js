/**
 * 小红书 x-s 签名生成 - 浏览器导出版本
 * 策略: 从浏览器导出已初始化的加密函数,本地补环境调用
 */

const fs = require('fs');

// 完整的补环境代码(从 env.js 导入)
require('./env.js');

console.log('\n=== 测试 mnsv2 函数 ===\n');

// 测试 mnsv2
if (window.mnsv2) {
    console.log('[调用] mnsv2("test", "hash1", "hash2")');
    const result = window.mnsv2('test', 'hash1', 'hash2');
    console.log('[返回]', result);
    console.log('[类型]', typeof result);
} else {
    console.log('❌ mnsv2 未找到');
}

// 查找 seccore_signv2
console.log('\n=== 查找 seccore_signv2 ===\n');

// 根据你提供的代码,seccore_signv2 应该使用了:
// - window.toString
// - window.mnsv2
// - G.Pu (可能是某种哈希函数)
// - G.xE, G.lz (编码函数)
// - E.i8, E.mj (常量)
// - Z._ (类型判断)

// 查找 G 和 E 对象
const possibleG = [];
const possibleE = [];
const possibleZ = [];

Object.keys(window).forEach(key => {
    try {
        const value = window[key];
        if (!value || typeof value !== 'object') return;
        
        // 查找 G (包含 Pu, xE, lz)
        if (value.Pu && value.xE && value.lz) {
            possibleG.push(key);
        }
        
        // 查找 E (包含 i8, mj)
        if (value.i8 && value.mj) {
            possibleE.push(key);
        }
        
        // 查找 Z (包含 _)
        if (value._ && typeof value._ === 'function') {
            possibleZ.push(key);
        }
    } catch (e) {}
});

console.log('可能的 G 对象:', possibleG);
console.log('可能的 E 对象:', possibleE);
console.log('可能的 Z 对象:', possibleZ);

// 如果找到了所有依赖,尝试构造 seccore_signv2
if (possibleG.length > 0 && possibleE.length > 0 && possibleZ.length > 0) {
    const G = window[possibleG[0]];
    const E = window[possibleE[0]];
    const Z = window[possibleZ[0]];
    
    console.log('\n✅ 找到所有依赖,构造 seccore_signv2');
    
    // 实现 seccore_signv2
    window.seccore_signv2 = function(e, a) {
        var c = window.toString;
        var l = e;
        
        // 参数处理: 如果 a 是对象或数组,转 JSON;如果是字符串,直接拼接
        if (c.call(a) === "[object Object]" || c.call(a) === "[object Array]") {
            l += JSON.stringify(a);
        } else if (typeof a === "string") {
            l += a;
        }
        
        // 计算哈希
        var hash1 = G.Pu([l].join(""));
        var hash2 = G.Pu(e);
        
        // 调用 mnsv2
        var mns = window.mnsv2(l, hash1, hash2);
        
        // 构造签名对象
        var R = {
            x0: E.i8,
            x1: "xhs-pc-web",
            x2: window[E.mj] || "PC",
            x3: mns,
            x4: a ? (typeof a === "object" ? JSON.stringify(a) : "") : ""
        };
        
        // 最终编码: XYS_ + Base64
        var encoded = G.lz(JSON.stringify(R));
        var finalSign = G.xE(encoded);
        
        return "XYS_" + finalSign;
    };
    
    console.log('\n=== 测试 seccore_signv2 ===\n');
    
    // 测试调用
    const testParams = {
        offset: 0,
        channel_id: 'homefeed.fashion_v3'
    };
    
    try {
        const xs = window.seccore_signv2('/api/sns/web/v1/homefeed', testParams);
        console.log('生成的 x-s:', xs);
        console.log('长度:', xs.length);
        console.log('前缀:', xs.substring(0, 10));
    } catch (e) {
        console.error('调用失败:', e.message);
        console.error('堆栈:', e.stack);
    }
} else {
    console.log('\n❌ 未找到完整的依赖,需要进一步分析');
}

// 导出模块
module.exports = {
    window: window,
    mnsv2: window.mnsv2,
    seccore_signv2: window.seccore_signv2,
    generateXS: function(apiPath, params) {
        if (!window.seccore_signv2) {
            throw new Error('seccore_signv2 未初始化');
        }
        return window.seccore_signv2(apiPath, params);
    }
};
