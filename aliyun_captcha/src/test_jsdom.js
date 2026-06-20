'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { JSDOM, requestInterceptor } = require('jsdom');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE_URL = 'https://promotion.aliyun.com/ntms/act/captchaIntroAndDemo.html';

// ======================== 资源拦截 ========================
function createResourceInterceptor() {
    const loaded = [];
    const missed = [];

    // 真实 HTTP 请求（支持 GET/POST）
    function realHttpRequest(urlStr, method, body) {
        return new Promise((resolve, reject) => {
            const u = new URL(urlStr);
            method = method || 'GET';
            const mod = u.protocol === 'https:' ? https : http;
            const headers = {
                'User-Agent': UA,
                'Accept': '*/*',
                'Referer': BASE_URL,
            };
            if (body) {
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
                headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
            }
            const opts = {
                hostname: u.hostname, port: u.port, path: u.pathname + u.search,
                method: method,
                headers: headers,
                timeout: 10000,
            };
            const req = mod.request(opts, (res) => {
                const chunks = [];
                res.on('data', d => chunks.push(d));
                res.on('end', () => {
                    const respBody = Buffer.concat(chunks).toString('utf8');
                    resolve(respBody);
                });
            });
            req.on('error', (e) => { console.log('    [realHttp] error:', e.message); reject(e); });
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            if (body) req.write(body);
            req.end();
        });
    }

    // 简化的 GET 请求
    function realHttpGet(urlStr) {
        return realHttpRequest(urlStr, 'GET', null);
    }

    const urlMap = [
        [/\/AWSC\/AWSC\/awsc\.js/i, 'awsc.js'],
        [/\/AWSC\/et\/.*\/et_f\.js/i, 'et_f.js'],
        [/\/AWSC\/fireyejs\/.*\/fireyejs\.js/i, 'fireyejs.js'],
        [/\/AWSC\/nc\/.*\/nc\.js/i, 'nc.js'],
        [/\/sd\/nvc\/.*\/nvc\.js/i, 'nvc.js'],
        [/(\/AWSC\/uab\/.*\/collina\.js|uabModule)/i, 'dss.js'],
    ];

    // 同步资源查询（本地文件 + 模拟数据）
    function fetchSync(normalized) {
        // 先检查 JSONP 拦截
        if (/\/nocaptcha\/initialize\.jsonp/i.test(normalized)) {
            const urlObj1 = new URL(normalized);
            const cb1 = urlObj1.searchParams.get('callback') || 'callback';
            loaded.push({ url: normalized, synthetic: 'initialize.jsonp (sync)' });
            return `${cb1}({"success":true,"result":{"code":100,"result":{}}});`;
        }

        for (const [pattern, filename] of urlMap) {
            if (pattern.test(normalized)) {
                const filePath = path.join(ASSETS_DIR, filename);
                if (fs.existsSync(filePath)) {
                    loaded.push({ url: normalized, file: filename });
                    return fs.readFileSync(filePath, 'utf8');
                }
            }
        }

        // 拦截 umid/uab/wu.json 等 JSON API
        if (/ynuf\.aliapp\.org\/service\/um\.json/i.test(normalized)) {
            loaded.push({ url: normalized, synthetic: 'um.json' });
            return JSON.stringify({ code: 200, success: true, data: { tn: 'T2gAN1aK3_default_umid_token' } });
        }
        if (/ynuf\.aliapp\.org\/w\/wu\.json/i.test(normalized)) {
            loaded.push({ url: normalized, synthetic: 'wu.json' });
            const wuPath = path.join(ASSETS_DIR, 'wu.json');
            return fs.existsSync(wuPath) ? fs.readFileSync(wuPath, 'utf8') : '{}';
        }

        return null; // 未匹配
    }

    // 异步 interceptor（jsdom 的 requestInterceptor）
    const interceptor = requestInterceptor(async (req) => {
        const url = String(req.url || req);
        const method = String(req.method || 'GET');
        const body = req.body ? String(req.body) : null;
        
        // 先尝试同步查询
        const syncResult = fetchSync(url);
        if (syncResult !== null) {
            return syncResult;
        }

        // analyze.jsonp — 需要真实 HTTP 请求（支持 GET/POST）
        if (/\/nocaptcha\/analyze\.jsonp/i.test(url)) {
            console.log('    [interceptor] analyze.jsonp ' + method + ' → real HTTP...');
            if (body) {
                console.log('    [interceptor] analyze POST body (first 500):', body.slice(0, 500));
            }
            try {
                const realResp = await realHttpRequest(url, method, body);
                console.log('    [interceptor] analyze resp (first 300):', realResp.slice(0, 300));
                loaded.push({ url, synthetic: 'analyze.jsonp (http ' + method + ')', size: realResp.length });
                return realResp;
            } catch (e) {
                console.log('    [interceptor] analyze HTTP failed:', e.message);
                const cbName = new URL(url).searchParams.get('callback') || 'callback';
                return `${cbName}({"result":{"code":500,"value":"http_error"},"success":false});`;
            }
        }

        // initialize.jsonp — 真实 HTTP 请求
        if (/\/nocaptcha\/initialize\.jsonp/i.test(url)) {
            try {
                const realResp = await realHttpRequest(url, method, body);
                if (realResp && realResp.length > 10) {
                    loaded.push({ url, synthetic: 'initialize.jsonp (http)', size: realResp.length });
                    return realResp;
                }
            } catch (e) {}
            const cbName = new URL(url).searchParams.get('callback') || 'callback';
            return `${cbName}({"success":true,"result":{"code":100,"result":{}}});`;
        }

        missed.push({ url, method });
        return '';
    });

    return { loaded, missed, interceptor, realHttpGet };
}

