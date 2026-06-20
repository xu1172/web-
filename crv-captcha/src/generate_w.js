/**
 * generate_w.js - 极验验证码 w 参数生成器
 * 通过 Node.js vm 加载极验 captcha.js，调用其内部 encrypt 函数生成 w 参数
 *
 * 用法：node generate_w.js <lot_number> <captcha_id> <challenge> <pt> <track_json>
 * 输出：JSON { success: true, w: "..." }
 */
'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// ============================================================
// 浏览器环境
// ============================================================
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
                setAttribute: function(k, v) {
                    this.attributes[k] = v;
                    if (k === 'src') { this._src = v; }
                },
                getAttribute: function(k) { return this.attributes[k] || null; },
                appendChild: function(c) { this.children.push(c); return c; },
                removeChild: function(c) {
                    const i = this.children.indexOf(c);
                    if (i > -1) this.children.splice(i, 1);
                },
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
                set onreadystatechange(fn) { this._events.rsc = fn; },
                get onreadystatechange() { return this._events.rsc || null; }
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
                if (el && el._events && el.tagName === 'SCRIPT') {
                    setTimeout(() => { if (el._events.load) el._events.load(); }, 5);
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

    const nav = {
        appName: 'Netscape',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'Win32',
        language: 'zh-CN',
        userLanguage: 'zh-CN',
        languages: ['zh-CN', 'zh', 'en'],
        cookieEnabled: true,
        onLine: true,
        hardwareConcurrency: 8,
        maxTouchPoints: 0,
        vendor: 'Google Inc.',
        product: 'Gecko',
        productSub: '20030107',
        doNotTrack: null,
        pdfViewerEnabled: true,
        webdriver: false,
        plugins: { length: 3,
            0: { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: '' },
            1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            2: { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
        },
        mimeTypes: { length: 2,
            0: { type: 'application/pdf', suffixes: 'pdf', enabledPlugin: {} },
            1: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', enabledPlugin: {} }
        }
    };

    const env = {
        document: doc,
        navigator: nav,
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
            timing: {
                navigationStart: Date.now() - 5000,
                fetchStart: Date.now() - 4800,
                domainLookupStart: Date.now() - 4700,
                domainLookupEnd: Date.now() - 4600,
                connectStart: Date.now() - 4500,
                connectEnd: Date.now() - 4300,
                secureConnectionStart: Date.now() - 4400,
                requestStart: Date.now() - 4200,
                responseStart: Date.now() - 4000,
                responseEnd: Date.now() - 3800,
                domLoading: Date.now() - 3500,
                domInteractive: Date.now() - 2000,
                domContentLoadedEventStart: Date.now() - 1800,
                domContentLoadedEventEnd: Date.now() - 1700,
                domComplete: Date.now() - 800,
                loadEventStart: Date.now() - 700,
                loadEventEnd: Date.now() - 600,
                unloadEventStart: 0, unloadEventEnd: 0,
                redirectStart: 0, redirectEnd: 0
            }
        },
        // XHR - Mock，不发送真实请求
        XMLHttpRequest: class MockXHR {
            constructor() {
                this.readyState = 0;
                this.status = 200;
                this.statusText = 'OK';
                this.responseText = '{}';
                this.response = '{}';
                this.responseType = '';
                this.headers = {};
                this._url = '';
                this._method = 'GET';
                this._events = {};
            }
            open(m, u) { this._method = m; this._url = u; }
            setRequestHeader(k, v) { this.headers[k] = v; }
            send(body) {
                setTimeout(() => {
                    this.readyState = 4;
                    this.status = 200;
                    this.responseText = '{"status":"success","data":{}}';
                    this.response = this.responseText;
                    if (this.onreadystatechange) this.onreadystatechange();
                    if (this.onload) this.onload({ target: this });
                }, 10);
            }
            getResponseHeader(k) { return 'application/json'; }
            getAllResponseHeaders() { return 'content-type: application/json\r\n'; }
            addEventListener(ev, fn) { this._events[ev] = fn; }
            removeEventListener() {}
            abort() {}
        },
        XDomainRequest: undefined,
        fetch: undefined,
        localStorage: {
            _d: {},
            getItem(k) { return this._d[k] !== undefined ? this._d[k] : null; },
            setItem(k, v) { this._d[k] = String(v); },
            removeItem(k) { delete this._d[k]; },
            clear() { this._d = {}; }
        },
        sessionStorage: {
            _d: {},
            getItem(k) { return this._d[k] !== undefined ? this._d[k] : null; },
            setItem(k, v) { this._d[k] = String(v); },
            removeItem(k) { delete this._d[k]; },
            clear() { this._d = {}; }
        },
        // 预置极验语言包，避免 loadLang 网络请求失败
        Geetest_LANG: {
            slide: '请完成下方验证后继续操作',
            click: '请在下图中依次点击',
            voice: '请点击下方音频中读出的数字',
            icon: '请在下图中选出正确图标',
            success: '验证通过',
            error: '验证失败，请在完成下方验证后继续操作',
            cancel: '取消验证',
            reset: '刷新验证',
            feedback: '意见反馈',
            tip: '向右滑动完成验证',
            fail: '请控制拼图块对齐缺口'
        }
    };

    env.window = env;
    env.self = env;
    env.top = env;
    env.parent = env;
    doc.defaultView = env;
    doc.location = env.location;

    return env;
}

