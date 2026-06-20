/**
 * Browser fingerprint stubs for js_security_v3_0.1.4.js
 *
 * Canvas uses @napi-rs/canvas (Skia engine, same as Chrome) for
 * pixel-accurate text rendering — produces real browser-compatible fingerprints.
 * WebGL/Audio use deterministic stubs (server primarily validates Canvas hash).
 */
const { createCanvas } = require('@napi-rs/canvas');

// ---------------------------------------------------------------------------
// Canvas 2D — real Skia rendering via @napi-rs/canvas
// ---------------------------------------------------------------------------
function createCanvasStub(width = 280, height = 60) {
  const canvas = createCanvas(width, height);

  return {
    width: canvas.width,
    height: canvas.height,
    style: {},
    getContext(type) {
      if (type === '2d') {
        return canvas.getContext('2d');
      }
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        return createWebGLStub();
      }
      return canvas.getContext('2d');
    },
    toDataURL() {
      return canvas.toDataURL();
    },
  };
}

// ---------------------------------------------------------------------------
// WebGL stub — deterministic GPU parameters
// ---------------------------------------------------------------------------
function createWebGLStub() {
  const rendererInfo = 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0), or similar';
  const vendorInfo = 'Google Inc. (Intel)';

  function getParameter(pname) {
    if (typeof pname !== 'number') return null;
    switch (pname) {
      case 0x1F01: return rendererInfo;
      case 0x1F00: return vendorInfo;
      case 0x1F02: return 'WebGL 1.0 (OpenGL ES 2.0 Chromium)';
      case 0x1F03: return 'WebGL GLSL ES 1.0 (OpenGL ES GLSL ES 1.0 Chromium)';
      case 0x8B8C: return 4096;
      case 0x8B8E: return 4;
      case 0x8B8F: return 32;
      case 0x8B90: return 8;
      case 0x8B93: return 32;
      case 0x8B94: return 4096;
      case 0x8B95: return 128;
      case 0x8869: return 16;
      case 0x9245: return 'WebGL 1.0';
      case 0x9246: return rendererInfo;
      default: return (pname >= 0x8000) ? 8 : null;
    }
  }

  function getExtension(name) {
    const exts = {
      'WEBGL_debug_renderer_info': {}, 'EXT_texture_filter_anisotropic': { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 16 },
      'WEBGL_lose_context': {}, 'OES_texture_float': {}, 'OES_texture_half_float': {},
      'OES_standard_derivatives': {}, 'EXT_shader_texture_lod': {},
      'WEBGL_compressed_texture_s3tc': {}, 'WEBGL_depth_texture': {},
      'OES_element_index_uint': {}, 'ANGLE_instanced_arrays': {}, 'OES_vertex_array_object': {},
    };
    return exts[name] || null;
  }

  return {
    getParameter, getExtension,
    getSupportedExtensions() { return Object.keys(exts || ['WEBGL_debug_renderer_info']); },
    getContextAttributes() { return { alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false }; },
    createShader() { return {}; }, createProgram() { return {}; }, createBuffer() { return {}; },
    bindBuffer() {}, bufferData() {}, shaderSource() {}, compileShader() {},
    attachShader() {}, linkProgram() {}, useProgram() {},
    getShaderParameter() { return true; }, getProgramParameter() { return true; },
    getShaderInfoLog() { return ''; }, getProgramInfoLog() { return ''; },
    getAttribLocation() { return 0; }, getUniformLocation() { return {}; },
    uniform1i() {}, uniform1f() {}, vertexAttribPointer() {}, enableVertexAttribArray() {},
    drawArrays() {}, enable() {}, disable() {}, depthFunc() {},
    clear() {}, clearColor() {}, viewport() {}, activeTexture() {},
    bindTexture() {}, createTexture() {}, texParameteri() {},
    getError() { return 0; }, isContextLost() { return false; },
    getRenderbufferParameter() { return 0; }, getVertexAttribOffset() { return 0; },
    deleteShader() {}, deleteProgram() {}, deleteBuffer() {}, deleteTexture() {},
  };
}

// ---------------------------------------------------------------------------
// Audio stub
// ---------------------------------------------------------------------------
function createAudioContextStub() {
  return {
    sampleRate: 44100, destination: {},
    createOscillator() { return { type: 'sine', frequency: { value: 440 }, connect() {}, start() {}, stop() {}, disconnect() {} }; },
    createAnalyser() { return { fftSize: 2048, frequencyBinCount: 1024, connect() {}, getByteFrequencyData(arr) { if (arr) arr.fill(128); } }; },
    createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} }; },
    createDynamicsCompressor() { return { connect() {}, disconnect() {} }; },
    createBufferSource() { return { buffer: {}, connect() {}, start() {}, stop() {} }; },
    createBuffer(c, l, sr) { return { numberOfChannels: c, length: l, sampleRate: sr }; },
    decodeAudioData(b, s) { if (s) s({}); },
    close() {},
  };
}

// ---------------------------------------------------------------------------
// Navigator extensions stub
// ---------------------------------------------------------------------------
function createNavigatorExtensions() {
  return {
    connection: { effectiveType: '4g', rtt: 50, downlink: 10, onchange: null },
    getBattery() { return Promise.resolve({ charging: true, level: 1, chargingTime: 0, dischargingTime: Infinity }); },
    mediaDevices: {
      enumerateDevices() { return Promise.resolve([{ kind: 'audioinput', deviceId: 'default' }, { kind: 'videoinput', deviceId: 'default' }, { kind: 'audiooutput', deviceId: 'default' }]); },
      getUserMedia() { return Promise.resolve({ getTracks() { return []; } }); },
    },
    permissions: { query() { return Promise.resolve({ state: 'prompt' }); } },
    serviceWorker: { controller: null, ready: Promise.resolve({}), register() { return Promise.resolve({}); } },
  };
}

module.exports = {
  createCanvasStub, createWebGLStub, createAudioContextStub, createNavigatorExtensions,
  SEED_CANVAS_HASH: '4c9ac651eb66c057ceae86d646d77646',
  SEED_WEBGL_HASH: '1778886bf322692a51200f5661ead016',
};
