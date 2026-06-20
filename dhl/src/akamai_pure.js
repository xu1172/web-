/**
 * DHL Akamai 3.0 — 纯算 sensor_data 生成器
 *
 * 不再模拟浏览器运行 Akamai JS，而是直接构造完整 payload 再加密。
 * payload 结构来自反混淆代码中 fY(PE=52) 的采集逻辑 + npm 包参考模板。
 *
 * 用法: node akamai_pure.js [page_url]
 */
const akamaiHelper = require("../../../node_modules/akamai-v3-sensor-data-helper/src");

const pageUrl = process.argv[2] || "https://www.dhl.com/cn-zh/home/tracking.html";
const now = Date.now();

// ─── 环境指纹（模拟 Chrome 149 Windows） ──────────────
const ENV = {
  ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
  platform: "Win32",
  language: "zh-CN",
  screenW: 1920, screenH: 1080, availW: 1920, availH: 1040,
  colorDepth: 24, pixelDepth: 24,
  cores: 8, memory: 8,
  timezone: -480, // UTC+8 in minutes
};

// ─── 构造完整 payload ─────────────────────────────────
function buildPayload() {
  const nav = ENV;

  // ajr: browser fingerprint string
  const ajr = [
    `X 10_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36`,
    `${nav.screenW},0,${nav.screenW},0,${nav.screenW},0,8`,
    `189|86|${nav.language},20030107,8753,956,0,${Math.random().toFixed(12).slice(2)},${Math.floor(Math.random()*20000)},0`,
    nav.ua,
    `${nav.screenW},0,${nav.screenW},0,${nav.screenW},0`,
    `${Math.floor(Math.random()*1000000000)},${Math.floor(Math.random()*500000)},737,405,858`,
    `Gecko,cpen:0,i1:0,dm:0,cwen:0,non:1,opc:0,fc:0,sc:0,wrc:1,isc:0,vib:1,bat:1,x11:0,x12:1,5`,
  ].join(",");

  // din: device info array
  const din = [
    { nal: nav.language },
    { nps: "20030107" },
    { ucs: "8753" },
    { she: 956 },
    { tsd: 0 },
    { ran: Math.random().toFixed(12).slice(2) },
    { xag: Math.floor(Math.random() * 20000) },
    { ibr: 0 },
    { ua: nav.ua },
    { swi: nav.screenW },
    { dau: 0 },
    { asw: nav.availW },
    { wdr: 0 },
    { wow: nav.screenW },
    { pha: 0 },
    { hal: Math.floor(Math.random() * 1000000000) },
    { hz1: Math.floor(Math.random() * 500000) },
    { wih: 737 },
    { wiw: 405 },
    { ash: 858 },
    { nap: "Gecko" },
    { adp: "cpen:0,i1:0,dm:0,cwen:0,non:1,opc:0,fc:0,sc:0,wrc:1,isc:0,vib:1,bat:1,x11:0,x12:1" },
    { npl: 5 },
  ];

  // mst: mouse/touch statistics
  const mst = [
    { kevl: 1 }, { mevl: Math.floor(Math.random()*30000000) }, { tevl: 32 },
    { devl: 45 }, { dmvl: Math.floor(Math.random()*6000000) }, { pevl: 0 },
    { tovl: Math.floor(Math.random()*30000000) }, { delt: Math.floor(Math.random()*6000000) },
    { it: 0 }, { sts: now }, { fct: 1 }, { dd2: 18000 + Math.floor(Math.random()*1000) },
    { kc: 0 }, { mc: 80 + Math.floor(Math.random()*10) }, { ww8: 3000 + Math.floor(Math.random()*200) },
    { pc: 2 }, { tc: 0 }, { ssts: 5526533 }, { tst: 26000000 + Math.floor(Math.random()*1000000) },
    { rval: "-1" }, { rcfp: "-1" }, { nfas: 30000000 + Math.floor(Math.random()*1000000) },
    { jsrf: "PiZtE" }, { jsrf1: 39064 }, { jsrf2: 80 },
    { signals: "0" }, { mwd: "0" }, { hea: "" },
    { dvc: "93h9dhdYdh9iYeveufko,13,f+b+l+g+i+j+e+k+c+" }, { srd: "0" },
  ];

  // dsi: device sensor info (WebGL/Canvas fingerprints)
  const dsi = [
    { get: "" }, { set: "0" },
    { ico: "070f409b82df3bdd2f51a6415c7895353c153c47fe6dd8a0f87f3d14c46ccb2b" },
    { ift: "3" },
    { xof: "8,5,1,1,8" },
    { xot: "8,5,1,1,8" },
    { wev: "NA;wev;NA" },
    { wre: "NA;wre;NA" },
    { wdr: "0" },
    { iks: "" },
    { lds: "1" },
    { sst: "" },
  ];

  // fwd: fingerprint web data
  const fwd = [
    { fmh: "" },
    { fmz: "2" },
    { ssh: "6d9faae3a85b2727ec5b802ee76b75a2c8a736774ef9c0024c9b875de06f1fb0" },
  ];

  return {
    ver: "wS5KmeE4vP5vBcKRIM2pPQlq4qZivf0B53dgMqmUH4E=",
    fpt: ";-1;dis;,7;true;true;true;180;true;30;30;true;false;-1",
    fpc: "4488",
    ajr: ajr,
    url: pageUrl,
    pur: pageUrl,
    eem: "do_en,dm_en,t_en",
    ffs: "",
    vev: "3,35296;3,371930;",
    inf: "",
    ajt: "7,4",
    kev: "",
    dme: "0,45,-1,-1,-1,-1,-1,-1,-1,-1,-1;1,5526528,-1,-1,-1,-1,-1,-1,-1,-1,-1;",
    mev: `0,1,${34900+Math.floor(Math.random()*100)},394,287;1,1,${34900+Math.floor(Math.random()*100)},388,279;`,
    doe: "0,45,-1,-1,-1;",
    pev: "", pmo: "", dpw: "", pac: "",
    per: "99999944949322244999",
    tev: "",
    sde: "0,0,0,0,1,0,0",
    oev: "", if: "", pde: "",
    o9: 0,
    wsl: "2248146944,39969421,24532633,50,209,1,1,1,0,1,,,,,,0,,,1,1",
    hls: "-1,,,1,1",
    din: din,
    mst: mst,
    dsi: dsi,
    fwd: fwd,
  };
}

// ─── 加密 ──────────────────────────────────────────────
const payload = buildPayload();
const cookieHash = 8888888;   // 首次请求默认
const fileHash = 2525281482;  // 从 DHL JS 提取: ;0x6228a7e,2525281482;

const result = akamaiHelper.encrypt(payload, cookieHash, null, fileHash);

if (result.success) {
  console.log(JSON.stringify({
    status: "ok",
    sensor_data: result.data.sensor_data,
    sensor_data_length: result.data.sensor_data.length,
    fileHash: fileHash,
    cookieHash: cookieHash,
    payload_keys: Object.keys(payload).length,
    payload_size: JSON.stringify(payload).length,
  }));
} else {
  console.log(JSON.stringify({ status: "error", message: result.message }));
}