// ============================================================
// 加载 captcha.js（单例，避免重复加载）
// ============================================================
let _ctx = null;

function getContext() {
    if (_ctx) return _ctx;
    const env = createEnv();
    const ctx = vm.createContext(env);

    const gctCode = fs.readFileSync(path.join(ASSETS_DIR, 'gct.js'), 'utf-8');
    const captchaCode = fs.readFileSync(path.join(ASSETS_DIR, 'captcha_live_patched.js'), 'utf-8');

    try { vm.runInContext(gctCode, ctx, { timeout: 5000 }); } catch(e) { /* gct 错误可忽略 */ }
    try { vm.runInContext(captchaCode, ctx, { timeout: 10000 }); } catch(e) { /* 部分错误可忽略 */ }

    if (!ctx.__encrypt) {
        throw new Error('__encrypt function not exposed. Check captcha_live_patched.js patch.');
    }

    _ctx = ctx;
    return ctx;
}

// ============================================================
// SlideTrack._calcData - 差分轨迹计算（与 captcha.js 完全一致）
// ============================================================
function calcData(track) {
    // 对应 captcha.js line 4459-4481
    const e = [];
    let n = 0;
    let r, i, s;
    for (let a = 0, o = track.length - 1; a < o; a += 1) {
        r = Math.round(track[a + 1][0] - track[a][0]);  // Math.round = okq(270)
        i = Math.round(track[a + 1][1] - track[a][1]);
        s = Math.round(track[a + 1][2] - track[a][2]);
        if (r === 0 && i === 0 && s === 0) continue;
        if (r === 0 && i === 0) {
            n += s;
        } else {
            e.push([r, i, s + n]);
            n = 0;
        }
    }
    if (n !== 0) {
        e.push([r, i, n]);
    }
    return e;
}

