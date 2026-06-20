/**
 * 最小浏览器环境补全 - 用于在 Node.js 中运行极验 captcha.js
 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

function createBrowserEnv() {
    const env = {
        window: {},
        document: {
            createElement: function(tag) {
                const el = {
                    tagName: tag.toUpperCase(),
                    style: {},
                    attributes: {},
                    children: [],
                    setAttribute: function(k, v) { this.attributes[k] = v; },
                    getAttribute: function(k) { return this.attributes[k]; },
                    appendChild: function(c) { this.children.push(c); },
                    removeChild: function(c) {
                        const idx = this.children.indexOf(c);
                        if (idx > -1) this.children.splice(idx, 1);
                    },
                    addEventListener: function() {},
                    removeEventListener: function() {},
                    getContext: function(type) {
                        if (type === '2d') {
                            return {
                                fillRect: function() {},
                                clearRect: function() {},
                                getImageData: function() { return { data: [] }; },
                                fillText: function() {},
                                drawImage: function() {},
                                measureText: function() { return { width: 0 }; }
                            };
                        }
                        return null;
                    },
                    toDataURL: function() { return 'data:image/png;base64,'; }
                };
                return el;
            },
            getElementsByTagName: function(tag) {
                if (tag === 'head') return [this.head];
                if (tag === 'body') return [this.body];
                return [];
            },
            getElementById: function(id) { return null; },
            querySelector: function() { return null; },
            querySelectorAll: function() { return []; },
            head: { appendChild: function() {}, removeChild: function() {} },
            body: { appendChild: function() {}, removeChild: function() {}, style: {} },
            documentElement: { style: {}, clientWidth: 1920, clientHeight: 1080 },
            location: {
                href: 'https://cpcloud.crv.com.cn/web/fea-vsmp/login',
                protocol: 'https:',
                host: 'cpcloud.crv.com.cn',
                hostname: 'cpcloud.crv.com.cn',
                pathname: '/web/fea-vsmp/login',
                port: '',
                search: ''
            },
            referrer: 'https://cpcloud.crv.com.cn/',
            cookie: '',
            title: '华润万家供应商服务系统',
            addEventListener: function() {},
            removeEventListener: function() {},
            createTextNode: function(text) { return { textContent: text }; }
        },
        navigator: {
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
            plugins: [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
            ],
            mimeTypes: [
                { type: 'application/pdf', suffixes: 'pdf', enabledPlugin: {} },
                { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', enabledPlugin: {} }
            ]
        },
        location: {
            href: 'https://cpcloud.crv.com.cn/web/fea-vsmp/login',
            protocol: 'https:',
            host: 'cpcloud.crv.com.cn',
            hostname: 'cpcloud.crv.com.cn',
            pathname: '/web/fea-vsmp/login',
            port: '',
            search: ''
        },
        screen: {
            width: 1920,
            height: 1080,
            availWidth: 1920,
            availHeight: 1040,
            colorDepth: 24,
            pixelDepth: 24
        },
        history: { pushState: function() {}, replaceState: function() {} },
        console: console,
        setTimeout: setTimeout,
        setInterval: setInterval,
        clearTimeout: clearTimeout,
        clearInterval: clearInterval,
        alert: function() {},
        confirm: function() { return true; },
        prompt: function() { return ''; },
        btoa: function(str) { return Buffer.from(str, 'binary').toString('base64'); },
        atob: function(str) { return Buffer.from(str, 'base64').toString('binary'); },
        encodeURIComponent: encodeURIComponent,
        decodeURIComponent: decodeURIComponent,
        JSON: JSON,
        Math: Math,
        Date: Date,
        parseInt: parseInt,
        parseFloat: parseFloat,
        isNaN: isNaN,
        isFinite: isFinite,
        RegExp: RegExp,
        String: String,
        Number: Number,
        Array: Array,
        Object: Object,
        Function: Function,
        Error: Error,
        TypeError: TypeError,
        SyntaxError: SyntaxError,
        RangeError: RangeError,
        ReferenceError: ReferenceError,
        eval: eval,
        performance: {
            now: function() { return Date.now(); },
            timing: {
                navigationStart: Date.now(),
                unloadEventStart: 0,
                unloadEventEnd: 0,
                redirectStart: 0,
                redirectEnd: 0,
                fetchStart: Date.now(),
                domainLookupStart: Date.now(),
                domainLookupEnd: Date.now(),
                connectStart: Date.now(),
                connectEnd: Date.now(),
                secureConnectionStart: Date.now(),
                requestStart: Date.now(),
                responseStart: Date.now(),
                responseEnd: Date.now(),
                domLoading: Date.now(),
                domInteractive: Date.now(),
                domContentLoadedEventStart: Date.now(),
                domContentLoadedEventEnd: Date.now(),
                domComplete: Date.now(),
                loadEventStart: Date.now(),
                loadEventEnd: Date.now()
            }
        },
        XMLHttpRequest: class FakeXHR {
            constructor() {
                this.headers = {};
                this._url = '';
                this._method = 'GET';
            }
            open(method, url) {
                this._method = method;
                this._url = url;
            }
            setRequestHeader(key, value) {
                this.headers[key] = value;
            }
            send(body) {
                // 在真实环境中需要实现请求发送
                console.log('[FakeXHR]', this._method, this._url);
            }
            getResponseHeader() { return null; }
            getAllResponseHeaders() { return ''; }
        },
        localStorage: {
            _data: {},
            getItem: function(k) { return this._data[k] || null; },
            setItem: function(k, v) { this._data[k] = String(v); },
            removeItem: function(k) { delete this._data[k]; },
            clear: function() { this._data = {}; }
        },
        sessionStorage: {
            _data: {},
            getItem: function(k) { return this._data[k] || null; },
            setItem: function(k, v) { this._data[k] = String(v); },
            removeItem: function(k) { delete this._data[k]; },
            clear: function() { this._data = {}; }
        }
    };

    // 循环引用
    env.window = env;
    env.document.defaultView = env;
    env.document.location = env.location;

    // 全局 self / top / parent
    env.self = env;
    env.top = env;
    env.parent = env;

    return env;
}

function runCaptcha(env, captchaCode, gctCode) {
    const context = vm.createContext(env);

    try {
        console.log('[Env] Running gct.js...');
        vm.runInContext(gctCode, context, { timeout: 5000 });
        console.log('[Env] gct.js executed successfully');
    } catch (e) {
        console.log('[Env] gct.js error:', e.message);
    }

    try {
        console.log('[Env] Running captcha.js...');
        vm.runInContext(captchaCode, context, { timeout: 10000 });
        console.log('[Env] captcha.js executed successfully');
    } catch (e) {
        console.log('[Env] captcha.js error:', e.message);
    }

    return context;
}

// 测试
const captchaPath = path.join(__dirname, '..', 'assets', 'captcha.js');
const gctPath = path.join(__dirname, '..', 'assets', 'gct.js');

if (fs.existsSync(captchaPath) && fs.existsSync(gctPath)) {
    const captchaCode = fs.readFileSync(captchaPath, 'utf-8');
    const gctCode = fs.readFileSync(gctPath, 'utf-8');
    const env = createBrowserEnv();
    const context = runCaptcha(env, captchaCode, gctCode);

    console.log('[Check] Geetest exists:', typeof context.Geetest !== 'undefined');
    console.log('[Check] initGeetest exists:', typeof context.initGeetest !== 'undefined');
} else {
    console.log('[Env] captcha.js or gct.js not found, skipping test');
}

module.exports = { createBrowserEnv, runCaptcha };