// ======================== 布局属性补全 ========================
function installDeterministicLayout(window) {
    const baseRects = {
        nocaptcha: { x: 535, y: 292, width: 300, height: 48 },
        nc_nvc_wrapper: { x: 535, y: 292, width: 300, height: 48 },
        nc_1_n1z: { x: 535, y: 292, width: 48, height: 48 },
        nc_2_n1z: { x: 535, y: 292, width: 48, height: 48 },
        nc_1_n1t: { x: 535, y: 292, width: 300, height: 48 },
        nc_2_n1t: { x: 535, y: 292, width: 300, height: 48 },
        nc_1_wrapper: { x: 535, y: 292, width: 300, height: 34 },
        nc_2_wrapper: { x: 535, y: 292, width: 300, height: 34 },
        nc_1__bg: { x: 535, y: 292, width: 0, height: 48 },
        nc_2__bg: { x: 535, y: 292, width: 0, height: 48 },
    };

    // 通配：任何 nc_X_* id 都能匹配到基础矩形
    function getRect(id) {
        if (baseRects[id]) return baseRects[id];
        // 匹配 nc_数字_xxx 的模式
        const m = id && id.match(/^nc_(\d+)_(.*)/);
        if (m) {
            const templateKey = 'nc_1_' + m[2];
            if (baseRects[templateKey]) return baseRects[templateKey];
        }
        return null;
    }

    const proto = window.HTMLElement.prototype;

    Object.defineProperties(proto, {
        offsetWidth: {
            get() { const r = getRect(this.id); return r ? r.width : (parseInt(this.style?.width, 10) || 300); },
            configurable: true,
        },
        offsetHeight: {
            get() { const r = getRect(this.id); return r ? r.height : (parseInt(this.style?.height, 10) || 48); },
            configurable: true,
        },
        offsetLeft: {
            get() { const r = getRect(this.id); return r ? r.x : 0; },
            configurable: true,
        },
        offsetTop: {
            get() { const r = getRect(this.id); return r ? r.y : 0; },
            configurable: true,
        },
        clientWidth: {
            get() { return this.offsetWidth; },
            configurable: true,
        },
        clientHeight: {
            get() { return this.offsetHeight; },
            configurable: true,
        },
        scrollWidth: {
            get() { return this.offsetWidth; },
            configurable: true,
        },
        scrollHeight: {
            get() { return this.offsetHeight; },
            configurable: true,
        },
    });

    proto.getBoundingClientRect = function() {
        const r = getRect(this.id);
        const rect = r || { x: 0, y: 0, width: this.offsetWidth || 0, height: this.offsetHeight || 0 };
        return {
            x: rect.x, y: rect.y, width: rect.width, height: rect.height,
            top: rect.y, left: rect.x, right: rect.x + rect.width, bottom: rect.y + rect.height,
            toJSON() { return this; },
        };
    };
}