// SlideTrack._encode - 编码差分轨迹为字符串（与 captcha.js 完全一致）
function encodeTrack(track) {
    // 字母表：okq(691) + okq(650)
    const CHARS = '()*,-./0123456789:?@ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz~';
    // 特殊模式字母表：okq(650) = stuvwxyz~
    const SPECIAL = 'stuvwxyz~';
    // 特殊模式（常见 [dx,dy] 组合）
    const SPECIAL_PATTERNS = [[1,0],[2,0],[1,-1],[1,1],[0,1],[0,-1],[3,0],[2,-1],[2,1]];

    const t = calcData(track);

    // 编码单个数值（对应 o 函数，line 4484-4505）
    const encodeNum = (v) => {
        const abs = Math.abs(v);
        const n = CHARS.length;   // 73
        let s = Math.floor(abs / n);
        if (s >= n) s = n - 1;
        let r = '';
        if (s) r = CHARS.charAt(s);
        const rem = abs % n;
        let prefix = '';
        if (v < 0) prefix += '!';   // okq(617) = '!'
        if (r) prefix += '$';        // okq(245) = '$'
        return prefix + r + CHARS.charAt(rem);
    };

    // 编码特殊 [dx,dy] 模式（对应 s 函数，line 4506-4514）
    const encodeSpecial = (point) => {
        for (let r = 0; r < SPECIAL_PATTERNS.length; r++) {
            if (point[0] === SPECIAL_PATTERNS[r][0] && point[1] === SPECIAL_PATTERNS[r][1]) {
                return SPECIAL[r];   // okq(650) 字母表
            }
        }
        return null;
    };

    // 读取 _encode 函数逻辑（line 4482-4540）
    // t = calcData(track)
    // 对 t 中每个点 [dx,dy,dt]：优先 encodeSpecial(dx,dy)+encodeNum(dt)，否则三个数独立编码
    let result = '';
    for (const point of t) {
        const sp = encodeSpecial(point);
        if (sp !== null) {
            result += sp + encodeNum(point[2]);
        } else {
            result += encodeNum(point[0]) + encodeNum(point[1]) + encodeNum(point[2]);
        }
    }
    return result;
}

// 默认轨迹生成（模拟真实人手，带 y 轴抖动，4-5点确保自然轨迹）
// calcData 差分压缩后点极少，符合极验服务端验证要求
function generateDefaultTrack(distance) {
    const duration = 1600 + Math.floor(Math.random() * 600); // 1.6~2.2秒
    const points = [];
    // 起始点
    points.push([0, 0, 0]);
    // 中间1-2个点：加速段
    const numMid = 1 + Math.floor(Math.random() * 2); // 1或2个中间点
    for (let i = 1; i <= numMid; i++) {
        const p = i / (numMid + 1);
        const x = Math.round(distance * (0.3 + 0.3 * p));
        const y = Math.round((Math.random() - 0.5) * 6); // -3 ~ +3 y轴抖动
        const t = Math.round(duration * (0.3 + 0.3 * p));
        points.push([x, y, t]);
    }
    // 终点
    const lastY = Math.round((Math.random() - 0.5) * 4);
    points.push([distance, lastY !== 0 ? lastY : 1, duration]);
    return points;
}

// ============================================================
// 核心：生成 w 参数
// ============================================================
function generateW(params) {
    const {
        lot_number,
        captcha_id,
        challenge,
        pt = '10',
        track = null
    } = params;

    const ctx = getContext();
    const realTrack = track || generateDefaultTrack(180);
    const passtime = realTrack.length > 1
        ? realTrack[realTrack.length - 1][2] - realTrack[0][2]
        : 1800;

    // 生成 trackOffset（SlideTrack._encode 的输出）
    const trackOffset = encodeTrack(realTrack);

    // 最大 x 位移（answer 字段）
    const answer = Math.round(Math.max(...realTrack.map(p => p[0])));

    // 构建 s 对象（与 captcha.js verify 函数完全对齐）
    // _insertToken(s) 会先填入 geetest/gct/em，然后 Object.assign(s, t)
    // t = { trackOffset, type, answer, passtime }
    // 所以 s 最终应为：{ geetest, gct, em, trackOffset, type, answer, passtime }
    const s = {};

    // 模拟 _insertToken：调用 _gct 填入 geetest/gct/em 字段
    if (ctx._gct) {
        try {
            const tokenObj = { geetest: 'captcha' };
            ctx._gct(tokenObj);  // 填入 gct（数字字符串）和 em
            Object.assign(s, tokenObj);
        } catch(e) {
            s.geetest = 'captcha';
            s.gct = '138800804';
            s.em = { ph: 0, cp: 0, ek: '11', wd: 1, nt: 0, si: 0, sc: 0 };
        }
    } else {
        s.geetest = 'captcha';
        s.gct = '138800804';
        s.em = { ph: 0, cp: 0, ek: '11', wd: 1, nt: 0, si: 0, sc: 0 };
    }

    // 合并 slide 轨迹数据（Object.assign(s, t)）
    Object.assign(s, {
        trackOffset: trackOffset,
        type: 'slide',
        answer: answer,
        passtime: passtime
    });

    const fakeCaptcha = {
        config: {
            pt: pt,
            captchaId: captcha_id,
            lotNumber: lot_number,
            challenge: challenge,
            clientType: 'web',
        }
    };

    const jsonStr = JSON.stringify(s);
    
    const w = ctx.__encrypt(jsonStr, fakeCaptcha);

    if (!w) {
        throw new Error('encrypt returned null/undefined');
    }

    return w;
}

