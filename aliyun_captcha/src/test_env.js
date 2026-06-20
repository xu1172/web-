'use strict';
const fs = require('fs');
const path = require('path');
const { buildBrowserEnv, createVMContext, executeInContext } = require('../env/browser');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const NVC_OPT = { appkey: 'CF_APP_1', scene: 'nvc_register', token: Date.now() + ':' + Math.random(), renderTo: '#captcha', trans: { key1: 'code0', nvcCode: 200 }, capCode: 200, customWidth: 300 };
const NVC_PRE_RES = { a: '1.1.156', b: '1.1.156', c: 'amYofgSTn5gFh7f_OSn9ZHks5vlARgmnVroasViNXQSOu02fmTbbQ8TJwo5S8wQyxFTeobcgqh4RB6SlJnz3dfhP9_15dpnrtSqJnvya92AqwVDaHNZgpMg_4xpYvsTMEAm48ZHXJRNfarQNwp4bK6tVZKjpJphOSFwjxv8mDWVpj-R60jwupuq2sUfOi9-5' };
async function main() {
    console.log('='.repeat(60));
    console.log('阿里云智能验证码 - 补环境测试 v4');
    console.log('='.repeat(60));
    const browserEnv = buildBrowserEnv();
    const ctx = createVMContext(browserEnv);
    ctx.NVC_Opt = Object.assign({}, NVC_OPT);
    ctx.NVC_Data = { a: NVC_OPT.appkey, c: NVC_OPT.token, d: NVC_OPT.scene, h: NVC_OPT.trans, j: { test: 1 } };
    ctx.NVC_Result = { nvcPreRes: NVC_PRE_RES };
    ctx.UA_Opt = { appkey: NVC_OPT.appkey, token: NVC_OPT.token, scene: NVC_OPT.scene };
    console.log('Token:', NVC_OPT.token);
    const awscCode = fs.readFileSync(path.join(ASSETS_DIR, 'awsc.js'), 'utf-8');
    executeInContext(awscCode, ctx, 'awsc.js');
    ctx._awsc_modules = browserEnv._awsc_modules;
    
    // 劫持 AWSC.use
    executeInContext('(function(){var origUse=AWSC.use;AWSC.use=function(name,cb){if(_awsc_modules&&_awsc_modules[name]){setTimeout(function(){cb("loaded",_awsc_modules[name])},10);return}return origUse.call(AWSC,name,cb)}})()', ctx, 'patch_awsc.js');
    
    // 加载 NVC - 但在此之前，直接设置环境变量来绕过 loadScript
    // 因为 nvc.js 中的 i.loadScript(c.url.awsc) 会创建一个永不 resolve 的 promise
    // 我们手动触发初始化
    const nvcCode = fs.readFileSync(path.join(ASSETS_DIR, 'nvc.js'), 'utf-8');
    executeInContext(nvcCode, ctx, 'nvc.js');
    console.log('NVC 加载成功');
    
    // 手动触发 UMID 和 UAB 初始化（模拟 i.loadScript 的 then 回调）
    executeInContext('(function(){__nvc__umid="defaultToken1_um_not_loaded@@\"+location.href+\"@@\"+(new Date).getTime();if(typeof AWSC!=="undefined"&&AWSC.use){AWSC.use("um",function(t,e){"loaded"===t&&(e.init({timeout:3e3,timestamp:(new Date).getTime(),serviceUrl:"https://ynuf.aliapp.org/service/um.json",appName:NVC_Opt.appkey,enableFY:1,jf:1},function(t,e){try{__nvc__umid="success"===t?e.tn:"defaultToken4_init_failed"}catch(e){__nvc__umid="error:"+e.message}}))});AWSC.use("uab",function(t,e){"loaded"===t&&(__nvc__uab=e)})}})()', ctx, 'init_nvc.js');
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 检查状态
    const state = executeInContext('JSON.stringify({umid:__nvc__umid,uab:typeof __nvc__uab!=="undefined"?"loaded":"not loaded"})', ctx, 'state.js');
    console.log('State:', state);
    
    const nvcVal = executeInContext('typeof getNVCVal==="function"?getNVCVal():"getNVCVal not available"', ctx, 'getNVCVal.js');
    console.log('\nNVC Token (first 200 chars):');
    console.log(nvcVal.substring(0, 200) + '...');
    
    const decoded = executeInContext('typeof getNVCVal==="function"?JSON.parse(decodeURIComponent(getNVCVal())):"{}"', ctx, 'decode.js');
    console.log('\nDecoded fields:');
    console.log('  a (appkey):', decoded.a);
    console.log('  b (uab):', decoded.b ? decoded.b.substring(0, 50) + '...' : 'EMPTY');
    console.log('  c (token):', decoded.c);
    console.log('  d (scene):', decoded.d);
    console.log('  e (preRes.c):', decoded.e ? decoded.e.substring(0, 30) + '...' : 'none');
    console.log('  f (sessionId):', decoded.f || 'none');
    console.log('  g (sig):', decoded.g || 'none');
    console.log('  h.umidToken:', decoded.h ? decoded.h.umidToken : 'none');
}
main().catch(e => { console.error('Error:', e.message); console.error(e.stack); });
