/**
 * hook_encrypt.js - 在 Node vm 中运行 captcha_live.js，劫持 encrypt 函数，
 * 捕获 verify1 和 verify2 的明文 s 对象
 */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// 1. 读取 captcha_live.js 源码
let captchaCode = fs.readFileSync(path.join(ASSETS_DIR, 'captcha_live_patched.js'), 'utf8');

// 2. 在源码中插入 Hook：在 encrypt 函数定义后插入替换
// encrypt 函数在 pos=116958，是全局函数 "function encrypt(t, e) {...}"
// 我们在 IIFE 外面无法访问，但可以在 vm 环境中预定义 encrypt 来拦截它

// 3. 创建 vm 上下文（完整浏览器环境）
function createEnv() {
    const doc = {
        createElement: function(tag) {
            const el = {
                tagName: tag.toUpperCase(),
                style: {},
                attributes: {},
                children: [],
                _src: '',
                _events: {},
                setAttribute: function(k, v) { this.attributes[k] = v; if (k === 'src') this._src = v; },
                getAttribute: function(k) { return this.attributes[k] || null; },
                appendChild: function(c) {
                    this.children.push(c);
                    if (this.tagName === 'SCRIPT' && c && c._events && c._events.load) {
                        setTimeout(() => c._events.load(), 5);
                    }
                    return c;
                },
                removeChild: function(c) {},
                addEventListener: function(ev, fn) { this._events[ev] = fn; },
                removeEventListener: function() {},
                dispatchEvent: function() {},
                getContext: function(t) {
                    if (t === '2d') return {
                        fillRect(){}, clearRect(){}, getImageData(){ return {data: new Uint8ClampedArray(4)}; },
                        fillText(){}, drawImage(){}, measureText(){ return {width: 100}; },
                        putImageData(){}, beginPath(){}, arc(){}, fill(){}, stroke(){},
                        save(){}, restore(){}, translate(){}, scale(){}, rotate(){}
                    };
                    return null;
                },
                toDataURL: function() { return 'data:image/png;base64,'; },
                set onload(fn) { this._events.load = fn; },
                get onload() { return this._events.load || null; },
                set onerror(fn) { this._events.error = fn; },
                get onerror() { return this._events.error || null; },
            };
            return el;
        },
        getElementsByTagName: function(t) {
            if (t === 'head') return [this.head];
            if (t === 'body') return [this.body];
            return [];
        },
        getElementById: function() { return null; },
        querySelector: function() { return null; },
        querySelectorAll: function() { return []; },
        createElementNS: function(ns, t) { return this.createElement(t); },
        createTextNode: function(text) { return { textContent: text, nodeType: 3 }; },
        head: {
            appendChild: function(el) {
                if (el && el.tagName === 'SCRIPT') {
                    setTimeout(() => { if (el._events && el._events.load) el._events.load(); }, 5);
                }
            },
            removeChild: function() {}
        },
        body: { appendChild(){}, removeChild(){}, style: {}, insertBefore(){} },
        documentElement: {
            style: {}, clientWidth: 1920, clientHeight: 1080,
            setAttribute(){}, getAttribute(){ return null; }
        },
        location: {
            href: 'https://cpcloud.crv.com.cn/web/fea-vsmp/login',
            protocol: 'https:', host: 'cpcloud.crv.com.cn',
            hostname: 'cpcloud.crv.com.cn', pathname: '/web/fea-vsmp/login',
            port: '', search: ''
        },
        referrer: 'https://cpcloud.crv.com.cn/',
        cookie: '', title: '华润万家供应商服务系统',
        addEventListener(){}, removeEventListener(){}
    };

    const env = {
        document: doc,
        navigator: {
            appName: 'Netscape',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
            platform: 'Win32', language: 'zh-CN', languages: ['zh-CN','zh','en'],
            cookieEnabled: true, onLine: true, hardwareConcurrency: 8,
            maxTouchPoints: 0, vendor: 'Google Inc.', webdriver: false,
            plugins: { length: 3, 0: {name:'Chrome PDF Plugin'}, 1: {name:'Chrome PDF Viewer'}, 2: {name:'Native Client'} },
            mimeTypes: { length: 2 }
        },
        location: {
            href: 'https://cpcloud.crv.com.cn/web/fea-vsmp/login',
            protocol: 'https:', host: 'cpcloud.crv.com.cn',
            hostname: 'cpcloud.crv.com.cn', pathname: '/web/fea-vsmp/login',
            port: '', search: ''
        },
        screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 },
        history: { pushState(){}, replaceState(){} },
        console: console,
        setTimeout, setInterval, clearTimeout, clearInterval,
        alert(){}, confirm(){ return true; }, prompt(){ return ''; },
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
        atob: (s) => Buffer.from(s, 'base64').toString('binary'),
        encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
        JSON, Math, Date, parseInt, parseFloat, isNaN, isFinite,
        RegExp, String, Number, Array, Object, Function,
        Error, TypeError, SyntaxError, RangeError, ReferenceError,
        Uint8Array, Uint8ClampedArray, Int32Array, Int8Array, Uint16Array, Int16Array,
        Float32Array, Float64Array, ArrayBuffer, DataView, Promise,
        Symbol, Map, Set, WeakMap, WeakSet,
        eval,
        performance: {
            now: () => Date.now() - 1700000000000 + Math.random() * 100,
            timing: { navigationStart: Date.now() - 5000, fetchStart: Date.now() - 4800 }
        },
        XMLHttpRequest: class MockXHR {
            constructor() { this.readyState = 0; this.status = 200; this.responseText = '{}'; this.headers = {}; this._url = ''; this._events = {}; }
            open(m, u) { this._method = m; this._url = u; }
            setRequestHeader(k, v) { this.headers[k] = v; }
            send(body) {
                setTimeout(() => {
                    this.readyState = 4; this.status = 200;
                    this.responseText = '{"status":"success","data":{}}';
                    this.response = this.responseText;
                    if (this.onreadystatechange) this.onreadystatechange();
                    if (this.onload) this.onload({ target: this });
                }, 10);
            }
            getResponseHeader(k) { return 'application/json'; }
            getAllResponseHeaders() { return 'content-type: application/json\r\n'; }
            addEventListener(ev, fn) { this._events[ev] = fn; }
            removeEventListener() {} abort() {}
        },
        fetch: undefined,
        localStorage: { _d: {}, getItem(k){ return this._d[k]||null; }, setItem(k,v){ this._d[k]=String(v); }, removeItem(k){ delete this._d[k]; }, clear(){ this._d={}; } },
        sessionStorage: { _d: {}, getItem(k){ return this._d[k]||null; }, setItem(k,v){ this._d[k]=String(v); }, removeItem(k){ delete this._d[k]; }, clear(){ this._d={}; } },
        Geetest_LANG: {
            slide: '请完成下方验证后继续操作',
            success: '验证通过', error: '验证失败', tip: '向右滑动完成验证', fail: '请控制拼图块对齐缺口'
        },
        // 关键：预先定义 __encrypt 拦截器，在 captcha.js 加载后会被覆盖，
        // 但通过修改 captcha.js 代码来 hook
        __interceptedPlaintexts: [],
        __capturedW: []
    };
    env.window = env;
    env.self = env;
    env.top = env;
    env.parent = env;
    doc.defaultView = env;
    doc.location = env.location;
    return env;
}

