/**
 * 阿里云智能验证码 - Node.js 补环境
 * 
 * 为 AWSC/UMID/UAB/NVC 框架提供浏览器环境模拟
 * 使用 vm 沙箱执行核心 JS 逻辑
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// ======================== Native 函数保护 ========================

/**
 * 创建看起来像浏览器原生的函数
 */
function createNativeFunction(fn, name, length) {
    const wrapped = function (...args) {
        return fn.apply(this, args);
    };
    
    Object.defineProperty(wrapped, 'name', {
        value: name || fn.name || '',
        writable: false,
        enumerable: false,
        configurable: true,
    });
    
    Object.defineProperty(wrapped, 'length', {
        value: length !== undefined ? length : fn.length,
        writable: false,
        enumerable: false,
        configurable: true,
    });
    
    wrapped.toString = function () {
        return `function ${name || fn.name || ''}() { [native code] }`;
    };
    
    Object.defineProperty(wrapped, 'toString', {
        writable: false,
        enumerable: false,
        configurable: true,
    });
    
    return wrapped;
}

function protectFunctionToString() {
    const originalToString = Function.prototype.toString;
    
    Function.prototype.toString = function () {
        if (this.hasOwnProperty('toString') && 
            typeof this.toString === 'function' &&
            this.toString !== originalToString) {
            const result = this.toString();
            if (result.includes('[native code]')) {
                return result;
            }
        }
        return originalToString.call(this);
    };
    
    Object.defineProperty(Function.prototype.toString, 'name', {
        value: 'toString',
        writable: false,
        enumerable: false,
        configurable: true,
    });
    
    Function.prototype.toString.toString = function () {
        return 'function toString() { [native code] }';
    };
}

// ======================== 浏览器环境构建 ========================