// ======================== 浏览器属性补全 ========================
function installBrowserSurface(window) {
    const nav = window.navigator;
    const origProps = {
        webdriver: undefined,
        userAgent: UA,
        platform: 'Win32',
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
        hardwareConcurrency: 8,
        deviceMemory: 8,
        maxTouchPoints: 0,
        cookieEnabled: true,
    };
    for (const [k, v] of Object.entries(origProps)) {
        try { Object.defineProperty(nav, k, { get: () => v, configurable: true }); } catch (e) {}
    }

    // 补 screen
    const screenOverrides = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelDepth: 24 };
    for (const [k, v] of Object.entries(screenOverrides)) {
        try { Object.defineProperty(window.screen, k, { get: () => v, configurable: true }); } catch (e) {}
    }

    // 补 window 属性
    window.devicePixelRatio = 1;
    window.chrome = { runtime: {} };
    window.matchMedia = function(q) {
        return { matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
    };
    
    // 补 document.hasFocus
    window.document.hasFocus = () => true;
    Object.defineProperty(window.document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(window.document, 'visibilityState', { get: () => 'visible', configurable: true });
}

// ======================== 鼠标手势模拟 ========================
async function simulateSliderGesture(window) {
    const btn = window.document.querySelector('[id*="n1z"]') || window.document.querySelector('.btn_slide');
    if (!btn) {
        console.log('    [gesture] slider button not found, checking DOM...');
        console.log('    [gesture] body:', window.document.body?.innerHTML?.slice(0, 200) || 'no body');
        return { ok: false, reason: 'slider button not found' };
    }

    const rect = btn.getBoundingClientRect();
    const trackEl = window.document.querySelector('[id*="n1t"]');
    const wrapper = window.document.querySelector('[id*="wrapper"]') || window.document.body;
    const trackRect = trackEl ? trackEl.getBoundingClientRect() : { width: 300 };
    const btnWidth = rect.width || 48;
    const trackWidth = trackRect.width || 300;
    const dragDistance = trackWidth - btnWidth;
    
    const startX = rect.left + rect.width / 2;
    const endX = startX + dragDistance;
    const y = rect.top + rect.height / 2;
    
    console.log('    [gesture] startX:', startX, 'endX:', endX, 'btn:', btn.id || btn.className, 'track:', trackEl?.id || 'none', 'wrapper:', wrapper.id || wrapper.className);

    // 辅助函数：在指定元素上分发事件
    const fireEvent = (target, type, x, yVal, extraProps = {}) => {
        try {
            const targetRect = target.getBoundingClientRect();
            const props = Object.assign({
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: x,
                clientY: yVal,
                screenX: x,
                screenY: yVal,
                pageX: x,
                pageY: yVal,
                offsetX: x - targetRect.left,
                offsetY: yVal - targetRect.top,
                movementX: extraProps.movementX || 0,
                movementY: extraProps.movementY || 0,
                buttons: type === 'mouseup' ? 0 : 1,
                button: 0,
                detail: 0,
                which: type === 'mouseup' ? 0 : 1,
            }, extraProps);
            const evt = new window.MouseEvent(type, props);
            target.dispatchEvent(evt);
        } catch (e) {
            // console.log('    [gesture] fire error:', type, target.id || target.tagName, e.message);
        }
    };

    // Focus events (文档级别)
    window.dispatchEvent(new window.FocusEvent('focus', { bubbles: true }));
    window.document.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));

    // 鼠标进入按钮
    fireEvent(btn, 'mouseover', startX, y);
    fireEvent(btn, 'mouseenter', startX, y);
    
    // 短暂延迟后按下（模拟人类反应时间）
    await new Promise(r => setTimeout(r, 80 + Math.random() * 50));
    
    // 在按钮上分发 mousedown
    fireEvent(btn, 'mousedown', startX, y, { buttons: 1 });
    
    // 构建人类轨迹（sigmoid 加速曲线）
    const totalFrames = 35 + Math.floor(Math.random() * 10);
    console.log('    [gesture] frames:', totalFrames, 'distance:', dragDistance);
    
    let prevX = startX;
    let prevY = y;
    
    for (let i = 1; i <= totalFrames; i++) {
        const t = i / totalFrames;
        // sigmoid 曲线：先慢后快再慢
        const eased = 1 / (1 + Math.exp(-12 * (t - 0.5)));
        const minE = 1 / (1 + Math.exp(-12 * (-0.5)));
        const maxE = 1 / (1 + Math.exp(-12 * 0.5));
        const normalized = (eased - minE) / (maxE - minE);
        
        const dx = normalized * dragDistance;
        const x = startX + dx;
        const yJitter = Math.sin(t * Math.PI * 1.5) * (1.5 + Math.random() * 1.5);
        const yVal = y + yJitter;
        const moveX = x - prevX;
        const moveY = yVal - prevY;
        
        // 在 TRACK 元素上分发 mousemove（widget 监听在 track 上）
        const targetEl = trackEl || wrapper;
        fireEvent(targetEl, 'mousemove', x, yVal, {
            buttons: 1,
            movementX: moveX,
            movementY: moveY,
        });
        // 同时在 wrapper 和按钮上也分发
        if (wrapper !== targetEl) fireEvent(wrapper, 'mousemove', x, yVal, { buttons: 1, movementX: moveX, movementY: moveY });
        
        prevX = x;
        prevY = yVal;
        
        await new Promise(r => setTimeout(r, 12 + Math.random() * 8));
    }

    // Mouse up - 在 track 上
    fireEvent(trackEl || wrapper, 'mouseup', endX, y);
    fireEvent(wrapper, 'mouseup', endX, y);
    fireEvent(window.document, 'mouseup', endX, y);

    console.log('    [gesture] done');
    await new Promise(r => setTimeout(r, 1500));
    return { ok: true, frames: totalFrames, distance: dragDistance };
}

