/**
 * 小红书 x-s 签名生成 - 完整补环境版本
 * 基于 seccore_signv2 函数
 */

const fs = require('fs');

// ==================== 第一部分: 参数感知型 Watch 监控框架 ====================

/**
 * 原生伪装函数
 */
function managerNative(fn, name) {
    const fake = function () { 
        return `function ${name || fn.name || 'anonymous'}() { [native code] }`; 
    };
    Object.defineProperty(fn, 'toString', {
        value: fake,
        configurable: true, 
        enumerable: false, 
        writable: true
    });
    return fn;
}

/**
 * 参数感知型监控代理
 * 功能: 属性访问日志 + 函数调用参数捕获 + toString伪造 + 递归监听
 */
function watch(obj, name) {
    if (typeof obj !== 'object' || obj === null) return obj;

    const SYMBOL_PROXY = Symbol("isProxy");
    if (obj[SYMBOL_PROXY]) return obj;

    return new Proxy(obj, {
        get: function (target, property, receiver) {
            let value;
            try {
                value = target[property];
                const type = typeof value;

                // 日志输出 (过滤干扰项)
                if (typeof property !== 'symbol' && !property.startsWith('_')) {
                    console.log(`[读取] => ${name}.${String(property)}, 值为: ${type === 'function' ? '[native code]' : String(value)}, 类型: ${type}`);
                }

                // 函数拦截：记录入参
                if (type === "function") {
                    return function (...args) {
                        console.log(`[参数调用] => ${name}.${String(property)}(${args.map(a => typeof a === 'object' ? JSON.stringify(a).substring(0, 100) : String(a)).join(', ')})`);
                        
                        const result = value.apply(this, args);

                        // 结果缺失告警
                        if (result === undefined || result === null) {
                            console.log(`[MISSING] => ${name}.${String(property)} 返回 undefined`);
                        }

                        return result;
                    };
                }
            } catch (e) {
                console.log(`[异常] => ${name}.${String(property)}: ${e.message}`);
            }

            // 递归监听
            if (value !== null && typeof value === 'object') {
                return watch(value, `${name}.${String(property)}`);
            }
            return value;
        },
        set: (target, property, newValue) => {
            console.log(`[设置] => ${name}.${String(property)}, 值为: ${typeof newValue}`);
            return Reflect.set(target, property, newValue);
        }
    });
}

// ==================== 第二部分: 完整环境补全 ====================

// 基础全局对象
if (typeof window === 'undefined') {
    window = globalThis;
}
if (typeof global === 'undefined') {
    global = window;
}
if (typeof self === 'undefined') {
    self = window;
}

// 基础构造函数
window.Function = Function;
window.Object = Object;
window.Array = Array;
window.String = String;
window.Number = Number;
window.Boolean = Boolean;
window.Date = Date;
window.Math = Math;
window.JSON = JSON;
window.parseInt = parseInt;
window.parseFloat = parseFloat;
window.RegExp = RegExp;
window.Error = Error;
window.TypeError = TypeError;
window.SyntaxError = SyntaxError;
window.ReferenceError = ReferenceError;
window.encodeURI = encodeURI;
window.decodeURI = decodeURI;
window.encodeURIComponent = encodeURIComponent;
window.decodeURIComponent = decodeURIComponent;
window.btoa = function(str) { return Buffer.from(str, 'binary').toString('base64'); };
window.atob = function(str) { return Buffer.from(str, 'base64').toString('binary'); };

// document 对象 - 参数分支处理
function HTMLDocument() {
    this.cookie = '';
    this.hidden = false;
    this.currentScript = null;
    this.referrer = 'https://www.xiaohongshu.com/';
}

Object.defineProperty(HTMLDocument.prototype, 'createElement', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: function createElement(tagName) {
        console.log(`[参数调用] => document.createElement('${tagName}')`);
        const tag = String(tagName).toLowerCase();
        
        // 根据入参返回不同的实例
        if (tag === 'canvas') return window._canvasInstance;
        if (tag === 'script') return window._scriptInstance;
        if (tag === 'div') return window._divInstance;
        if (tag === 'style') return window._styleInstance;
        if (tag === 'audio') return window._audioInstance;
        if (tag === 'span') return window._spanInstance;
        
        return {};
    }
});

Object.defineProperty(HTMLDocument.prototype, 'querySelector', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: function querySelector(selector) {
        console.log(`[参数调用] => document.querySelector('${selector}')`);
        return null;
    }
});

Object.defineProperty(HTMLDocument.prototype, 'getElementById', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: function getElementById(id) {
        console.log(`[参数调用] => document.getElementById('${id}')`);
        return null;
    }
});