function buildBrowserEnv() {
    const env = {};
    
    // --- Navigator ---
    env.navigator = {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'Win32',
        language: 'zh-CN',
        languages: ['zh-CN', 'zh'],
        cookieEnabled: true,
        javaEnabled: createNativeFunction(function() { return false; }, 'javaEnabled', 0),
        plugins: [],
        mimeTypes: [],
        hardwareConcurrency: 8,
        vendor: 'Google Inc.',
        vendorSub: '',
        productSub: '20030107',
        appCodeName: 'Mozilla',
        appName: 'Netscape',
        appVersion: '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        onLine: true,
        maxTouchPoints: 0,
        webdriver: false,
        deviceMemory: 8,
    };
    
    // --- Screen ---
    env.screen = {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1040,
        colorDepth: 24,
        pixelDepth: 24,
    };
    
    // --- Location ---
    env.location = {
        href: 'https://promotion.aliyun.com/ntms/act/captchaIntroAndDemo.html',
        protocol: 'https:',
        host: 'promotion.aliyun.com',
        hostname: 'promotion.aliyun.com',
        port: '',
        pathname: '/ntms/act/captchaIntroAndDemo.html',
        search: '',
        hash: '',
        origin: 'https://promotion.aliyun.com',
        ancestorOrigins: {},
    };
    
    // --- History ---
    env.history = {
        length: 1,
        state: null,
        back: createNativeFunction(function() {}, 'back', 0),
        forward: createNativeFunction(function() {}, 'forward', 0),
        go: createNativeFunction(function() {}, 'go', 0),
        pushState: createNativeFunction(function() {}, 'pushState', 3),
        replaceState: createNativeFunction(function() {}, 'replaceState', 3),
    };
    
    // --- Performance ---
    const startTime = Date.now();
    env.performance = {
        now: createNativeFunction(function() { return Date.now() - startTime; }, 'now', 0),
        timing: {
            navigationStart: startTime,
            unloadEventStart: 0,
            unloadEventEnd: 0,
            redirectStart: 0,
            redirectEnd: 0,
            fetchStart: startTime,
            domainLookupStart: startTime,
            domainLookupEnd: startTime,
            connectStart: startTime,
            connectEnd: startTime,
            secureConnectionStart: 0,
            requestStart: startTime,
            responseStart: startTime,
            responseEnd: startTime,
            domLoading: startTime,
            domInteractive: startTime,
            domContentLoadedEventStart: startTime,
            domContentLoadedEventEnd: startTime,
            domComplete: startTime,
            loadEventStart: startTime,
            loadEventEnd: startTime,
        },
    };
    
    // --- Crypto ---
    env.crypto = {
        getRandomValues: createNativeFunction(function(buf) {
            const bytes = require('crypto').randomBytes(buf.length);
            for (let i = 0; i < buf.length; i++) buf[i] = bytes[i];
            return buf;
        }, 'getRandomValues', 1),
        subtle: {},
    };
    
    // --- localStorage / sessionStorage ---
    const storageData = {};
    const storageProto = {
        getItem: createNativeFunction(function(key) { return storageData[key] || null; }, 'getItem', 1),
        setItem: createNativeFunction(function(key, value) { storageData[key] = String(value); }, 'setItem', 2),
        removeItem: createNativeFunction(function(key) { delete storageData[key]; }, 'removeItem', 1),
        clear: createNativeFunction(function() { for (let k in storageData) delete storageData[k]; }, 'clear', 0),
        key: createNativeFunction(function(index) { return Object.keys(storageData)[index] || null; }, 'key', 1),
    };
    Object.defineProperty(storageProto, 'length', { get: function() { return Object.keys(storageData).length; } });
    
    env.localStorage = Object.create(storageProto);
    env.sessionStorage = Object.create(storageProto);
    
    // --- Console ---
    env.console = {
        log: function(...args) { /* silent */ },
        warn: function(...args) { /* silent */ },
        error: function(...args) { /* silent */ },
        info: function(...args) { /* silent */ },
        debug: function(...args) { /* silent */ },
    };
    
    // --- setTimeout / setInterval / clearTimeout / clearInterval ---
    env.setTimeout = createNativeFunction(setTimeout, 'setTimeout', 2);
    env.setInterval = createNativeFunction(setInterval, 'setInterval', 2);
    env.clearTimeout = createNativeFunction(clearTimeout, 'clearTimeout', 1);
    env.clearInterval = createNativeFunction(clearInterval, 'clearInterval', 1);
    
    // --- Promise ---
    env.Promise = Promise;
    
    // --- JSON ---
    env.JSON = JSON;
    
    // --- Math ---
    env.Math = Math;
    
    // --- Date ---
    env.Date = Date;
    
    // --- Error / TypeError etc. ---
    env.Error = Error;
    env.TypeError = TypeError;
    env.RangeError = RangeError;
    env.ReferenceError = ReferenceError;
    env.SyntaxError = SyntaxError;
    env.EvalError = EvalError;
    env.URIError = URIError;
    
    // --- Object / Array / String / Number / Boolean ---
    env.Object = Object;
    env.Array = Array;
    env.String = String;
    env.Number = Number;
    env.Boolean = Boolean;
    env.Function = Function;
    env.RegExp = RegExp;
    
    // --- parseInt / parseFloat ---
    env.parseInt = parseInt;
    env.parseFloat = parseFloat;
    env.isNaN = isNaN;
    env.isFinite = isFinite;
    
    // --- encodeURIComponent / decodeURIComponent ---
    env.encodeURIComponent = encodeURIComponent;
    env.decodeURIComponent = decodeURIComponent;
    env.encodeURI = encodeURI;
    env.decodeURI = decodeURI;
    
    // --- escape / unescape ---
    env.escape = escape;
    env.unescape = unescape;
    
    // --- NaN / Infinity / undefined ---
    env.NaN = NaN;
    env.Infinity = Infinity;
    env.undefined = undefined;
    
    // --- window 自引用 ---
    env.window = env;
    env.self = env;
    env.top = env;
    env.parent = env;
    env.globalThis = env;
    
    // --- document (最小实现) ---
    const scriptElements = [];
    const styleElements = [];
    
    env.document = {
        // 用于收集脚本的虚拟 DOM
        _scripts: scriptElements,
        _elements: {},
        
        createElement: createNativeFunction(function(tagName) {
            tagName = tagName.toLowerCase();
            if (tagName === 'script') {
                const script = {
                    tagName: 'SCRIPT',
                    type: '',
                    src: '',
                    async: false,
                    charset: '',
                    innerHTML: '',
                    parentNode: null,
                    onload: null,
                    onerror: null,
                    onreadystatechange: null,
                    readyState: '',
                    setAttribute: function(name, value) {
                        if (name === 'src') this.src = value;
                        if (name === 'type') this.type = value;
                    },
                    getAttribute: function(name) {
                        if (name === 'src') return this.src;
                        if (name === 'data-env') return 'cn';
                        return null;
                    },
                    hasAttribute: function(name) { return false; },
                };
                scriptElements.push(script);
                return script;
            }
            if (tagName === 'style') {
                return { tagName: 'STYLE', type: '', innerHTML: '', appendChild: function() {}, removeChild: function() {} };
            }
            if (tagName === 'canvas') {
                return createCanvasElement();
            }
            // 通用 mock 元素，支持 appendChild/removeChild/getElementById
            const el = {
                tagName: tagName.toUpperCase(),
                innerHTML: '',
                style: {},
                className: '',
                id: '',
                appendChild: function(child) { if (child && child.id) this._children.push(child); return child; },
                removeChild: function(child) { return child; },
                insertBefore: function(newChild, refChild) { return newChild; },
                setAttribute: function(name, value) { if (name === 'id') this.id = value; },
                getAttribute: function(name) { return null; },
                hasAttribute: function(name) { return false; },
                getElementById: function(id) {
                    for (let c of (this._children || [])) { if (c.id === id) return c; }
                    return null;
                },
                getElementsByTagName: function() { return []; },
                _children: [],
            };
            return el;
        }, 'createElement', 1),
        
        createElementNS: createNativeFunction(function(ns, tagName) {
            return { tagName: tagName.toUpperCase(), style: {}, setAttribute: function() {}, getAttribute: function(){ return null; }, appendChild: function() {} };
        }, 'createElementNS', 2),
        
        getElementById: createNativeFunction(function(id) {
            // 先查已注册的元素
            if (this._elements[id]) return this._elements[id];
            // 返回一个 mock 元素
            const el = {
                id: id,
                tagName: 'DIV',
                innerHTML: '',
                style: { display: '' },
                className: '',
                appendChild: function(child) { if (child && child.id) { if (!this._children) this._children = []; this._children.push(child); } return child; },
                removeChild: function(child) { return child; },
                insertBefore: function(newChild, refChild) { return newChild; },
                setAttribute: function(name, value) { if (name === 'id') this.id = value; },
                getAttribute: function(name) { return null; },
                hasAttribute: function(name) { return false; },
                getElementById: function(id) {
                    for (let c of (this._children || [])) { if (c.id === id) return c; }
                    return null;
                },
                getElementsByTagName: function() { return []; },
                _children: [],
            };
            this._elements[id] = el;
            return el;
        }, 'getElementById', 1),
        getElementsByTagName: createNativeFunction(function(tagName) {
            tagName = tagName.toLowerCase();
            if (tagName === 'script') {
                return {
                    length: scriptElements.length,
                    0: scriptElements[scriptElements.length - 1] || null,
                    item: function(i) { return scriptElements[i] || null; },
                };
            }
            if (tagName === 'head') {
                return [this.head];
            }
            if (tagName === 'body') {
                return [this.body];
            }
            return [];
        }, 'getElementsByTagName', 1),
        getElementsByClassName: createNativeFunction(function() { return []; }, 'getElementsByClassName', 1),
        querySelector: createNativeFunction(function() { return null; }, 'querySelector', 1),
        querySelectorAll: createNativeFunction(function() { return []; }, 'querySelectorAll', 1),
        
        head: { appendChild: function() {}, removeChild: function() {}, getElementsByTagName: function() { return []; } },
        body: { appendChild: function() {}, removeChild: function() {}, getElementById: function() { return null; }, getElementsByTagName: function() { return []; } },
        documentElement: {
            style: {},
            scrollTop: 0,
            scrollLeft: 0,
        },
        
        cookie: '',
        referrer: '',
        title: '验证码产品介绍及试用 - 阿里云',
        domain: 'promotion.aliyun.com',
        URL: 'https://promotion.aliyun.com/ntms/act/captchaIntroAndDemo.html',
        charset: 'UTF-8',
        characterSet: 'UTF-8',
        readyState: 'complete',
        hidden: false,
        visibilityState: 'visible',
        
        addEventListener: createNativeFunction(function() {}, 'addEventListener', 2),
        removeEventListener: createNativeFunction(function() {}, 'removeEventListener', 2),
        createEvent: createNativeFunction(function() { return { initEvent: function() {} }; }, 'createEvent', 1),
        dispatchEvent: createNativeFunction(function() { return true; }, 'dispatchEvent', 1),
        
        currentScript: null,
    };
    
    // --- Canvas 模拟 ---
    function createCanvasElement() {
        const canvas = {
            tagName: 'CANVAS',
            width: 220,
            height: 30,
            style: {},
            getContext: createNativeFunction(function(contextType) {
                if (contextType === '2d') {
                    return create2DContext();
                }
                if (contextType === 'webgl' || contextType === 'experimental-webgl') {
                    return createWebGLContext();
                }
                return null;
            }, 'getContext', 1),
            toDataURL: createNativeFunction(function() {
                return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANwAAAAeCAYAAAAHp4yfAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAZdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuMTJDBtYAAAAiSURBVFhHYxgFo2AUjIJRMApGwSgYBaNgWAMGABzFgBEqMThCAAAAAElFTkSuQmCC';
            }, 'toDataURL', 0),
            toBlob: createNativeFunction(function(callback) {
                callback(new (env.Blob || Object)([''], {type: 'image/png'}));
            }, 'toBlob', 1),
            setAttribute: function() {},
            getAttribute: function() { return null; },
        };
        return canvas;
    }
    
    function create2DContext() {
        const ctx = {
            fillStyle: '#000000',
            strokeStyle: '#000000',
            font: '10px sans-serif',
            textBaseline: 'alphabetic',
            textAlign: 'start',
            globalAlpha: 1.0,
            globalCompositeOperation: 'source-over',
            
            fillRect: createNativeFunction(function() {}, 'fillRect', 4),
            strokeRect: createNativeFunction(function() {}, 'strokeRect', 4),
            clearRect: createNativeFunction(function() {}, 'clearRect', 4),
            fillText: createNativeFunction(function() {}, 'fillText', 3),
            strokeText: createNativeFunction(function() {}, 'strokeText', 3),
            measureText: createNativeFunction(function(text) {
                return { width: text.length * 6, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 };
            }, 'measureText', 1),
            
            beginPath: createNativeFunction(function() {}, 'beginPath', 0),
            closePath: createNativeFunction(function() {}, 'closePath', 0),
            moveTo: createNativeFunction(function() {}, 'moveTo', 2),
            lineTo: createNativeFunction(function() {}, 'lineTo', 2),
            arc: createNativeFunction(function() {}, 'arc', 5),
            arcTo: createNativeFunction(function() {}, 'arcTo', 5),
            bezierCurveTo: createNativeFunction(function() {}, 'bezierCurveTo', 6),
            quadraticCurveTo: createNativeFunction(function() {}, 'quadraticCurveTo', 4),
            rect: createNativeFunction(function() {}, 'rect', 4),
            fill: createNativeFunction(function() {}, 'fill', 0),
            stroke: createNativeFunction(function() {}, 'stroke', 0),
            clip: createNativeFunction(function() {}, 'clip', 0),
            
            save: createNativeFunction(function() {}, 'save', 0),
            restore: createNativeFunction(function() {}, 'restore', 0),
            scale: createNativeFunction(function() {}, 'scale', 2),
            rotate: createNativeFunction(function() {}, 'rotate', 1),
            translate: createNativeFunction(function() {}, 'translate', 2),
            transform: createNativeFunction(function() {}, 'transform', 6),
            setTransform: createNativeFunction(function() {}, 'setTransform', 6),
            
            createLinearGradient: createNativeFunction(function() { return { addColorStop: function() {} }; }, 'createLinearGradient', 4),
            createRadialGradient: createNativeFunction(function() { return { addColorStop: function() {} }; }, 'createRadialGradient', 6),
            createPattern: createNativeFunction(function() { return {}; }, 'createPattern', 2),
            
            drawImage: createNativeFunction(function() {}, 'drawImage', 3),
            createImageData: createNativeFunction(function() { return { data: new Uint8Array(0) }; }, 'createImageData', 2),
            getImageData: createNativeFunction(function() { return { data: new Uint8Array(0) }; }, 'getImageData', 4),
            putImageData: createNativeFunction(function() {}, 'putImageData', 3),
            
            getLineDash: createNativeFunction(function() { return []; }, 'getLineDash', 0),
            setLineDash: createNativeFunction(function() {}, 'setLineDash', 1),
            
            isPointInPath: createNativeFunction(function() { return false; }, 'isPointInPath', 2),
            isPointInStroke: createNativeFunction(function() { return false; }, 'isPointInStroke', 2),
        };
        
        // 让所有函数返回 [native code]
        // 已经通过 createNativeFunction 处理
        
        return ctx;
    }
    
    function createWebGLContext() {
        const gl = {
            VENDOR: 0x1F00,
            RENDERER: 0x1F01,
            VERSION: 0x1F02,
            
            getParameter: createNativeFunction(function(pname) {
                if (pname === 0x1F00) return 'WebKit';  // VENDOR
                if (pname === 0x1F01) return 'WebKit WebGL';  // RENDERER
                if (pname === 0x1F02) return 'WebGL 1.0';  // VERSION
                return null;
            }, 'getParameter', 1),
            
            getExtension: createNativeFunction(function(name) {
                return null;
            }, 'getExtension', 1),
            
            getSupportedExtensions: createNativeFunction(function() {
                return [];
            }, 'getSupportedExtensions', 0),
            
            createShader: createNativeFunction(function() { return {}; }, 'createShader', 1),
            createProgram: createNativeFunction(function() { return {}; }, 'createProgram', 0),
            createBuffer: createNativeFunction(function() { return {}; }, 'createBuffer', 0),
            createTexture: createNativeFunction(function() { return {}; }, 'createTexture', 0),
            
            bindBuffer: createNativeFunction(function() {}, 'bindBuffer', 2),
            bindTexture: createNativeFunction(function() {}, 'bindTexture', 2),
            bufferData: createNativeFunction(function() {}, 'bufferData', 3),
            
            viewport: createNativeFunction(function() {}, 'viewport', 4),
            clear: createNativeFunction(function() {}, 'clear', 1),
            clearColor: createNativeFunction(function() {}, 'clearColor', 4),
        };
        return gl;
    }
    
    // --- XMLHttpRequest ---
    env.XMLHttpRequest = function() {
        this.readyState = 0;
        this.status = 0;
        this.responseText = '';
        this.onreadystatechange = null;
        this.onload = null;
        this.onerror = null;
    };
    env.XMLHttpRequest.prototype.open = createNativeFunction(function(method, url) {
        this._method = method;
        this._url = url;
    }, 'open', 2);
    env.XMLHttpRequest.prototype.send = createNativeFunction(function() {}, 'send', 1);
    env.XMLHttpRequest.prototype.setRequestHeader = createNativeFunction(function() {}, 'setRequestHeader', 2);
    env.XMLHttpRequest.prototype.getResponseHeader = createNativeFunction(function() { return null; }, 'getResponseHeader', 1);
    env.XMLHttpRequest.UNSENT = 0;
    env.XMLHttpRequest.OPENED = 1;
    env.XMLHttpRequest.HEADERS_RECEIVED = 2;
    env.XMLHttpRequest.LOADING = 3;
    env.XMLHttpRequest.DONE = 4;
    
    // --- fetch ---
    env.fetch = createNativeFunction(function(url, options) {
        // 简化模拟
        return Promise.resolve({
            ok: true,
            status: 200,
            json: function() { return Promise.resolve({}); },
            text: function() { return Promise.resolve(''); },
        });
    }, 'fetch', 1);
    
    // --- Image ---
    env.Image = function() {
        return {
            src: '',
            onload: null,
            onerror: null,
            width: 0,
            height: 0,
        };
    };
    
    // --- atob / btoa ---
    env.atob = createNativeFunction(function(str) {
        return Buffer.from(str, 'base64').toString('binary');
    }, 'atob', 1);
    env.btoa = createNativeFunction(function(str) {
        return Buffer.from(str, 'binary').toString('base64');
    }, 'btoa', 1);
    
    // --- Blob ---
    env.Blob = function(parts, options) {
        this.type = (options && options.type) || '';
        this.size = 0;
    };
    
    // --- Event ---
    env.Event = function(type) { this.type = type; };
    
    // --- addEventListener (document level) ---
    env.addEventListener = createNativeFunction(function() {}, 'addEventListener', 2);
    env.removeEventListener = createNativeFunction(function() {}, 'removeEventListener', 2);
    env.dispatchEvent = createNativeFunction(function() { return true; }, 'dispatchEvent', 1);
    
    // --- innerWidth / innerHeight ---
    Object.defineProperty(env, 'innerWidth', { value: 1920, writable: true, enumerable: true, configurable: true });
    Object.defineProperty(env, 'innerHeight', { value: 1040, writable: true, enumerable: true, configurable: true });
    Object.defineProperty(env, 'outerWidth', { value: 1920, writable: true, enumerable: true, configurable: true });
    Object.defineProperty(env, 'outerHeight', { value: 1080, writable: true, enumerable: true, configurable: true });
    Object.defineProperty(env, 'devicePixelRatio', { value: 1, writable: true, enumerable: true, configurable: true });
    
    // --- pageXOffset / pageYOffset ---
    env.pageXOffset = 0;
    env.pageYOffset = 0;
    env.scrollX = 0;
    env.scrollY = 0;
    
    // --- name ---
    env.name = '';
    
    // --- AWSC 框架模拟 (预先设置) ---
    // AWSC 框架加载后，会提供 AWSC.use() 来加载 UMID/UAB 等模块
    // 我们预先设置好模拟的模块数据，等 AWSC 加载后自动可用
    env._awsc_modules = {
        um: {
            init: createNativeFunction(function(options, callback) {
                // 模拟 UMID 初始化
                // 在实际浏览器中，这会收集设备指纹并调用服务端
                const umidToken = 'T2gAN1aK3-9TiQojDSmVJjMav4zTVhxSN9h1xwxDt48ePO7op1nCGKuNXhUHqMPBRv4=';
                setTimeout(function() {
                    callback('success', { tn: umidToken });
                }, 100);
            }, 'init', 2),
        },
        uab: {
            getUA: createNativeFunction(function(options) {
                // 模拟 UAB 数据 - 返回一个类似于真实浏览器采集的指纹数据
                // 格式: "版本号#base64编码的数据"
                const uabData = '140#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';
                return uabData;
            }, 'getUA', 1),
        },
    };
    
    // 预设置 __nvc_uaboption (UAB 配置)
    env.__nvc_uaboption = {
        MPInterval: 4,
        MMInterval: 5,
        MaxMCLog: 12,
        MaxKSLog: 14,
        MaxMPLog: 5,
        MaxFocusLog: 6,
        SendInterval: 5,
        SendMethod: 8,
        GPInterval: 50,
        MaxGPLog: 1,
        MaxTCLog: 12,
        Flag: 3767502,
        OnlyHost: 1,
        MaxMTLog: 500,
        MinMTDwnLog: 30,
        MaxNGPLog: 1,
    };
    
    return env;
}

// ======================== 执行 JS 代码 ========================

function createVMContext(browserEnv) {
    // 将所有浏览器属性复制到上下文
    const ctx = {};
    for (const key in browserEnv) {
        ctx[key] = browserEnv[key];
    }
    
    // 特殊处理 window 自引用
    ctx.window = ctx;
    ctx.self = ctx;
    
    vm.createContext(ctx);
    return ctx;
}

function executeInContext(code, ctx, filename = 'script.js') {
    try {
        return vm.runInContext(code, ctx, {
            filename: filename,
            timeout: 30000,
        });
    } catch (e) {
        console.error(`Error executing ${filename}:`, e.message);
        throw e;
    }
}

module.exports = {
    createNativeFunction,
    protectFunctionToString,
    buildBrowserEnv,
    createVMContext,
    executeInContext,
};