// ======================== 轮询 FY Token ========================
async function callUntilReady(fn, tries = 40) {
    let last;
    for (let i = 0; i < tries; i++) {
        try {
            last = fn();
            if (last && typeof last === 'string' && !last.includes('default') && last.length > 200) {
                return last;
            }
        } catch (e) {
            last = e.message;
        }
        await new Promise(r => setTimeout(r, 250));
    }
    throw new Error(`FY token not ready after ${tries} tries. Last: ${String(last).slice(0, 100)}`);
}

// ======================== 主函数 ========================
async function main() {
    console.log('='.repeat(60));
    console.log('jsdom + fireyejs 滑块验证测试');
    console.log('='.repeat(60));

    const { loaded, missed, interceptor, realHttpGet } = createResourceInterceptor();

    // 创建 JSDOM
    console.log('[1] Creating JSDOM...');
    const virtualConsole = new (require('jsdom').VirtualConsole)();
    
    const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body><div id="captcha"></div></body></html>`, {
        url: BASE_URL,
        referrer: BASE_URL,
        userAgent: UA,
        runScripts: 'dangerously',
        resources: { interceptors: [interceptor] },
        beforeParse(window) {
            // 提前设置一些属性
            installBrowserSurface(window);
        },
        pretendToBeVisual: true,
    });

    const { window } = dom;
    console.log('    JSDOM created, url:', window.location.href);

    // 补布局属性
    installDeterministicLayout(window);

    // XHR/fetch 钩子：捕获 widget 发出的所有请求（特别是 POST body）
    window.__xhrLog = [];
    window.eval(`
        (function() {
            // XHR hook
            var origOpen = XMLHttpRequest.prototype.open;
            var origSend = XMLHttpRequest.prototype.send;
            XMLHttpRequest.prototype.open = function(method, url) {
                this.___method = method;
                this.___url = url;
                return origOpen.apply(this, arguments);
            };
            XMLHttpRequest.prototype.send = function(body) {
                if (this.___url && (this.___url.indexOf('analyze.jsonp') !== -1 || this.___url.indexOf('initialize.jsonp') !== -1 || this.___url.indexOf('nocaptcha') !== -1)) {
                    window.__xhrLog.push({
                        method: this.___method,
                        url: this.___url,
                        body: body ? String(body).slice(0, 1000) : null,
                    });
                    console.log('[XHR] ' + this.___method + ' ' + this.___url + (body ? ' body:' + String(body).slice(0, 200) : ''));
                }
                return origSend.apply(this, arguments);
            };
            
            // fetch hook
            var origFetch = window.fetch;
            window.fetch = function(url, opts) {
                if (url && (String(url).indexOf('analyze.jsonp') !== -1 || String(url).indexOf('nocaptcha') !== -1)) {
                    var method = (opts && opts.method) || 'GET';
                    var body = (opts && opts.body) ? String(opts.body).slice(0, 1000) : null;
                    window.__xhrLog.push({ method: method, url: String(url), body: body, via: 'fetch' });
                    console.log('[FETCH] ' + method + ' ' + String(url) + (body ? ' body:' + String(body).slice(0, 200) : ''));
                }
                return origFetch.apply(this, arguments);
            };
            
            // Form submission hook
            var origSubmit = HTMLFormElement.prototype.submit;
            HTMLFormElement.prototype.submit = function() {
                var action = this.action || '';
                if (action.indexOf('analyze.jsonp') !== -1 || action.indexOf('nocaptcha') !== -1) {
                    var inputs = this.querySelectorAll('input, textarea');
                    var data = {};
                    for (var i = 0; i < inputs.length; i++) {
                        data[inputs[i].name] = inputs[i].value;
                    }
                    window.__xhrLog.push({ method: 'FORM-POST', url: action, body: JSON.stringify(data).slice(0, 1000), via: 'form' });
                    console.log('[FORM] submit to ' + action + ' data:' + JSON.stringify(data).slice(0, 300));
                }
                return origSubmit.apply(this, arguments);
            };
        })()
    `);
    console.log('    XHR/Fetch/Form hooks installed');

    // 注入 NC_Opt（noCaptcha 需要的配置）
    const token = Date.now() + ':' + Math.random();
    window.report = function() {}; // noCaptcha 内部日志函数
    // 尝试 capCode=200（智能验证，不需要滑块轨迹）
    const testCapCode = 200;  // 改为 200 测试智能验证模式
    window.NC_Opt = {
        appkey: 'CF_APP_1',
        scene: 'nvc_register',
        token: token,
        renderTo: '#captcha',
        trans: { key1: 'code0', nvcCode: testCapCode },
        capCode: testCapCode,
        customWidth: 300,
        popUp: true,
    };
    window.UA_Opt = { appkey: 'CF_APP_1', token: token, scene: 'nvc_register' };
    window.NVC_Data = { a: 'CF_APP_1', c: token, d: 'nvc_register', h: window.NC_Opt.trans, j: { test: 1 } };
    window.NVC_Result = {};
    // 调用真实 nvcPrepare 获取合法 session 数据
    const nvcPrepareUrl = `https://cf.aliyun.com/nvc/nvcPrepare.jsonp?a=${encodeURIComponent(JSON.stringify({a:'CF_APP_1',d:'nvc_register',c:token}))}&callback=jsonp_${Math.floor(Math.random()*1e17)}`;
    console.log('    Calling real nvcPrepare...');
    try {
        const nvcPrepResp = await realHttpGet(nvcPrepareUrl);
        const nvcPrepMatch = nvcPrepResp.match(/\(([\s\S]*)\)/);
        if (nvcPrepMatch) {
            const nvcPrepData = JSON.parse(nvcPrepMatch[1]);
            if (nvcPrepData.result && nvcPrepData.result.result) {
                window.NVC_Result.nvcPreRes = nvcPrepData.result.result;
                console.log('    nvcPreRes:', JSON.stringify(nvcPrepData.result.result));
            }
        }
    } catch (e) {
        console.log('    nvcPrepare failed, using fallback:', e.message);
        window.NVC_Result.nvcPreRes = { a: '1.1.156', b: '1.1.156', c: 'fallback_c' };
    }
    window.__nvc_uaboption = {
        MPInterval: 4, MaxMCLog: 12, MaxKSLog: 14, MaxMPLog: 5, MaxFocusLog: 6,
        SendInterval: 5, SendMethod: 8, GPInterval: 50, MaxGPLog: 1, MaxTCLog: 12,
        Flag: 3767502, OnlyHost: 1, MaxMTLog: 500, MinMTDwnLog: 30, MaxNGPLog: 1,
    };

    // 1. 加载 awsc.js
    console.log('[2] Loading awsc.js...');
    const awscCode = fs.readFileSync(path.join(ASSETS_DIR, 'awsc.js'), 'utf8');
    window.eval(awscCode);
    console.log('    AWSC available:', typeof window.AWSC);

    // 拦截 UMID/UAB 的 AWSC.use 调用
    window.eval(`
        (function() {
            var origUse = AWSC.use;
            AWSC.use = function(name, cb, opts) {
                // 对 um/uab 直接返回模拟模块
                if (name === 'um') {
                    setTimeout(function() {
                        cb('loaded', {
                            init: function(cfg, cb2) { setTimeout(function() { cb2('success', { tn: 'T2gAN1aK3_umid_token_' + Date.now() }); }, 50); }
                        });
                    }, 10);
                    return;
                }
                if (name === 'uab') {
                    setTimeout(function() {
                        cb('loaded', { getUA: function() { return '140#lTMnyRczzzF4tzo2+baT_simulated_uab_data'; } });
                    }, 10);
                    return;
                }
                // 对 fy 模块，直接从 __fyModule 获取
                if (name === 'fy' && typeof __fyModule !== 'undefined') {
                    setTimeout(function() { cb('loaded', __fyModule); }, 10);
                    return;
                }
                return origUse.call(AWSC, name, cb, opts);
            };
        })()
    `);
    console.log('    AWSC.use patched');

    // 2. 通过 script 标签加载 fireyejs.js（触发 AWSC 加载机制）
    console.log('[3] Loading fireyejs.js via script tag...');
    const fireyejsCode = fs.readFileSync(path.join(ASSETS_DIR, 'fireyejs.js'), 'utf8');
    
    // 直接 eval fireyejs（绕过 CDN 加载）
    try {
        window.eval(fireyejsCode);
        console.log('    fireyejs eval OK');
    } catch (e) {
        console.log('    fireyejs eval error:', e.message.slice(0, 100));
    }
    console.log('    __fyModule type:', typeof window.__fyModule);
    console.log('    fy type:', typeof window.fy);

    // 3. 加载 nc.js（noCaptcha）
    console.log('[4] Loading nc.js...');
    const ncCode = fs.readFileSync(path.join(ASSETS_DIR, 'nc.js'), 'utf8');
    try {
        window.eval(ncCode);
        console.log('    nc.js eval OK');
    } catch (e) {
        console.log('    nc.js eval error:', e.message.slice(0, 100));
    }
    console.log('    noCaptcha type:', typeof window.noCaptcha);

    // 5. 加载 nvc.js 之前先注入 script 劫持
    // 保存分析 URL 到 window.__pendingAnalyzeUrl，由 Node.js 侧处理
    window.eval(`
        (function() {
            var origSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
            if (origSrcDescriptor && origSrcDescriptor.set) {
                var origSrcSet = origSrcDescriptor.set;
                Object.defineProperty(HTMLScriptElement.prototype, 'src', {
                    get: function() { return this._src || ''; },
                    set: function(val) {
                        if (val && /analyze\\.jsonp/.test(val)) {
                            console.log('[hook] analyze.jsonp saved to __pendingAnalyzeUrl');
                            window.__pendingAnalyzeUrl = val;
                            this._src = val;
                            return;
                        }
                        if (val && /initialize\\.jsonp/.test(val)) {
                            console.log('[hook] initialize.jsonp saved to __pendingInitUrl');
                            window.__pendingInitUrl = val;
                            this._src = val;
                            return;
                        }
                        origSrcSet.call(this, val);
                    },
                    configurable: true,
                });
            }
        })()
    `);
    console.log('    script src hook installed');

    // 4. 加载 nvc.js
    console.log('[5] Loading nvc.js...');
    // NVC_Opt = NC_Opt（nvc.js 需要 NVC_Opt 全局变量）
    window.NVC_Opt = window.NC_Opt;
    const nvcCode = fs.readFileSync(path.join(ASSETS_DIR, 'nvc.js'), 'utf8');
    try {
        window.eval(nvcCode);
        console.log('    nvc.js eval OK');
    } catch (e) {
        console.log('    nvc.js eval error:', e.message.slice(0, 100));
    }

    // 5. 触发 UMID/UAB 初始化（模拟 nvc.js 中的异步初始化）
    window.eval(`
        (function() {
            __nvc__umid = "defaultToken1@@" + location.href + "@@" + (new Date).getTime();
            AWSC.use("um", function(t, e) {
                "loaded" === t && e.init({
                    timeout: 3e3, timestamp: (new Date).getTime(),
                    serviceUrl: "https://ynuf.aliapp.org/service/um.json",
                    appName: "CF_APP_1", enableFY: 1, jf: 1
                }, function(t, e) {
                    __nvc__umid = "success" === t ? e.tn : "fail";
                });
            });
            AWSC.use("uab", function(t, e) {
                "loaded" === t && (__nvc__uab = e);
            });
        })()
    `);
    console.log('    UMID/UAB init triggered');

    // 等待 DOM 渲染 + 滑块出现
    console.log('[6] Waiting for slider to render...');
    await new Promise(r => setTimeout(r, 3000));

    // 检查 DOM 中是否有滑块
    const domState = window.eval(`
        JSON.stringify({
            bodyHTML: document.body ? document.body.innerHTML.slice(0, 300) : 'no body',
            noCaptcha: typeof noCaptcha,
            __fyModule: typeof __fyModule,
            fy: typeof fy,
            _nvc_nc: typeof _nvc_nc,
            NVC_Result: JSON.stringify(NVC_Result).slice(0, 200),
        })
    `);
    console.log('    DOM state:', domState);

    // 7. 如果 noCaptcha 可用，尝试创建实例
    if (typeof window.noCaptcha === 'function') {
        console.log('[7] Creating noCaptcha instance...');
        try {
            window.eval(`
                (function() {
                    // 存储回调数据
                    NVC_Result._ncData = null;
                    window._nvc_nc = new noCaptcha({
                        language: 'zh_CN',
                        isEnabled: true,
                        callback: function(data) {
                            NVC_Result.sessionId = data.csessionid;
                            NVC_Result.sig = data.sig;
                            NVC_Result._ncData = JSON.stringify(data);
                            console.log('[nc callback] sessionId:', data.csessionid);
                            console.log('[nc callback] full:', JSON.stringify(Object.keys(data)));
                        },
                        failCallback: function(data) {
                            console.log('[nc FAIL]', JSON.stringify(data || {}).slice(0, 100));
                            NVC_Result._ncData = 'FAIL:' + JSON.stringify(data || {}).slice(0, 200);
                        },
                        error: function() {},
                        appkey: NC_Opt.appkey,
                        scene: NC_Opt.scene,
                        token: NC_Opt.token,
                        renderTo: '#captcha',
                        trans: NC_Opt.trans,
                        capCode: NC_Opt.capCode,
                        customWidth: NC_Opt.customWidth,
                    });
                    if (_nvc_nc && _nvc_nc.init) {
                        _nvc_nc.init({
                            language: 'zh_CN', isEnabled: true,
                            callback: function(data) {
                                NVC_Result.sessionId = data.csessionid;
                                NVC_Result.sig = data.sig;
                            },
                            failCallback: function() {}, error: function() {},
                            appkey: NC_Opt.appkey, scene: NC_Opt.scene,
                            token: NC_Opt.token, renderTo: '#captcha',
                            trans: NC_Opt.trans, capCode: NC_Opt.capCode,
                        });
                    }
                })()
            `);
            console.log('    noCaptcha instance created');
        } catch (e) {
            console.log('    noCaptcha error:', e.message.slice(0, 150));
        }
    }

    // 8. 处理 initialize.jsonp（在 widget 渲染前）
    console.log('[8] Processing initialize.jsonp...');
    await new Promise(r => setTimeout(r, 1000));
    const initUrl = window.eval('window.__pendingInitUrl || null');
    if (initUrl) {
        console.log('    Fetching initialize.jsonp...');
        try {
            const initResp = await realHttpGet(initUrl);
            console.log('    initialize resp (first 200):', initResp.slice(0, 200));
            window.eval(initResp);
            console.log('    initialize.jsonp eval OK');
        } catch (e) {
            console.log('    initialize fetch failed:', e.message);
        }
    } else {
        console.log('    No pending initialize URL');
    }

    // 等待渲染
    console.log('[9] Waiting for widget render...');
    await new Promise(r => setTimeout(r, 2000));

    // 检查滑块元素
    const sliderCheck = window.eval(`
        JSON.stringify({
            nc_1_n1z: document.getElementById('nc_1_n1z') ? 'found' : 'not found',
            nc_nvc_wrapper: document.getElementById('nc_nvc_wrapper') ? 'found' : 'not found',
            captcha_children: document.getElementById('captcha') ? document.getElementById('captcha').children.length : -1,
            body_children: document.body ? document.body.children.length : -1,
            body_id: document.body ? document.body.innerHTML.slice(0, 500) : 'none',
        })
    `);
    console.log('    Slider check:', sliderCheck);

    // 10. 模拟鼠标手势
    console.log('[10] Simulating slider gesture...');
    const gestureResult = await simulateSliderGesture(window);
    console.log('    Gesture result:', JSON.stringify(gestureResult));

    // 诊断 widget 内部是否记录了轨迹
    const widgetDiag = window.eval(`
        (function() {
            var nc = window._nvc_nc;
            if (!nc) return 'no _nvc_nc';
            var keys = [];
            for (var k in nc) {
                if (nc.hasOwnProperty(k)) {
                    var v = nc[k];
                    var type = typeof v;
                    if (type === 'string') keys.push(k + ':' + type + '="' + v.slice(0, 30) + '"');
                    else if (type === 'number' || type === 'boolean') keys.push(k + ':' + type + '=' + v);
                    else if (v && typeof v.length === 'number') keys.push(k + ':' + type + '[len=' + v.length + ']');
                    else if (type === 'object') keys.push(k + ':' + type);
                    else keys.push(k + ':' + type);
                }
            }
            // 检查 __nc 内部
            var nc2 = nc.__nc;
            if (nc2) {
                for (var k2 in nc2) {
                    if (nc2.hasOwnProperty(k2)) {
                        var v2 = nc2[k2];
                        var t2 = typeof v2;
                        if (t2 === 'object' && v2) {
                            if (typeof v2.length === 'number') keys.push('__nc.' + k2 + ':array[' + v2.length + ']');
                            else if (v2._data) keys.push('__nc.' + k2 + ':has._data');
                            else keys.push('__nc.' + k2 + ':object=' + Object.keys(v2).slice(0,5));
                        } else if (t2 === 'function') {
                            keys.push('__nc.' + k2 + ':function');
                        } else if (t2 === 'string') {
                            keys.push('__nc.' + k2 + ':string="' + v2.slice(0,20) + '"');
                        } else {
                            keys.push('__nc.' + k2 + ':' + t2 + '=' + v2);
                        }
                    }
                }
            }
            return keys.join('\\n');
        })()
    `);
    console.log('    Widget internal state:');
    console.log('    ', widgetDiag);

    // 10b. 处理 analyze.jsonp — 检查 widget 发出的请求方式
    console.log('[10b] Processing analyze.jsonp...');
    await new Promise(r => setTimeout(r, 1500));
    
    // 检查 XHR/fetch 捕获
    const xhrLog = window.eval('JSON.stringify(window.__xhrLog || [])');
    console.log('    XHR log:', xhrLog.slice(0, 500));
    
    const analyzeUrl = window.eval('window.__pendingAnalyzeUrl || null');
    if (analyzeUrl) {
        console.log('    analyze URL:', analyzeUrl.slice(0, 300));
        
        // 检查 JSONP callback 是否已定义
        const cbMatch = analyzeUrl.match(/callback=([^&]+)/);
        const cbName = cbMatch ? cbMatch[1] : 'callback';
        const cbExists = window.eval(`typeof window["${cbName}"] === 'function'`);
        console.log('    callback "' + cbName + '" exists:', cbExists);
        
        try {
            const analyzeResp = await realHttpGet(analyzeUrl);
            console.log('    analyze resp length:', analyzeResp.length);
            console.log('    analyze resp (first 500):', analyzeResp.slice(0, 500));
            
            if (cbExists) {
                console.log('    Wrapping callback ' + cbName + ' to capture result...');
                window.eval(`
                    (function() {
                        var origFn = window["${cbName}"];
                        window["${cbName}"] = function(data) {
                            console.log('[cb-wrap] jsonp callback called with:', JSON.stringify(data).slice(0, 300));
                            window.__lastJsonpResult = data;
                            if (data && data.result) {
                                if (data.result.csessionid) {
                                    NVC_Result.sessionId = data.result.csessionid;
                                    NVC_Result.sig = data.result.sig || '';
                                    NVC_Result._ncData = 'SUCCESS:' + JSON.stringify(data);
                                } else if (data.result.value === 'block') {
                                    NVC_Result._ncData = 'BLOCKED:' + JSON.stringify(data);
                                }
                            }
                            return origFn(data);
                        };
                    })()
                `);
            }
            
            window.eval(analyzeResp);
            console.log('    analyze.jsonp eval done');
        } catch (e) {
            console.log('    analyze error:', e.message);
        }
    } else {
        console.log('    No pending analyze URL — widget might not have triggered analyze');
    }

    // 检查回调是否触发了
    await new Promise(r => setTimeout(r, 1000));
    const ncCheck = window.eval(`JSON.stringify({__lastJsonpResult: window.__lastJsonpResult, ncData: NVC_Result._ncData, sessionId: NVC_Result.sessionId})`);
    console.log('    After analyze:', ncCheck);

    // 11. 轮询获取 FY token
    console.log('[11] Polling for FY token...');
    try {
        const fyToken = await callUntilReady(() => {
            if (typeof window.__fyModule !== 'undefined' && window.__fyModule) {
                if (typeof window.__fyModule.getFYToken === 'function') {
                    return window.__fyModule.getFYToken({
                        appkey: 'CF_APP_1',
                        token: token,
                        scene: 'nvc_register',
                    });
                }
            }
            // 也尝试 fy
            if (typeof window.fy !== 'undefined' && window.fy) {
                if (typeof window.fy.getFYToken === 'function') {
                    return window.fy.getFYToken({
                        appkey: 'CF_APP_1',
                        token: token,
                        scene: 'nvc_register',
                    });
                }
            }
            // 尝试 AWSC.configFYSyncEx
            try {
                const obj = window.AWSC.configFYSyncEx({
                    appkey: 'CF_APP_1', token: token, scene: 'nvc_register',
                    MaxMTLog: 300, MTInterval: 4, location: 'cn',
                });
                if (obj && typeof obj.getFYToken === 'function') {
                    return obj.getFYToken();
                }
            } catch(e) {}
            return undefined;
        });
        console.log('    FY Token (first 150 chars):', fyToken.slice(0, 150));
        console.log('    FY Token length:', fyToken.length);
        console.log('    FY Token prefix:', fyToken.slice(0, 6));
    } catch (e) {
        console.log('    FY Token error:', e.message);
    }

    // 12. 最终状态
    console.log('[12] Final state:');
    // 多等一会儿看 analyze 回调是否触发
    console.log('    Waiting extra 3s for analyze callback...');
    await new Promise(r => setTimeout(r, 3000));
    
    const finalState = window.eval(`
        JSON.stringify({
            __fyModule: typeof __fyModule,
            fy: typeof fy,
            noCaptcha: typeof noCaptcha,
            NVC_Result_sessionId: NVC_Result.sessionId || 'none',
            NVC_Result_sig: NVC_Result.sig ? NVC_Result.sig.slice(0, 40) : 'none',
            NVC_Result_ncData: NVC_Result._ncData || 'none',
            getNVCVal: typeof getNVCVal === 'function' ? getNVCVal().slice(0, 100) : 'N/A',
            loaded_resources: ${JSON.stringify(loaded.length)},
            missed_resources: ${JSON.stringify(missed.slice(0, 5))},
        })
    `);
    console.log('    ', finalState);
}

main().catch(e => { console.error('Fatal:', e.message); console.error(e.stack); });
