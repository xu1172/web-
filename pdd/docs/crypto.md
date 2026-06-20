# Crypto · anti_content 逆向实证

记录 `anti_content` 的定位链路、关键代码位置、以及本地 Node 复现的完整路径。
本文档是 `src/runner.js` 的理论依据。

## 1. 调用链（浏览器侧）

从业务代码到 VMP 生成器，自顶向下：

```text
// anti_3893.js（主编排）
d.getAntiContent()
  → d.getInstance().getRiskControlInfoAsync()
    → getRiskControlInfoSync()
      → this.riskControlCrawler.messagePackSync({...flags})
        ← 返回 "0as..." 字符串
```

等价形态位于 `anti_9532.js`：

```js
// ESM 异步依赖注入版本
Promise.all([ n.e(3636), n.e(211) ])
  .then(n.bind(n, 43016))
  .then(([serverTime, c]) => new c({ serverTime }).messagePackSync());
```

- `n.e(3636)` / `n.e(211)`：webpack 按需加载 chunk
- `n(43016)`：引用模块 43016

## 2. 模块 43016 的真正实现

模块 43016 在 `index.js` 里只是 re-export：

```js
43016: function (e, t, n) {
  "use strict";
  n.r(t);
  var r = n(53636);
  t.default = r;
}
```

**真正的 `RiskControlCrawler` 类是模块 53636**。模块 53636 位于 chunk `3636_<hash>.js` 中，
其实体是一个**完整的 mini webpack bundle**（IIFE 自执行），导出一个构造函数：

```js
// chunk_3636.js（抄录关键骨架）
(self.__LOADABLE_LOADED_CHUNKS__ = self.__LOADABLE_LOADED_CHUNKS__ || [])
  .push([[3636], {
    53636: function (t) {
      "undefined" != typeof self && self;
      t.exports = function (tModulesMap) {
        var n = {};
        function r(e) { /* 内部 __webpack_require__ */ }
        r.m = tModulesMap; r.c = n;
        r.d = r.r = r.t = r.o = /* ... */;
        r.p = "";
        return r(r.s = 0);
      }(/* 内部模块表 */);
    }
  }]);
```

即：执行 chunk_3636.js 后，从 `__LOADABLE_LOADED_CHUNKS__[0][1][53636]` 可取到 factory；
调用 `factory(module, exports)` 后 `module.exports` 就是 `RiskControlCrawler` 构造函数。

## 3. 实例方法（经本地实证）

```text
CrawlerCls.prototype.constructor
                   .updateServerTime(ms)     // 可选：校准服务器时间
                   .init()                   // 必调：初始化采集器
                   .clearCache()             // 清状态
                   .messagePack(opts)        // 异步完整版
                   .messagePackSync(opts)    // 同步/Promise 版，本项目使用
```

`messagePackSync(opts)` 参数（与 `anti_3893.js` 的编排调用一致）：

```js
{
  touchEventData:    true,
  clickEventData:    true,
  focusblurEventData:true,
  changeEventData:   true,
  locationInfo:      true,
  referrer:          true,
  browserSize:       true,
  browserInfo:       true,
  token:             true,
  fingerprint:       true,
}
```

返回值样例（每次不同）：

```
0asAfa5E-wCEtxJUXySt_USOOG7qNyQxHafykOXqgHQpUYKquuGqHjveRVAEXqcYXeNVHy0qH5XYOq4YO5_yn0XonG_Js57YnqmJ...
长度 ≈ 470–472
```

## 4. 干扰项：rcf.js 不是生成器

`https://static.pddpic.com/assets-rcf/b9216582_4760cb2d45afc9d6c8ac751271f59a5c.js` (743 KB)
经实证其 singleton 类 prototype 方法为：

```text
init, pullConfigByUid, applyAccAriaHidden, fingerUpload, clearEvents,
registerIntervalUpload, ensureIntervalTimer, getState, isInitialized,
refreshBeforeUpload, registerLifecycleBeaconUpload, runExclusiveUpload
```

**没有** `messagePackSync / updateServerTime / clearCache`。全文 grep 对应明文也都为 -1。
结论：rcf.js 是行为指纹「埋点上传类」，与 anti_content 生成无关，已从补环境主路径中排除。

## 5. Node 本地复现步骤

1. 请求 `https://mobile.yangkeduo.com/` 获取 HTML；从 `<script src=...>` 中找 `3636_<hash>.js` URL。
2. 下载该 chunk 为 `assets/js/chunk_3636.js`。
3. 在 Node vm context 中注入最小 browser 环境 stub（`src/env/browser.js`），
   预置 `sandbox.__LOADABLE_LOADED_CHUNKS__ = []`。
4. `vm.runInContext(chunk_3636.js)` → `__LOADABLE_LOADED_CHUNKS__[0][1][53636]` 取 factory。
5. 构造极简 webpack 模块参数：`const mod = {exports:{}}; factory(mod, mod.exports);`
   `CrawlerCls = mod.exports.default || mod.exports;`
6. `const inst = new CrawlerCls({ serverTime: Date.now() }); inst.init();`
7. 每次请求前调用 `inst.messagePackSync(DEFAULT_OPTS)` 得到新的 `anti_content`。

上述 7 步全部封装在 `src/runner.js` 中。

## 6. 环境依赖清单（stub 必要项）

下列属性若缺失，生成器要么抛异常，要么输出异常字符串：

- `navigator.{userAgent, platform, language, languages, hardwareConcurrency, deviceMemory, maxTouchPoints, vendor, webdriver}`
- `location.{href, origin, host, hostname, protocol, pathname}`
- `document.{cookie, referrer, visibilityState, readyState, createElement, documentElement, body, head}`
- `document.createElement('canvas').getContext('2d')` 需返回带 `getImageData/measureText/fillRect` 的 mock
- `document.createElement('canvas').getContext('webgl')` 需返回带 `getParameter/getExtension` 的 mock
- `screen.{width, height, availWidth, availHeight, colorDepth, pixelDepth, orientation}`
- `performance.{now, timeOrigin, timing, memory}`
- `localStorage` / `sessionStorage` / `history` / `matchMedia`
- `XMLHttpRequest`（空实现即可；生成器内部可能尝试上报）
- `setTimeout / setInterval / requestAnimationFrame` 等计时 API

完整实现参见 [`src/env/browser.js`](../src/env/browser.js)。

## 7. 版本锚点

| 项 | 值 |
|---|---|
| chunk_3636 文件名 | `3636_c6a7e75f684647d6b36c.js` |
| 抓取时间 | 2026-04-29 |
| anti_content 样本 | `0asAfa5E-wCEtxJUXYSt_...` (len=471) |
| messagePackSync 调用参数 | 见 §3 |

若 PDD 升级混淆或调整方法签名，需重新抓 chunk → 重跑 `tests/try_chunk3636.js`
（之前的探索脚本，已清理；必要时重建）。