// 4. 在 captcha.js 中注入 Hook：替换 encrypt 函数调用
// 在 pos=201231 附近：i[lLmnu.okq(460)]=encrypt(nt[lLmnu.okq(154)](s),this);
// 替换为：
// var __pt = nt[lLmnu.okq(154)](s); window.__interceptedPlaintexts.push({plaintext: __pt, len: __pt.length}); i[lLmnu.okq(460)]=encrypt(__pt,this);

const HOOK_TARGET = 'i[lLmnu.okq(460)]=encrypt(nt[lLmnu.okq(154)](s),this);';
const HOOK_REPLACEMENT = 'var __pt=nt[lLmnu.okq(154)](s); if(window.__interceptedPlaintexts) window.__interceptedPlaintexts.push({plaintext:__pt,len:__pt.length,time:Date.now()}); i[lLmnu.okq(460)]=encrypt(__pt,this);';

if (captchaCode.indexOf(HOOK_TARGET) === -1) {
    console.error('ERROR: Hook target not found in captcha.js!');
    process.exit(1);
}
captchaCode = captchaCode.replace(HOOK_TARGET, HOOK_REPLACEMENT);
console.log('[hook_encrypt.js] Hook injected successfully');

// 也 hook gct 函数注册
const GCT_REGISTER = 'window[lLmnu.okq(881)]=function';
if (captchaCode.indexOf(GCT_REGISTER) !== -1) {
    console.log('[hook_encrypt.js] gct register found');
}