document = new HTMLDocument();
document = watch(document, 'document');

// Canvas 实例 (预创建)
function HTMLCanvasElement() {
    this.width = 300;
    this.height = 150;
    this.style = {};
}

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: function getContext(contextId) {
        console.log(`[参数调用] => canvas.getContext('${contextId}')`);
        if (contextId === '2d') return window._canvas2dContext;
        if (contextId === 'webgl') return window._webglContext;
        return null;
    }
});

Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: function toDataURL(type, encoderOptions) {
        console.log(`[参数调用] => canvas.toDataURL('${type}', ${encoderOptions})`);
        return 'data:image/png;base64,fake';
    }
});

window._canvasInstance = new HTMLCanvasElement();
window._canvasInstance = watch(window._canvasInstance, 'canvas');

// Canvas 2D 上下文
function CanvasRenderingContext2D() {
    this.direction = "ltr";
    this.fillStyle = "#000000";
    this.filter = "none";
    this.font = "10px sans-serif";
    this.globalAlpha = 1;
    this.lineWidth = 1;
    this.lineCap = "butt";
    this.lineJoin = "miter";
    this.miterLimit = 10;
    this.shadowBlur = 0;
    this.shadowColor = "rgba(0, 0, 0, 0)";
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this.strokeStyle = "#000000";
    this.textAlign = "start";
    this.textBaseline = "alphabetic";
}

Object.defineProperty(CanvasRenderingContext2D.prototype, 'fillText', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: function fillText(text, x, y, maxWidth) {
        console.log(`[参数调用] => ctx.fillText('${text}', ${x}, ${y}, ${maxWidth})`);
    }
});

Object.defineProperty(CanvasRenderingContext2D.prototype, 'measureText', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: function measureText(text) {
        console.log(`[参数调用] => ctx.measureText('${text}')`);
        return { width: 100 };
    }
});

window._canvas2dContext = new CanvasRenderingContext2D();
window._canvas2dContext = watch(window._canvas2dContext, 'canvas2d');

// WebGL 上下文
function WebGLRenderingContext() {
    this.drawingBufferColorSpace = "srgb";
    this.drawingBufferHeight = 150;
    this.drawingBufferWidth = 300;
}

Object.defineProperty(WebGLRenderingContext.prototype, 'getParameter', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: function getParameter(pname) {
        console.log(`[参数调用] => webgl.getParameter(${pname})`);
        return null;
    }
});

Object.defineProperty(WebGLRenderingContext.prototype, 'getExtension', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: function getExtension(extensionName) {
        console.log(`[参数调用] => webgl.getExtension('${extensionName}')`);
        if (extensionName === 'WEBGL_debug_renderer_info') {
            return {
                UNMASKED_VENDOR_WEBGL: 'Google Inc.',
                UNMASKED_RENDERER_WEBGL: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)'
            };
        }
        return null;
    }
});

window._webglContext = new WebGLRenderingContext();
window._webglContext = watch(window._webglContext, 'webgl');

// 其他 DOM 元素实例
window._scriptInstance = watch({ src: '', text: '', innerHTML: '' }, 'script');
window._divInstance = watch({ innerHTML: '', style: {}, appendChild: function(){} }, 'div');
window._styleInstance = watch({ textContent: '', innerHTML: '' }, 'style');
window._audioInstance = watch({ canPlayType: function() { return ''; } }, 'audio');
window._spanInstance = watch({ innerHTML: '' }, 'span');

// navigator 对象
navigator = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    platform: "Win32",
    language: "zh-CN",
    languages: ["zh-CN", "zh", "en"],
    hardwareConcurrency: 20,
    deviceMemory: 8,
    cookieEnabled: true,
    onLine: true,
    appVersion: "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    appName: "Netscape",
    appCodeName: "Mozilla",
    oscpu: "Windows NT 10.0; Win64; x64",
    vendor: "Google Inc.",
    vendorSub: "",
    product: "Gecko",
    productSub: "20030107",
    pdfViewerEnabled: true
};
navigator = watch(navigator, 'navigator');

// location 对象
location = {
    href: "https://www.xiaohongshu.com/explore?channel_id=homefeed.fashion_v3",
    origin: "https://www.xiaohongshu.com",
    protocol: "https:",
    host: "www.xiaohongshu.com",
    hostname: "www.xiaohongshu.com",
    port: "",
    pathname: "/explore",
    search: "?channel_id=homefeed.fashion_v3",
    hash: ""
};
location = watch(location, 'location');

