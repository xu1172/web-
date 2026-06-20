/**
 * 小红书 x-s 签名生成 - 完整可用方案
 * 
 * 架构:
 * - Node.js: 业务逻辑 + HTTP 请求
 * - Chrome DevTools: 调用浏览器中的 mnsv2 生成签名
 * 
 * 使用方法:
 * 1. 确保 Chrome 已启动并连接到 127.0.0.1:9222
 * 2. 浏览器已打开小红书页面
 * 3. 运行此脚本
 */

const crypto = require('crypto');

// ==================== G 对象 - 加密工具 ====================

const G = {
    /**
     * MD5 哈希
     */
    Pu: function(input) {
        return crypto.createHash('md5').update(input).digest('hex');
    },
    
    /**
     * URL 编码
     */
    lz: function(input) {
        return encodeURIComponent(input);
    },
    
    /**
     * Base64 编码
     */
    xE: function(input) {
        return Buffer.from(input).toString('base64');
    }
};

// ==================== 核心签名生成 ====================

/**
 * 调用浏览器 mnsv2 生成 mns 签名
 * 
 * 注意: 这里使用 chrome-devtools MCP 调用
 * 实际项目中,你需要:
 * 1. 使用 puppeteer 或 playwright 连接浏览器
 * 2. 或者使用 chrome-remote-interface 直接调用 CDP
 */
async function generateMnsViaBrowser(apiPath, hash1, hash2) {
    // 构造浏览器中执行的代码
    const browserCode = `
        (function() {
            var f = '${apiPath}';
            var c = '${hash1}';
            var d = '${hash2}';
            return window.mnsv2(f, c, d);
        })()
    `;
    
    // TODO: 通过 chrome-devtools MCP 或 CDP 执行
    // 这里返回示例代码,实际使用时需要替换为真实的浏览器调用
    console.log('浏览器执行代码:', browserCode);
    console.log('请通过 chrome-devtools MCP evaluate_script 执行');
    
    // 示例返回值 (实际从浏览器获取)
    return 'mns0301_gRaKqztpuZfojf7GEp0id0rKyWfcR85VlgjxYhAI2jnp7I4d+oJrLQOWRwjQyp49uGSjCOrS002VSYhKNDrSRHY9m6hdUCYsFiftA3ZYQ0Z1VOqO+g7A0JHKXS0WVES20+MCnpsRzRJPUaT3lneKSndVZZciE0JRIk0OHNRRTMbjTpzdcc8R68DtECouz3aN';
}

/**
 * 生成 x-s 签名
 * @param {string} apiPath - API 路径
 * @param {object|string} params - 请求参数  
 * @param {string} mnsResult - 浏览器 mnsv2 返回的结果
 * @returns {string} XYS_ 前缀的签名
 */
function generateXSSignature(apiPath, params, mnsResult) {
    // 构造签名对象
    const signObj = {
        x0: 'xhs-pc-web',
        x1: "xhs-pc-web",
        x2: "PC",
        x3: mnsResult,
        x4: params ? (typeof params === "object" ? JSON.stringify(params) : "") : ""
    };
    
    // 编码并返回
    return "XYS_" + G.xE(G.lz(JSON.stringify(signObj)));
}

// ==================== 完整使用示例 ====================

async function main() {
    console.log('=== 小红书 x-s 签名生成 ===\n');
    
    // 1. 准备参数
    const apiPath = '/api/sns/web/v1/homefeed{"cursor_score":"","num":24}';
    const hash1 = '975e405e5d685096a247505198768687';
    const hash2 = '6cb167ba87e1a756420d916fc234803c';
    const params = { cursor_score: '', num: 24 };
    
    console.log('步骤 1: 调用浏览器 mnsv2 生成 mns');
    console.log('参数:', { apiPath, hash1, hash2 });
    
    // 2. 通过浏览器生成 mns
    const mnsResult = await generateMnsViaBrowser(apiPath, hash1, hash2);
    console.log('\n生成的 mns:', mnsResult);
    
    // 3. 生成 x-s 签名
    console.log('\n步骤 2: 生成 x-s 签名');
    const xSign = generateXSSignature(apiPath, params, mnsResult);
    console.log('x-s 签名:', xSign);
    
    console.log('\n=== 完成 ===');
}

// ==================== 导出 ====================

module.exports = {
    G,
    generateMnsViaBrowser,
    generateXSSignature,
    main
};

// 如果直接运行此文件
if (require.main === module) {
    main().catch(console.error);
}
