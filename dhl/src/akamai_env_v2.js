/**
 * DHL Akamai 3.0 补环境脚本 v2
 * 直接在 Node.js 全局作用域补充浏览器 API，然后 eval Akamai sensor.js
 *
 * 策略: 不强求 vm.createContext 完全隔离，而是用 eval + 全局补丁
 * 这样能最大程度减少缺失 API 导致的问题
 *
 * 用法: node akamai_env_v2.js <sensor_js_path> [page_url]
 */

const fs = require("fs");

const sensorJsPath = process.argv[2];
const pageUrl = process.argv[3] || "https://www.dhl.com/cn-zh/home/tracking.html";

if (!sensorJsPath) {
  console.error("Usage: node akamai_env_v2.js <sensor_js_path> [page_url]");
  process.exit(1);
}

const sensorCode = fs.readFileSync(sensorJsPath, "utf-8");

// ─── 捕获 sensor_data ───────────────────────────────────
let capturedData = null;
let capturedUrl = null;

// ─── 浏览器 API 补丁 ────────────────────────────────────
function patchBrowserEnv() {
  const now = Date.now();
  const startTime = now - 500;

  // Performance API
  if (!globalThis.performance) {
    globalThis.performance = {};
  }
  globalThis.performance.now = () => Date.now() - startTime;
  globalThis.performance.timing = {
    navigationStart: startTime,
    fetchStart: startTime + 50,
    domainLookupStart: startTime + 60,
    domainLookupEnd: startTime + 65,
    connectStart: startTime + 70,
    connectEnd: startTime + 100,
    requestStart: startTime + 105,
    responseStart: startTime + 200,
    responseEnd: startTime + 250,
    domLoading: startTime + 300,
    domInteractive: startTime + 500,
    domContentLoadedEventStart: startTime + 550,
    domContentLoadedEventEnd: startTime + 560,
    domComplete: startTime + 900,
    loadEventStart: startTime + 910,
    loadEventEnd: startTime + 920,
  };
  globalThis.performance.getEntries = () => [];
  globalThis.performance.getEntriesByType = () => [];
  globalThis.performance.getEntriesByName = () => [];
  globalThis.performance.mark = () => {};
  globalThis.performance.measure = () => {};

  // Navigator
  globalThis.navigator = {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    appVersion: "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    platform: "Win32",
    language: "zh-CN",
    languages: ["zh-CN", "zh", "en-US", "en"],
    cookieEnabled: true,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    vendor: "Google Inc.",
    vendorSub: "",
    productSub: "20030107",
    appName: "Netscape",
    appCodeName: "Mozilla",
    onLine: true,
    webdriver: false,
    pdfViewerEnabled: true,
    doNotTrack: null,
    plugins: {
      0: { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer", description: "PDF", length: 1 },
      1: { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai", description: "", length: 1 },
      2: { name: "Native Client", filename: "internal-nacl-plugin", description: "", length: 2 },
      length: 3,
      item(i) { return this[i] || null; },
      namedItem(n) { return Object.values(this).find(p => p.name === n) || null; },
      refresh() {},
    },
    mimeTypes: {
      0: { type: "application/pdf", suffixes: "pdf", description: "PDF" },
      1: { type: "text/pdf", suffixes: "pdf", description: "PDF" },
      length: 2,
      item(i) { return this[i] || null; },
      namedItem(n) { return Object.values(this).find(t => t.type === n) || null; },
    },
    permissions: {
      query() { return Promise.resolve({ state: "prompt", onchange: null }); },
    },
    connection: {
      effectiveType: "4g", rtt: 50, downlink: 10, saveData: false, type: "wifi", onchange: null,
    },
    mediaDevices: {
      enumerateDevices() { return Promise.resolve([]); },
      getUserMedia() { return Promise.reject(new Error("NotAllowedError")); },
    },
    sendBeacon(url, data) {
      capturedUrl = url;
      capturedData = data;
      return true;
    },
    getBattery() { return Promise.resolve({ charging: true, level: 1 }); },
  };

  // Screen
  globalThis.screen = {
    width: 1920, height: 1080,
    availWidth: 1920, availHeight: 1040,
    colorDepth: 24, pixelDepth: 24,
    availLeft: 0, availTop: 0,
    orientation: { type: "landscape-primary", angle: 0 },
  };

  // Window dimensions
  Object.assign(globalThis, {
    innerWidth: 1920, innerHeight: 1080,
    outerWidth: 1920, outerHeight: 1080,
    screenX: 0, screenY: 0,
    screenLeft: 0, screenTop: 0,
    pageXOffset: 0, pageYOffset: 0,
    scrollX: 0, scrollY: 0,
    devicePixelRatio: 1,
    name: "", length: 0, closed: false,
    opener: null, parent: globalThis, top: globalThis,
    self: globalThis,
    origin: "https://www.dhl.com",
    isSecureContext: true,
  });

  // Location
  globalThis.location = {
    href: pageUrl,
    protocol: "https:",
    host: "www.dhl.com",
    hostname: "www.dhl.com",
    port: "",
    pathname: "/cn-zh/home/tracking.html",
    search: "",
    hash: "",
    origin: "https://www.dhl.com",
    ancestorOrigins: { length: 0 },
    assign() {}, replace() {}, reload() {},
    toString() { return this.href; },
  };

  // Document (minimal)
  globalThis.document = {
    title: "DHL | Tracking",
    referrer: "",
    cookie: "",
    domain: "www.dhl.com",
    URL: pageUrl,
    documentURI: pageUrl,
    baseURI: pageUrl,
    characterSet: "UTF-8",
    charset: "UTF-8",
    readyState: "complete",
    hidden: false,
    visibilityState: "visible",
    compatMode: "CSS1Compat",
    documentElement: {
      tagName: "HTML",
      lang: "zh-CN",
      style: {},
      getAttribute(n) { return n === "lang" ? "zh-CN" : null; },
    },
    head: { children: [], childNodes: [] },
    body: {
      tagName: "BODY",
      children: [], childNodes: [],
      offsetWidth: 1920, offsetHeight: 1080,
      clientWidth: 1920, clientHeight: 1080,
      scrollWidth: 1920, scrollHeight: 1080,
      style: {},
    },
    createElement(tag) {
      if (tag === "canvas") return createCanvasMock();
      return {
        style: {}, tagName: tag.toUpperCase(),
        appendChild() { return this; }, removeChild() {},
        setAttribute() {}, getAttribute() { return null; },
        children: [], childNodes: [],
      };
    },
    createElementNS(ns, tag) { return this.createElement(tag); },
    createTextNode(t) { return { textContent: t, nodeType: 3 }; },
    createDocumentFragment() { return { children: [], childNodes: [], appendChild(c) { return c; } }; },
    getElementById() { return null; },
    getElementsByTagName() { return []; },
    getElementsByClassName() { return []; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {},
    createEvent() { return { initEvent() {}, initMouseEvent() {} }; },
    hasFocus() { return true; },
    activeElement: null,
  };

  // Canvas mock
  function createCanvasMock() {
    return {
      width: 280, height: 60,
      getContext(type) {
        if (type === "2d") return create2DContext();
        if (type === "webgl" || type === "experimental-webgl") return createWebGLContext();
        return null;
      },
      toDataURL() { return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARgAAAA8CAYAAABaU5lPAAAA..."; },
      toBlob(cb) { cb(new globalThis.Blob([""], { type: "image/png" })); },
    };
  }

  function create2DContext() {
    return {
      fillStyle: "#000", strokeStyle: "#000", font: "10px sans-serif",
      textAlign: "start", textBaseline: "alphabetic",
      fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {},
      measureText(t) { return { width: t.length * 8, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 2 }; },
      arc() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
      bezierCurveTo() {}, quadraticCurveTo() {}, rect() {},
      save() {}, restore() {}, scale() {}, rotate() {}, translate() {},
      transform() {}, setTransform() {},
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; },
      createPattern() { return {}; },
      drawImage() {},
      getImageData(x, y, w, h) {
        const data = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < data.length; i++) data[i] = (i * 7 + 13) % 256;
        return { data, width: w, height: h };
      },
      putImageData() {},
      clip() {}, fill() {}, stroke() {},
      isPointInPath() { return false; },
    };
  }

  function createWebGLContext() {
    const ctx = {
      VENDOR: 0x1f00, RENDERER: 0x1f01, VERSION: 0x1f02,
      SHADING_LANGUAGE_VERSION: 0x8b8a,
      MAX_TEXTURE_SIZE: 0x0d33, MAX_VIEWPORT_DIMS: 0x0d3a,
      MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x0d55,
      MAX_TEXTURE_IMAGE_UNITS: 0x0d56,
      MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x0d57,
      MAX_CUBE_MAP_TEXTURE_SIZE: 0x0d3c,
      MAX_RENDERBUFFER_SIZE: 0x0d44,
      MAX_VARYING_VECTORS: 0x0d3b,
      MAX_VERTEX_ATTRIBS: 0x0d3d,
      MAX_VERTEX_UNIFORM_VECTORS: 0x0d3e,
      MAX_FRAGMENT_UNIFORM_VECTORS: 0x0d40,
      ALIASED_POINT_SIZE_RANGE: 0x846d,
      ALIASED_LINE_WIDTH_RANGE: 0x846e,

      UNMASKED_VENDOR_WEBGL: 0x9245,
      UNMASKED_RENDERER_WEBGL: 0x9246,
      COMPILE_STATUS: 0x8b81,
      LINK_STATUS: 0x8b82,
      VALIDATE_STATUS: 0x8b83,
      FRAMEBUFFER_COMPLETE: 0x8cd5,
      NO_ERROR: 0,

      getExtension(name) { return {}; },
      getSupportedExtensions() { return []; },
      getParameter(pname) {
        const map = {
          0x1f00: "WebKit", 0x1f01: "WebKit WebGL",
          0x1f02: "WebGL 1.0 (OpenGL ES 2.0 Chromium)",
          0x8b8a: "WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)",
          0x0d33: 16384, 0x0d55: 16, 0x0d56: 16, 0x0d57: 32,
          0x0d3a: 16384, 0x0d44: 16384,
          0x0d3b: 30, 0x0d3d: 16, 0x0d3e: 1024, 0x0d40: 16,
          0x0d3c: 16384, 0x0d52: 1, 0x0b74: 8,
          0x9245: "Google Inc. (Intel)",
          0x9246: "ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)",
        };
        if (pname === 0x0d52) return new Int32Array([16384, 16384]);
        if (pname === 0x0d3f) return new Float32Array([1, 1024]);
        if (pname === 0x0d40) return new Float32Array([1, 1]);
        if (pname === 0x846d) return new Float32Array([1, 1024]);
        if (pname === 0x846e) return new Float32Array([1, 1]);
        return map[pname] !== undefined ? map[pname] : null;
      },
      getShaderPrecisionFormat() { return { rangeMin: 127, rangeMax: 127, precision: 23 }; },
      getContextAttributes() { return { alpha: true, antialias: true, depth: true }; },
      getProgramParameter(p, pname) { return pname === 0x8b82 || pname === 0x8b83; },
      getShaderParameter(s, pname) { return pname === 0x8b81; },
      getError() { return 0; },
      getAttachedShaders() { return []; },
      getShaderInfoLog() { return ""; },
      getProgramInfoLog() { return ""; },
      getShaderSource() { return ""; },
      getActiveAttrib() { return null; },
      getActiveUniform() { return null; },
      getAttribLocation() { return 0; },
      getUniformLocation() { return {}; },
      getBufferParameter() { return 0; },
      isContextLost() { return false; },
      isEnabled() { return false; },
      isBuffer() { return false; },
      isFramebuffer() { return false; },
      isProgram() { return false; },
      isRenderbuffer() { return false; },
      isShader() { return false; },
      isTexture() { return false; },
      checkFramebufferStatus() { return 0x8cd5; },

      createBuffer() { return {}; },
      createFramebuffer() { return {}; },
      createProgram() { return {}; },
      createRenderbuffer() { return {}; },
      createShader() { return {}; },
      createTexture() { return {}; },

      activeTexture() {}, attachShader() {}, bindAttribLocation() {},
      bindBuffer() {}, bindFramebuffer() {}, bindRenderbuffer() {}, bindTexture() {},
      blendColor() {}, blendEquation() {}, blendEquationSeparate() {},
      blendFunc() {}, blendFuncSeparate() {},
      bufferData() {}, bufferSubData() {},
      clear() {}, clearColor() {}, clearDepth() {}, clearStencil() {},
      colorMask() {}, compileShader() {},
      compressedTexImage2D() {}, compressedTexSubImage2D() {},
      copyTexImage2D() {}, copyTexSubImage2D() {},
      cullFace() {}, depthFunc() {}, depthMask() {}, depthRange() {},
      deleteBuffer() {}, deleteFramebuffer() {}, deleteProgram() {},
      deleteRenderbuffer() {}, deleteShader() {}, deleteTexture() {},
      detachShader() {}, disable() {}, disableVertexAttribArray() {},
      drawArrays() {}, drawElements() {},
      enable() {}, enableVertexAttribArray() {},
      finish() {}, flush() {},
      framebufferRenderbuffer() {}, framebufferTexture2D() {},
      frontFace() {}, generateMipmap() {},
      getFramebufferAttachmentParameter() {},
      getRenderbufferParameter() {},
      getTexParameter() {}, getUniform() {},
      getVertexAttrib() {}, getVertexAttribOffset() {},
      hint() {}, lineWidth() {}, linkProgram() {},
      pixelStorei() {}, polygonOffset() {},
      readPixels() {}, renderbufferStorage() {},
      sampleCoverage() {}, scissor() {},
      shaderSource() {}, stencilFunc() {}, stencilFuncSeparate() {},
      stencilMask() {}, stencilMaskSeparate() {},
      stencilOp() {}, stencilOpSeparate() {},
      texImage2D() {}, texParameterf() {}, texParameteri() {},
      texSubImage2D() {},
      uniform1f() {}, uniform1fv() {}, uniform1i() {}, uniform1iv() {},
      uniform2f() {}, uniform2fv() {}, uniform2i() {}, uniform2iv() {},
      uniform3f() {}, uniform3fv() {}, uniform3i() {}, uniform3iv() {},
      uniform4f() {}, uniform4fv() {}, uniform4i() {}, uniform4iv() {},
      uniformMatrix2fv() {}, uniformMatrix3fv() {}, uniformMatrix4fv() {},
      useProgram() {}, validateProgram() {},
      vertexAttrib1f() {}, vertexAttrib1fv() {},
      vertexAttrib2f() {}, vertexAttrib2fv() {},
      vertexAttrib3f() {}, vertexAttrib3fv() {},
      vertexAttrib4f() {}, vertexAttrib4fv() {},
      vertexAttribPointer() {}, viewport() {},
      bindVertexArrayOES() {},
      createVertexArrayOES() { return {}; },
      deleteVertexArrayOES() {},
      isVertexArrayOES() { return false; },
      drawArraysInstancedANGLE() {},
      drawElementsInstancedANGLE() {},
      vertexAttribDivisorANGLE() {},
    };
    return ctx;
  }

  // History
  globalThis.history = {
    length: 3, state: null, scrollRestoration: "auto",
    back() {}, forward() {}, go() {}, pushState() {}, replaceState() {},
  };

  // Storage
  const store = {};
  globalThis.localStorage = {
    getItem(k) { return store[k] || null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { for (const k in store) delete store[k]; },
    key(i) { return Object.keys(store)[i] || null; },
    get length() { return Object.keys(store).length; },
  };
  globalThis.sessionStorage = { ...globalThis.localStorage };

  // Crypto
  globalThis.crypto = {
    getRandomValues(arr) {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
    randomUUID() {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === "x" ? r : r & 0x3 | 0x8).toString(16);
      });
    },
    subtle: {
      digest(algo, data) { return Promise.resolve(new ArrayBuffer(32)); },
    },
  };

  // XHR
  globalThis.XMLHttpRequest = function () {
    let m = "GET", u = "", body = null, rs = 0, st = 0;
    let onReady = null, onLoad = null;
    this.UNSENT = 0; this.OPENED = 1; this.HEADERS_RECEIVED = 2;
    this.LOADING = 3; this.DONE = 4;
    this.readyState = 0; this.status = 0;
    this.responseText = ""; this.response = ""; this.responseXML = null;

    this.open = function (method, url) { m = method; u = url; rs = 1; };
    this.setRequestHeader = function () {};
    this.send = function (b) {
      body = b;
      if (m.toUpperCase() === "POST" && b && b.length > 100) {
        capturedUrl = u;
        capturedData = b;
      }
      rs = 4; st = 200;
      this.readyState = 4; this.status = 200;
      if (onReady) onReady();
      if (onLoad) onLoad();
    };
    this.abort = function () {};
    this.getAllResponseHeaders = function () { return ""; };
    this.getResponseHeader = function () { return null; };
    Object.defineProperty(this, "onreadystatechange", {
      get() { return onReady; }, set(fn) { onReady = fn; },
    });
    Object.defineProperty(this, "onload", {
      get() { return onLoad; }, set(fn) { onLoad = fn; },
    });
  };

  // Fetch
  globalThis.fetch = function (url, opts) {
    if (opts && opts.method && opts.method.toUpperCase() === "POST" && opts.body) {
      capturedUrl = typeof url === "string" ? url : url.url || "";
      capturedData = opts.body;
    }
    return Promise.resolve({
      ok: true, status: 200, statusText: "OK",
      headers: { get() { return null; }, forEach() {} },
      text() { return Promise.resolve(""); },
      json() { return Promise.resolve({}); },
      blob() { return Promise.resolve(new Blob()); },
      arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); },
    });
  };

  // Console stub
  if (!globalThis.console) globalThis.console = {};
  ["log","warn","error","info","debug","trace","dir","table","time","timeEnd","group","groupEnd"].forEach(m => {
    if (!globalThis.console[m]) globalThis.console[m] = () => {};
  });

  // Misc
  globalThis.atob = (s) => Buffer.from(s, "base64").toString("binary");
  globalThis.btoa = (s) => Buffer.from(s, "binary").toString("base64");
  globalThis.Blob = class Blob {
    constructor(parts, opts) {
      this.size = parts ? parts.join("").length : 0;
      this.type = opts ? opts.type || "" : "";
    }
    slice() { return this; }
    text() { return Promise.resolve(""); }
    arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
  };
  globalThis.FileReader = function () {
    this.readAsDataURL = function () {
      if (this.onload) { this.result = "data:text/plain;base64,"; this.onload(); }
    };
    this.readAsArrayBuffer = function () {
      if (this.onload) { this.result = new ArrayBuffer(0); this.onload(); }
    };
    this.readAsText = function () {
      if (this.onload) { this.result = ""; this.onload(); }
    };
  };
  globalThis.URL = {
    createObjectURL() { return "blob:https://www.dhl.com/xxxx"; },
    revokeObjectURL() {},
  };
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now() - startTime), 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

  // CSS
  globalThis.CSS = { escape(s) { return s; }, supports() { return true; } };

  // Chrome specific
  globalThis.chrome = {
    loadTimes() {
      return {
        requestTime: now / 1000, startLoadTime: (now - 950) / 1000,
        commitLoadTime: (now - 500) / 1000, finishDocumentLoadTime: (now - 100) / 1000,
        finishLoadTime: (now - 80) / 1000, firstPaintTime: (now - 600) / 1000,
        navigationType: "Other", wasFetchedViaSpdy: false,
        connectionInfo: "http/1.1",
      };
    },
    csi() { return { startE: now - 1000, onloadT: now - 80, pageT: now - 750, tran: 15 }; },
    app: {}, runtime: {},
  };

  // External
  globalThis.external = {};
  globalThis.speechSynthesis = {
    speaking: false, pending: false, paused: false,
    getVoices() { return [{ name: "Google US English", lang: "en-US", default: true, localService: true }]; },
    speak() {}, cancel() {}, pause() {}, resume() {},
  };
  globalThis.Notification = { permission: "default", requestPermission() { return Promise.resolve("default"); } };

  // AudioContext
  globalThis.AudioContext = function () {
    return {
      sampleRate: 44100, destination: {}, state: "running",
      createOscillator() { return { type: "sine", frequency: { value: 440 }, connect() {}, start() {}, stop() {}, disconnect() {} }; },
      createDynamicsCompressor() { return { threshold: { value: -24 }, knee: { value: 30 }, ratio: { value: 12 }, attack: { value: 0.003 }, release: { value: 0.25 }, connect() {}, disconnect() {} }; },
      createAnalyser() { return { fftSize: 2048, frequencyBinCount: 1024, connect() {}, disconnect() {}, getByteFrequencyData(a) { a.fill(0); } }; },
      createBuffer(c, l, sr) { return { numberOfChannels: c, length: l, sampleRate: sr, duration: l / sr, getChannelData() { return new Float32Array(l).fill(0); } }; },
      createBufferSource() { return { buffer: null, playbackRate: { value: 1 }, connect() {}, start() {}, stop() {}, disconnect() {} }; },
      createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; },
      close() {}, suspend() {}, resume() {},
    };
  };
  globalThis.webkitAudioContext = globalThis.AudioContext;
  globalThis.OfflineAudioContext = globalThis.AudioContext;

  // Add missing globals
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.dispatchEvent = () => true;
  globalThis.attachEvent = () => {};
  globalThis.ak_chlge = "";  // Akamai challenge token (if required)
}

// ─── 主逻辑 ─────────────────────────────────────────────
function main() {
  patchBrowserEnv();

  try {
    // Eval the Akamai sensor script
    const result = eval(sensorCode);

    // After execution, check if sensor_data was captured
    if (capturedData) {
      console.log(JSON.stringify({
        status: "ok",
        sensor_data: typeof capturedData === "string" ? capturedData : JSON.stringify(capturedData),
        post_url: capturedUrl || "",
        data_length: typeof capturedData === "string" ? capturedData.length : JSON.stringify(capturedData).length,
        source: "xhr_or_fetch",
      }));
      return;
    }

    // Check script return value
    if (result !== undefined) {
      console.log(JSON.stringify({
        status: "ok_no_capture",
        result_type: typeof result,
        result_preview: JSON.stringify(result).slice(0, 300),
        message: "Script returned value but no XHR/Fetch POST was triggered",
      }));
      return;
    }

    console.log(JSON.stringify({
      status: "done",
      message: "Script executed without capturing sensor_data",
    }));

  } catch (err) {
    console.log(JSON.stringify({
      status: "error",
      message: err.message,
      stack: err.stack ? err.stack.split("\n").slice(0, 5).join("\n") : "",
    }));
  }
}

main();
