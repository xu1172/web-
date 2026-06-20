// Minimal browser environment stub for PDD risk-control crawler (chunk_3636 module 53636).
// Exports a function that installs stubs onto the given sandbox object.

function install(win) {
  win.navigator = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    platform: 'iPhone', language: 'zh-CN', languages: ['zh-CN', 'zh', 'en'],
    hardwareConcurrency: 4, deviceMemory: 4, maxTouchPoints: 5,
    plugins: [], mimeTypes: [], cookieEnabled: true, doNotTrack: null,
    vendor: 'Apple Computer, Inc.', product: 'Gecko', productSub: '20030107',
    appName: 'Netscape', appVersion: '5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
    appCodeName: 'Mozilla', onLine: true, webdriver: false,
    connection: { effectiveType: '4g', rtt: 50, downlink: 10, saveData: false },
    getBattery: () => Promise.resolve({ charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1 }),
    permissions: { query: () => Promise.resolve({ state: 'granted' }) },
    serviceWorker: { register: () => Promise.resolve({}), ready: Promise.resolve({}) },
    sendBeacon: () => true,
  };

  win.location = {
    href: 'https://mobile.yangkeduo.com/', origin: 'https://mobile.yangkeduo.com',
    host: 'mobile.yangkeduo.com', hostname: 'mobile.yangkeduo.com', protocol: 'https:',
    pathname: '/', search: '', hash: '', ancestorOrigins: { length: 0 },
    assign: () => {}, replace: () => {}, reload: () => {},
    toString() { return this.href; },
  };

  function makeEl(tag) {
    return {
      tagName: String(tag || 'div').toUpperCase(), nodeName: String(tag || 'div').toUpperCase(), nodeType: 1,
      style: {}, children: [], childNodes: [], attributes: {}, dataset: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false, replace: () => {} },
      getContext: (t) => t === '2d' ? {
        fillRect: () => {}, fillText: () => {}, strokeText: () => {}, beginPath: () => {},
        arc: () => {}, closePath: () => {}, stroke: () => {}, fill: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(400), width: 10, height: 10 }),
        putImageData: () => {}, measureText: () => ({ width: 50 }), save: () => {}, restore: () => {},
        translate: () => {}, rotate: () => {}, scale: () => {}, drawImage: () => {}, createLinearGradient: () => ({ addColorStop: () => {} }),
      } : t === 'webgl' || t === 'experimental-webgl' ? {
        getParameter: () => 'Apple GPU', getSupportedExtensions: () => ['WEBGL_debug_renderer_info'],
        getExtension: () => ({ UNMASKED_VENDOR_WEBGL: 37445, UNMASKED_RENDERER_WEBGL: 37446 }),
      } : null,
      toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=',
      width: 300, height: 150,
      setAttribute: function (k, v) { this.attributes[k] = v; },
      getAttribute: function (k) { return this.attributes[k] != null ? this.attributes[k] : null; },
      removeAttribute: function (k) { delete this.attributes[k]; },
      hasAttribute: function (k) { return k in this.attributes; },
      appendChild: function (c) { this.childNodes.push(c); this.children.push(c); return c; },
      removeChild: function (c) { const i = this.childNodes.indexOf(c); if (i >= 0) { this.childNodes.splice(i, 1); this.children.splice(i, 1); } return c; },
      insertBefore: function (c) { this.childNodes.push(c); this.children.push(c); return c; },
      cloneNode: function () { return makeEl(this.tagName); },
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }),
      querySelector: () => null, querySelectorAll: () => [],
      getElementsByTagName: () => [], getElementsByClassName: () => [],
      focus: () => {}, blur: () => {}, click: () => {},
      innerHTML: '', outerHTML: '', innerText: '', textContent: '',
      contains: () => false,
      parentNode: null, parentElement: null, firstChild: null, lastChild: null, nextSibling: null, previousSibling: null,
      ownerDocument: null,
    };
  }
  const htmlEl = makeEl('html'), bodyEl = makeEl('body'), headEl = makeEl('head');
  htmlEl.appendChild(headEl); htmlEl.appendChild(bodyEl);

  win.document = {
    cookie: 'api_uid=CiPDWmnxoi2x4gCXYYK+Ag==; _nano_fp=Xpm8nqTYXqX8n0XYXo_QYoEYdNfUXMrEO3M5C_1b; webp=1',
    referrer: 'https://mobile.yangkeduo.com/', visibilityState: 'visible', hidden: false,
    title: '', URL: 'https://mobile.yangkeduo.com/', domain: 'mobile.yangkeduo.com',
    readyState: 'complete', characterSet: 'UTF-8', charset: 'UTF-8', compatMode: 'CSS1Compat', contentType: 'text/html',
    documentElement: htmlEl, body: bodyEl, head: headEl,
    scripts: [], forms: [], images: [], links: [], styleSheets: [],
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    getElementsByTagName: () => [], getElementsByClassName: () => [], getElementsByName: () => [],
    createElement: (t) => makeEl(t), createElementNS: (ns, t) => makeEl(t),
    createTextNode: (txt) => ({ nodeType: 3, textContent: txt, data: txt }),
    createDocumentFragment: () => makeEl('#document-fragment'),
    createEvent: (type) => ({ type, initEvent: () => {}, preventDefault: () => {}, stopPropagation: () => {} }),
    hasFocus: () => true, execCommand: () => true, evaluate: () => null,
  };
  win.document.defaultView = win;
  htmlEl.ownerDocument = win.document; bodyEl.ownerDocument = win.document; headEl.ownerDocument = win.document;

  win.screen = {
    width: 390, height: 844, availWidth: 390, availHeight: 844, colorDepth: 24, pixelDepth: 24,
    orientation: { type: 'portrait-primary', angle: 0, addEventListener: () => {}, removeEventListener: () => {} },
  };
  win.innerWidth = 390; win.innerHeight = 844; win.outerWidth = 390; win.outerHeight = 844;
  win.devicePixelRatio = 2; win.pageXOffset = 0; win.pageYOffset = 0; win.scrollX = 0; win.scrollY = 0;
  win.history = { length: 1, state: null, pushState: () => {}, replaceState: () => {}, back: () => {}, forward: () => {}, go: () => {} };

  const storageMake = () => {
    const s = {};
    return {
      getItem: (k) => (k in s ? s[k] : null),
      setItem: (k, v) => { s[k] = String(v); },
      removeItem: (k) => { delete s[k]; },
      clear: () => { for (const k in s) delete s[k]; },
      key: (i) => Object.keys(s)[i] || null,
      get length() { return Object.keys(s).length; },
    };
  };
  win.localStorage = storageMake(); win.sessionStorage = storageMake();

  const navStart = Date.now() - 3000;
  win.performance = {
    now: () => Date.now() - navStart, timeOrigin: navStart,
    timing: {
      navigationStart: navStart, fetchStart: navStart + 10,
      domainLookupStart: navStart + 20, domainLookupEnd: navStart + 30,
      connectStart: navStart + 40, connectEnd: navStart + 80, secureConnectionStart: navStart + 50,
      requestStart: navStart + 100, responseStart: navStart + 200, responseEnd: navStart + 300,
      domLoading: navStart + 350, domInteractive: navStart + 500,
      domContentLoadedEventStart: navStart + 550, domContentLoadedEventEnd: navStart + 600,
      domComplete: navStart + 900, loadEventStart: navStart + 1000, loadEventEnd: navStart + 1100,
    },
    memory: { jsHeapSizeLimit: 2172649472, totalJSHeapSize: 35254272, usedJSHeapSize: 33150000 },
    navigation: { type: 0, redirectCount: 0 },
    getEntries: () => [], getEntriesByType: () => [], getEntriesByName: () => [],
    mark: () => {}, measure: () => {}, clearMarks: () => {}, clearMeasures: () => {},
  };

  win.addEventListener = () => {}; win.removeEventListener = () => {}; win.dispatchEvent = () => true;
  win.matchMedia = (q) => ({ matches: false, media: q, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {} });
  win.getComputedStyle = () => ({ getPropertyValue: () => '' });

  win.setTimeout = setTimeout; win.clearTimeout = clearTimeout;
  win.setInterval = setInterval; win.clearInterval = clearInterval;
  win.queueMicrotask = queueMicrotask;

  // Native constructors passthrough
  win.Date = Date; win.Math = Math; win.JSON = JSON;
  win.Object = Object; win.Array = Array; win.String = String; win.Number = Number;
  win.Boolean = Boolean; win.Function = Function; win.RegExp = RegExp;
  win.Error = Error; win.TypeError = TypeError; win.ReferenceError = ReferenceError;
  win.SyntaxError = SyntaxError; win.RangeError = RangeError; win.URIError = URIError;
  win.Promise = Promise; win.Symbol = Symbol; win.Map = Map; win.Set = Set;
  win.WeakMap = WeakMap; win.WeakSet = WeakSet; win.Proxy = Proxy; win.Reflect = Reflect;
  win.Int8Array = Int8Array; win.Uint8Array = Uint8Array; win.Uint8ClampedArray = Uint8ClampedArray;
  win.Int16Array = Int16Array; win.Uint16Array = Uint16Array;
  win.Int32Array = Int32Array; win.Uint32Array = Uint32Array;
  win.Float32Array = Float32Array; win.Float64Array = Float64Array;
  win.BigInt64Array = BigInt64Array; win.BigUint64Array = BigUint64Array;
  win.ArrayBuffer = ArrayBuffer; win.DataView = DataView;
  win.encodeURIComponent = encodeURIComponent; win.decodeURIComponent = decodeURIComponent;
  win.encodeURI = encodeURI; win.decodeURI = decodeURI;
  win.atob = (s) => Buffer.from(s, 'base64').toString('binary');
  win.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
  win.TextEncoder = globalThis.TextEncoder; win.TextDecoder = globalThis.TextDecoder;
  win.URL = URL; win.URLSearchParams = URLSearchParams;
  win.FormData = typeof FormData !== 'undefined' ? FormData : function () {};
  win.Blob = typeof Blob !== 'undefined' ? Blob : function () {};
  win.FileReader = function () {};
  win.Intl = Intl; win.crypto = globalThis.crypto;
  win.AbortController = typeof AbortController !== 'undefined' ? AbortController : function () { this.signal = {}; this.abort = () => {}; };
  win.AbortSignal = typeof AbortSignal !== 'undefined' ? AbortSignal : function () {};
  win.Headers = typeof Headers !== 'undefined' ? Headers : function () {};
  win.Request = typeof Request !== 'undefined' ? Request : function () {};
  win.Response = typeof Response !== 'undefined' ? Response : function () {};

  // Network stubs: prevent any real outbound from sandbox
  win.XMLHttpRequest = function () {
    this.readyState = 0; this.status = 0; this.response = ''; this.responseText = ''; this.responseURL = '';
    this.open = function (m, u) { this._m = m; this._u = u; this.readyState = 1; };
    this.setRequestHeader = function () {};
    this.getAllResponseHeaders = function () { return ''; };
    this.getResponseHeader = function () { return null; };
    this.send = function () {}; this.abort = function () {};
    this.addEventListener = function () {}; this.removeEventListener = function () {};
    this.upload = { addEventListener: () => {}, removeEventListener: () => {} };
  };
  win.XMLHttpRequest.UNSENT = 0; win.XMLHttpRequest.OPENED = 1; win.XMLHttpRequest.HEADERS_RECEIVED = 2;
  win.XMLHttpRequest.LOADING = 3; win.XMLHttpRequest.DONE = 4;
  win.fetch = () => new Promise(() => {});

  win.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
  win.cancelAnimationFrame = clearTimeout;
  win.requestIdleCallback = (cb) => setTimeout(() => cb({ timeRemaining: () => 50, didTimeout: false }), 1);
  win.cancelIdleCallback = clearTimeout;

  win.Element = function () {}; win.HTMLElement = function () {};
  win.HTMLDocument = function () {}; win.Document = function () {};
  win.Node = function () {}; win.Window = function () {};
  win.Event = function (type) { this.type = type; }; win.CustomEvent = win.Event;
  win.MouseEvent = win.Event; win.TouchEvent = win.Event; win.KeyboardEvent = win.Event;
  win.IntersectionObserver = function () { this.observe = () => {}; this.disconnect = () => {}; this.unobserve = () => {}; };
  win.MutationObserver = function () { this.observe = () => {}; this.disconnect = () => {}; this.takeRecords = () => []; };
  win.ResizeObserver = function () { this.observe = () => {}; this.disconnect = () => {}; this.unobserve = () => {}; };
  win.WebSocket = function () { this.send = () => {}; this.close = () => {}; this.addEventListener = () => {}; };

  win.top = win; win.self = win; win.parent = win;
  win.window = win; win.globalThis = win; win.frames = win;
  win.onerror = null; win.onunhandledrejection = null;

  // Webpack loadable chunks registry used by chunk_3636.js
  win.__LOADABLE_LOADED_CHUNKS__ = [];

  return win;
}

module.exports = { install };