// ============================================================
// 命令行入口
// ============================================================
function main() {
    const args = process.argv.slice(2);
    if (args.length < 4) {
        process.stdout.write(JSON.stringify({ success: false, error: 'Usage: node generate_w.js <lot_number> <captcha_id> <challenge> <pt> [track_json|verify1]' }) + '\n');
        process.exit(1);
    }

    const [lot_number, captcha_id, challenge, pt, trackOrMode] = args;
    
    // verify1 模式：生成 {geetest,gct,em,type:"ai",passtime:10} 加密的 w
    if (trackOrMode === 'verify1') {
        try {
            const ctx = getContext();
            const s = {};
            if (ctx._gct) {
                const tokenObj = { geetest: 'captcha' };
                ctx._gct(tokenObj);
                Object.assign(s, tokenObj);
            } else {
                s.geetest = 'captcha'; s.gct = '138800804';
                s.em = { ph: 0, cp: 0, ek: '11', wd: 1, nt: 0, si: 0, sc: 0 };
            }
            Object.assign(s, { type: 'ai', passtime: 10 });
            const jsonStr = JSON.stringify(s);
            const fakeCaptcha = { config: { pt, captchaId: captcha_id, lotNumber: lot_number, challenge, clientType: 'web' } };
            const w = ctx.__encrypt(jsonStr, fakeCaptcha);
            if (!w) throw new Error('encrypt returned null');
            process.stdout.write(JSON.stringify({ success: true, w, mode: 'verify1', plaintext_len: jsonStr.length }) + '\n');
        } catch(e) {
            process.stdout.write(JSON.stringify({ success: false, error: e.message }) + '\n');
            process.exit(1);
        }
        return;
    }
    
    let track = null;
    if (trackOrMode) {
        // 若是纯数字，表示滑动距离，用 generateDefaultTrack 生成 3 点轨迹
        if (/^\d+$/.test(trackOrMode)) {
            track = generateDefaultTrack(parseInt(trackOrMode, 10));
        } else {
            try {
                const rawTrack = JSON.parse(trackOrMode);
                // 外部传入的多点轨迹：只取起点、中间某点、终点（3点），确保 w=640
                if (Array.isArray(rawTrack) && rawTrack.length >= 2) {
                    const first = rawTrack[0];
                    const last = rawTrack[rawTrack.length - 1];
                    const midIdx = Math.floor(rawTrack.length / 2);
                    const mid = rawTrack[midIdx];
                    track = rawTrack.length === 2 ? [first, last] : [first, mid, last];
                }
            } catch(e) {
                // 解析失败，使用默认轨迹
            }
        }
    }
    
    try {
        const w = generateW({ lot_number, captcha_id, challenge, pt, track });
        process.stdout.write(JSON.stringify({ success: true, w }) + '\n');
    } catch(e) {
        process.stdout.write(JSON.stringify({ success: false, error: e.message }) + '\n');
        process.exit(1);
    }
}

main();