// 5. 加载 gct.js
let gctCode = '';
try {
    // 优先用在线版本
    const gctPath = path.join(ASSETS_DIR, 'gct.js');
    if (fs.existsSync(gctPath)) {
        gctCode = fs.readFileSync(gctPath, 'utf8');
        console.log('[hook_encrypt.js] gct.js loaded from assets');
    }
} catch(e) {}

// 6. 创建 vm 上下文并执行
const env = createEnv();
const ctx = vm.createContext(env);

try {
    if (gctCode) {
        vm.runInContext(gctCode, ctx, { timeout: 5000, filename: 'gct.js' });
        console.log('[hook_encrypt.js] gct.js executed');
    }
} catch(e) {
    console.log('[hook_encrypt.js] gct.js error (ok):', e.message.substring(0,100));
}

try {
    vm.runInContext(captchaCode, ctx, { timeout: 15000, filename: 'captcha.js' });
    console.log('[hook_encrypt.js] captcha.js executed');
} catch(e) {
    console.log('[hook_encrypt.js] captcha.js error (ok):', e.message.substring(0,100));
}

// 7. 检查是否有 Captcha/Geetest 对象
const hasGeetest = ctx.Geetest || ctx.initGeetest || ctx.initGeetest4;
console.log('[hook_encrypt.js] Geetest available:', !!hasGeetest, '| initGeetest:', !!ctx.initGeetest);
console.log('[hook_encrypt.js] _gct available:', typeof ctx._gct);
console.log('[hook_encrypt.js] encrypt available:', typeof ctx.encrypt);

// 8. 测试 encrypt 函数
console.log('[hook_encrypt.js] encrypt type:', typeof ctx.__encrypt);
console.log('[hook_encrypt.js] _gct type:', typeof ctx._gct);

if (typeof ctx.__encrypt === 'function' && ctx._gct) {
    console.log('\n=== Testing verify1 plaintext ===');
    try {
        // 模拟 _insertToken
        const s1 = {geetest: 'captcha'};
        ctx._gct(s1);  // 填入 gct 和 em
        console.log('After _gct:', JSON.stringify(s1));
        console.log('gct value:', s1.gct);
        
        // 模拟 verify1 t1 = {type:'ai', passtime:N}
        // 测试不同 passtime 看哪个 w 长度=512
        for (const passtime of [10, 100, 1000, 10000]) {
            const s = {...s1, type: 'ai', passtime};
            const plain = JSON.stringify(s);
            const padded = Math.ceil((plain.length+1)/16)*16;
            const w_len = padded*2 + 256;
            console.log(`passtime=${passtime}: json_len=${plain.length} w=${w_len}`);
        }
        
        // 实际生成 w 验证
        const s_v1 = {...s1, type: 'ai', passtime: 10};
        const plain_v1 = JSON.stringify(s_v1);
        console.log('\nverify1 plaintext (passtime=10):', plain_v1);
        console.log('Length:', plain_v1.length);
        
        // 模拟 verify2
        const s_v2_base = {...s1};
        // trackOffset 需要 20-35 字符
        const trackOffset = 's0s1s1s0s1s1s0s1s1s0s1';
        const s_v2 = {...s_v2_base, trackOffset, type: 'slide', answer: 180, passtime: 1800};
        const plain_v2 = JSON.stringify(s_v2);
        const padded_v2 = Math.ceil((plain_v2.length+1)/16)*16;
        const w_v2 = padded_v2*2 + 256;
        console.log('\nverify2 plaintext len:', plain_v2.length, 'w:', w_v2, '(target 640)');
        console.log('verify2 plaintext:', plain_v2);
    } catch(e) {
        console.log('Error:', e.message);
        console.log(e.stack);
    }
}

// 9. 输出拦截到的明文
setTimeout(() => {
    const captured = ctx.__interceptedPlaintexts;
    console.log('[hook_encrypt.js] Captured plaintexts:', captured.length);
    captured.forEach((item, i) => {
        console.log(`  [${i}] len=${item.len}: ${item.plaintext.substring(0, 300)}`);
    });
}, 500);