// screen 对象
screen = {
    availHeight: 1040,
    availWidth: 1920,
    availLeft: 0,
    availTop: 0,
    colorDepth: 24,
    pixelDepth: 24,
    width: 1920,
    height: 1080,
    orientation: {
        type: 'landscape-primary',
        angle: 0
    }
};
screen = watch(screen, 'screen');

// performance 对象
performance = {
    now: function() {
        console.log('[参数调用] => performance.now()');
        return Date.now();
    },
    timing: {
        navigationStart: Date.now(),
        loadEventEnd: 0,
        loadEventStart: 0,
        domComplete: 0,
        domContentLoadedEventEnd: 0,
        domContentLoadedEventStart: 0,
        domInteractive: 0,
        domLoading: 0
    },
    timeOrigin: Date.now()
};
performance = watch(performance, 'performance');

// localStorage / sessionStorage
localStorage = {
    getItem: function(key) { 
        console.log(`[参数调用] => localStorage.getItem('${key}')`);
        return null; 
    },
    setItem: function(key, value) { 
        console.log(`[参数调用] => localStorage.setItem('${key}', '${value}')`);
    },
    removeItem: function(key) {
        console.log(`[参数调用] => localStorage.removeItem('${key}')`);
    }
};
localStorage = watch(localStorage, 'localStorage');

sessionStorage = {
    getItem: function(key) { 
        console.log(`[参数调用] => sessionStorage.getItem('${key}')`);
        return null; 
    },
    setItem: function(key, value) { 
        console.log(`[参数调用] => sessionStorage.setItem('${key}', '${value}')`);
    },
    removeItem: function(key) {
        console.log(`[参数调用] => sessionStorage.removeItem('${key}')`);
    }
};
sessionStorage = watch(sessionStorage, 'sessionStorage');

// MutationObserver
window.MutationObserver = undefined;

// 其他全局函数
window.setTimeout = setTimeout;
window.clearTimeout = clearTimeout;
window.setInterval = setInterval;
window.clearInterval = clearInterval;
window.requestAnimationFrame = function(cb) { return setTimeout(cb, 16); };
window.cancelAnimationFrame = function(id) { clearTimeout(id); };

// ==================== 第三部分: 加载并导出加密代码 ====================

console.log('\n=== 开始加载安全脚本 ===\n');

// 加载 security_2.js (包含 mnsv2 的 JSVMP)
const security2Code = fs.readFileSync('./security_2.js', 'utf-8');

try {
    console.log('执行 security_2.js...');
    eval(security2Code);
    
    console.log('\n✅ security_2.js 执行成功!');
    console.log('\n检查导出的函数:');
    
    // 检查关键函数
    if (window._AUuXfEG27Xa3x) {
        console.log('  ✅ _AUuXfEG27Xa3x (JSVMP 主函数)');
    }
    
    if (window.mnsv2) {
        console.log('  ✅ mnsv2 (核心加密函数)');
    } else {
        console.log('  ⚠️  mnsv2 未找到,可能需要手动调用 _AUuXfEG27Xa3x');
    }
    
    if (window.__bc) {
        console.log('  ✅ __bc (字节码数据)');
    }
    
    // 列出所有新增的全局对象
    console.log('\n=== 新增的全局对象/函数 ===');
    const skipKeys = new Set([
        'global', 'GLOBAL', 'root', 'require', 'module', 'exports', 
        '__dirname', '__filename', 'process', 'Buffer', 'console',
        'window', 'document', 'navigator', 'location', 'screen', 
        'performance', 'localStorage', 'sessionStorage'
    ]);
    
    Object.keys(global).forEach(key => {
        if (!skipKeys.has(key) && !key.startsWith('_0x')) {
            const type = typeof global[key];
            if (type === 'function' || (type === 'object' && global[key] !== null)) {
                console.log(`  - ${key}: ${type}`);
            }
        }
    });
    
    // 导出模块
    module.exports = {
        window: window,
        mnsv2: window.mnsv2,
        seccore_signv2: window.seccore_signv2,
        generateXS: function(e, a) {
            // 实现 seccore_signv2 逻辑
            if (window.seccore_signv2) {
                return window.seccore_signv2(e, a);
            }
            throw new Error('seccore_signv2 未找到');
        }
    };
    
    console.log('\n✅ 模块导出成功!');
    
} catch (error) {
    console.error(`\n❌ 执行出错: ${error.message}`);
    console.error(`错误类型: ${error.constructor.name}`);
    if (error.stack) {
        console.error('\n错误堆栈 (前10行):');
        console.error(error.stack.split('\n').slice(0, 10).join('\n'));
    }
}
