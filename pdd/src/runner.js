// Long-running anti_content generator service for PDD H5.
// Usage: spawned by Python parent. Reads one JSON request per line from stdin, writes one JSON response per line to stdout.
//
// Input  : {"cmd":"gen"[,"serverTime":123456]}   or {"cmd":"ping"}   or {"cmd":"exit"}
// Output : {"ok":true,"anti_content":"0as..."}   or {"ok":false,"err":"..."}
//
// Internals:
//   1. Build a vm.Context with a minimal browser env (env/browser.js)
//   2. Execute assets/js/chunk_3636.js inside that context; the chunk pushes into
//      __LOADABLE_LOADED_CHUNKS__ a tuple [[3636], { 53636: factory }]
//   3. Call factory to obtain the RiskControlCrawler constructor (mini-webpack IIFE)
//   4. Re-use a single crawler instance; for each request call messagePackSync(opts)
//
// Stability:
//   - All logs go to stderr so stdout stays pure JSON (one line per response).
//   - Protocol is line-delimited JSON.
//   - On any uncaught error we still emit a {"ok":false} line and keep the process alive.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const readline = require('readline');

const { install } = require('./env/browser');

const CHUNK_PATH = path.resolve(__dirname, '../assets/js/chunk_3636.js');

// ---------- initialise sandbox ----------
function logErr(...args) { try { process.stderr.write('[runner] ' + args.map(String).join(' ') + '\n'); } catch {} }

const sandbox = install({});
vm.createContext(sandbox);

const code = fs.readFileSync(CHUNK_PATH, 'utf8');
vm.runInContext(code, sandbox, { filename: 'chunk_3636.js', timeout: 20000 });

const chunks = sandbox.__LOADABLE_LOADED_CHUNKS__;
if (!Array.isArray(chunks) || !chunks[0] || !chunks[0][1] || typeof chunks[0][1][53636] !== 'function') {
  logErr('FATAL: module 53636 factory missing in chunk_3636.js');
  process.exit(2);
}

// Execute the webpack module factory for id 53636.
// Factory signature: function(module, exports, __webpack_require__) { module.exports = IIFE(...); }
// We only care about module.exports so a minimal shim is enough.
const factory = chunks[0][1][53636];
const mod = { exports: {} };
factory(mod, mod.exports);

let CrawlerCls = mod.exports;
if (CrawlerCls && CrawlerCls.default) CrawlerCls = CrawlerCls.default;
if (typeof CrawlerCls !== 'function') {
  logErr('FATAL: module 53636 did not export a constructor (type=' + typeof CrawlerCls + ')');
  process.exit(3);
}

const protoMethods = Object.getOwnPropertyNames(CrawlerCls.prototype || {});
logErr('CrawlerCls proto:', protoMethods.join(','));

// ---------- crawler instance ----------
let crawler = null;
function ensureCrawler(serverTime) {
  if (!crawler) {
    crawler = new CrawlerCls({ serverTime: serverTime || Date.now() });
    try {
      if (typeof crawler.init === 'function') crawler.init();
    } catch (e) {
      logErr('crawler.init error:', e.message);
    }
    logErr('crawler created, methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(crawler)).join(','));
  } else if (typeof crawler.updateServerTime === 'function' && serverTime) {
    try { crawler.updateServerTime(serverTime); } catch (e) { logErr('updateServerTime:', e.message); }
  }
  return crawler;
}

// Default options for messagePackSync mirror the orchestrator call in anti_3893.js
const DEFAULT_OPTS = {
  touchEventData: true, clickEventData: true, focusblurEventData: true,
  changeEventData: true, locationInfo: true, referrer: true,
  browserSize: true, browserInfo: true, token: true, fingerprint: true,
};

async function generate(serverTime) {
  const c = ensureCrawler(serverTime);
  if (typeof c.messagePackSync !== 'function') throw new Error('messagePackSync missing');
  const out = c.messagePackSync(Object.assign({}, DEFAULT_OPTS));
  if (out && typeof out.then === 'function') return await out;
  return out;
}

// ---------- stdin/stdout loop ----------
const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on('line', async (line) => {
  const raw = line.trim();
  if (!raw) return;
  let req;
  try { req = JSON.parse(raw); } catch (e) {
    process.stdout.write(JSON.stringify({ ok: false, err: 'bad_json: ' + e.message }) + '\n');
    return;
  }
  const cmd = req.cmd || 'gen';
  try {
    if (cmd === 'ping') {
      process.stdout.write(JSON.stringify({ ok: true, pong: Date.now() }) + '\n');
      return;
    }
    if (cmd === 'exit') {
      process.stdout.write(JSON.stringify({ ok: true, bye: true }) + '\n');
      setImmediate(() => process.exit(0));
      return;
    }
    if (cmd === 'gen') {
      const anti = await generate(req.serverTime);
      process.stdout.write(JSON.stringify({ ok: true, anti_content: anti }) + '\n');
      return;
    }
    process.stdout.write(JSON.stringify({ ok: false, err: 'unknown_cmd: ' + cmd }) + '\n');
  } catch (e) {
    logErr('request error:', e.message);
    process.stdout.write(JSON.stringify({ ok: false, err: String(e.message || e) }) + '\n');
  }
});

rl.on('close', () => { process.exit(0); });

process.on('uncaughtException', (e) => logErr('uncaught:', e && e.stack || e));
process.on('unhandledRejection', (e) => logErr('unhandled:', e && e.stack || e));

// Announce ready
logErr('ready');
process.stdout.write(JSON.stringify({ ok: true, ready: true }) + '\n');
