'use strict';
const fs = require('fs');
const path = require('path');
const { buildBrowserEnv, createVMContext, executeInContext } = require('../env/browser');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const nvcPreResC = process.argv[2];
const token = process.argv[3];
const appkey = process.argv[4] || 'CF_APP_1';
const scene = process.argv[5] || 'nvc_register';
const transKey1 = process.argv[6] || 'code0';
const capCode = parseInt(process.argv[7]) || 200;
if (!nvcPreResC || !token) { console.error('Usage: node generate_token.js <nvcPreRes_c> <token> [appkey] [scene] [trans_key1] [nvcCode]'); process.exit(1); }
async function main() {
    const NVC_OPT = { appkey, scene, token, renderTo: '#captcha', trans: { key1: transKey1, nvcCode: capCode }, capCode, customWidth: 300 };
    const NVC_PRE_RES = { a: '1.1.156', b: '1.1.156', c: nvcPreResC };
    const browserEnv = buildBrowserEnv();
    const ctx = createVMContext(browserEnv);
    ctx.NVC_Opt = Object.assign({}, NVC_OPT);
    ctx.NVC_Data = { a: NVC_OPT.appkey, c: NVC_OPT.token, d: NVC_OPT.scene, h: NVC_OPT.trans, j: { test: 1 } };
    ctx.NVC_Result = { nvcPreRes: NVC_PRE_RES };
    ctx.UA_Opt = { appkey: NVC_OPT.appkey, token: NVC_OPT.token, scene: NVC_OPT.scene };
    const awscCode = fs.readFileSync(path.join(ASSETS_DIR, 'awsc.js'), 'utf-8');
    executeInContext(awscCode, ctx, 'awsc.js');
    ctx._awsc_modules = browserEnv._awsc_modules;
    executeInContext('(function(){var u=AWSC.use;AWSC.use=function(n,cb){if(_awsc_modules&&_awsc_modules[n]){setTimeout(function(){cb(\"loaded\",_awsc_modules[n])},10);return}return u.call(AWSC,n,cb)}})()', ctx, 'patch.js');
    const nvcJsCode = fs.readFileSync(path.join(ASSETS_DIR, 'nvc.js'), 'utf-8');
    executeInContext(nvcJsCode, ctx, 'nvc.js');
    executeInContext('(function(){__nvc__umid=\"defaultToken1@\"+new Date;AWSC.use(\"um\",function(t,e){\"loaded\"===t&&e.init({timeout:3e3,timestamp:Date.now(),serviceUrl:\"https://ynuf.aliapp.org/service/um.json\",appName:NVC_Opt.appkey,enableFY:1,jf:1},function(t,e){__nvc__umid=\"success\"===t?e.tn:\"fail\"})});AWSC.use(\"uab\",function(t,e){\"loaded\"===t&&(__nvc__uab=e)})})()', ctx, 'init.js');
    await new Promise(r => setTimeout(r, 200));
    const nvcVal = executeInContext('getNVCVal()', ctx, 'gen.js');
    console.log(JSON.stringify({nvc_token:nvcVal,decoded:JSON.parse(decodeURIComponent(nvcVal))}));
}
main().catch(e => { console.error(JSON.stringify({error:e.message})); process.exit(1); });
