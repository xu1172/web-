---
description: 各站点实战经验索引（按需查阅，不自动加载）
alwaysApply: false
---

# Sites 实战经验备忘（学习与检索用）

> **适用范围**：`e:\PythonCodeObject1\cursorAppdexobjectdemo1\sites\` 下已文档化的子项目。
> **优先级**：若与本文件或某 README 中的表述冲突，**始终以 `.trae/rules/qoder-reverse.md`（协议优先、真实数据优先、调试路线 A/B/C、禁止 Selenium/Playwright/Puppeteer 采集）为准**。个别站点 README 里出现的「浏览器自动化备选」仅表示历史笔记，**不视为当前交付规范**。
> **不含**：任何第三方打码 token、Cookie、AccessKey、账号口令。

---

## 一、横向模式（你反复验证有效的套路）

| 模式 | 典型用法 | 代表站点 / 路径 |
|------|----------|-----------------|
| **Python 请求 + Node 加密子进程** | `requests`/`curl_cffi` 主流程；加密、`anti_content`、`w`、RSA、WASM glue 放 Node，`subprocess` 或 **stdio JSON-RPC 长连接** | `yangkeduo`、`jd_login`、`fxg`、`aliyun_captcha`、`yunpian` |
| **滑块：识别 + 类人轨迹 + 服务端加密载荷** | OpenCV/模板匹配 ↔ 低置信回退云码；轨迹分段缓动 + Y 抖动；再把轨迹交给 SDK/WASM 生成 `tk`/`ct`/`captchaBody` | `jd_login`、`fxg`、`yunpian`、`crv-captcha` |
| **第三方双图滑块 API** | `type` 与 **字段名**必须与文档一致（常见坑：`10107` vs `20111`，`image` vs `slide_image`/`background_image`）；返回 `data` 有时是 **字符串坐标** 有时是对象，需兼容解析 | `fxg`、`crv-captcha`（文档叙述） |
| **WASM / jcap / rmc** | 异步初始化：`getCTData` 类同步路径可能为 null → **热身等待**或重建实例；**同一 WASM `instanceId`/`ii` 必须与加密侧缓存的 D 实例一致** | `jd_login` |
| **encodeURI 对齐** | Python `urllib.parse.quote` 默认与 JS `encodeURI` 不一致（如逗号）→ 使用 **`safe=` 与 JS 对齐**，否则服务端校验失败（如京东 `16807`） | `jd_login` README |
| **TLS / Header 维度** | `curl_cffi` impersonate 指定 Chrome 版本；Boss 等站 **`wt2`/`zp_at` 登录 Cookie + 完整 Client Hints** 与签名同等重要 | `zhipin` |
| **签名升级后弃纯离线 signer** | 业务升级签名体系后，旧 `signer.js` 直连可能作废 → **CDP 桥**让浏览器内 axios 代签 | `rednote` |
| **CDP 桥（路线 C）** | AdsPower 起真实会话 → Python `websocket-client` + `Runtime.evaluate` / 注入 webpack 全局 → **维持首页 feed 来源约束**（如 homefeed 冷启动顺序） | `rednote` |
| **阿里云 NVC** | JSONP `nvcPrepare` → Node **补环境**加载 `awsc.js`/`nvc.js` → `getNVCVal()` → `nvcAnalyze`；UMID/UAB 常需 stub | `aliyun_captcha` |
| **极验 4 定制** | load / verify 多步；`w` 可由 **Node vm + 修补 JS** 或 **纯算法 AES/RSA 备用路径**；`gct`/`em` 环境令牌与 `trackOffset` 绑定 | `crv-captcha` |
| **练习平台套路** | OB：`hex_md5` Hook 拿 salt → Python `hashlib`；WASM：Node 直接 `encrypt_simple` 躲反调试；字体：glyph 指纹 / fonttools | `spiderdemo` |

---

## 二、分站点要点（只记「你怎么打的」）

### `sites/fxg` — 抖店邮箱 / 字节 rmc-captcha

- **链路**：`verify.zijieapi.com` `captcha/get` → 双图 URL → 识别距离 → `trajectory` → **WASM/bdms** 产出 `captchaBody`（AES-GCM 封装）→ `captcha/verify` → `verify_ticket` 进 SSO。
- **侧信道**：`fp`、`msToken`、`a_bogus`、`detail` 等与主站风控同源，需与 Plan 里「动态参数来源」一致（本地生成 vs 浏览器捕获要写清）。
- **经验**：云码 **type=20111**、`slide_image`/`background_image`；轨迹 **60–80 点**、加速-匀速-减速 + Y 微抖；模块化 **yunma / trajectory / encrypt / solver**。
- **注意**：部分总结文档曾写「用 Selenium 取参」，与当前项目规则冲突，**分析阶段用 MCP/CDP，交付仍纯协议**。

### `sites/jd_login` — 京东 jcap 滑块 + 登录

- **架构**：Python `jd_protocol_solver` + **`JcapSession` stdio JSON-RPC** → `node/jcap_env.js`（`vm.runInContext` + Canvas/WebGL shim + Worker）→ `get_ct_direct` / `get_tk_direct` / `get_encrypt_all`。
- **关键**：`cachedDInstance` **跨 fp/check/verify 复用**；`ensureWasmWarmed` 解决异步初始化；**真实 `devcInfo` 指纹 JSON** 提升 fp `code=0`；缺口 **OpenCV 多度量回退云码**；失败 **reset 实例 + 新 sid** 重建会话。
- **密码**：`pwd_encrypt.js` RSA 与登录流分离调用。
- **文档**：`docs/03-flow.md` 梳理 fp/check/verify 与 `AwPF` 类载荷语义。

### `sites/rednote` — 小红书 Web API（签名在浏览器）

- **范式**：**不做离线 X-s 纯算**（`signer.js` 已废弃）→ **`cdp_bridge.py`** 在已登录 Tab 内执行请求链：`user/me` → `homefeed` → `feed` → `metrics_report`。
- **约束**：**来源链条**必须满足（首页推荐 category、`xsec_source` 等）；否则风控/空数据。
- **边界**：这是 **协议编排 + 浏览器内签名**，不是「无头自动化爬全站」；符合规则中 MCP/CDP 用于分析与可控调用。

### `sites/zhipin` — Boss 直聘 joblist

- **核心**：**登录态 Cookie**（`wt2`、`zp_at`）+ **`curl_cffi` TLS** + **Chrome 147 级完整 Headers**（含 `sec-ch-ua*`）。
- **兜底**：`code=37` 时再启用 Node `env.js` 补环境（README 所述）。

### `sites/yangkeduo` — 拼多多 hub feed

- **核心**：webpack 模块 **`RiskControlCrawler`**（`chunk_3636_*.js` 内 `53636`）→ `messagePackSync` 生成 **`anti_content`**（约 `0as` 前缀）；Node **长驻 stdin/stdout JSON** + Python `Session`。
- **维护**：chunk hash 随版本变，需按 README 正则更新 URL。

### `sites/spiderdemo` — 练习场

- **OB**：标准 MD5 + **固定 salt**（Hook 实证）。
- **WASM**：Node 加载 wasm **绕过 anti_automation**。
- **字体**：WOFF2 + glyph 映射 / 指纹。

### `sites/aliyun_captcha` — 阿里云 NVC

- **核心**：`nvcPrepare.jsonp` → Node **`browser.js` 大补环境** + `generate_token.js` → `getNVCVal` → `nvcAnalyze.jsonp`；字段 **a–k** 结构稳定可参考 README。

### `sites/yunpian` — 云片滑块

- **核心**：JSONP 拉图 → **`AES-256-CBC` + `RSA-1024`**（`core/crypto.py`）+ **OpenCV ↔ 云码混合** `slider_solver`。

### `sites/crv-captcha` — 极验 4（华润定制）

- **核心**：三步 load/verify；**修补版 JS** 暴露 `__encrypt`；**gct.js** 产出 `gct`/`em`；**云码**拿缺口；本地 **`generate_w.js`** vm 或 **`encrypt_w_helper` 纯算法备用**。
- **经验**：无感验证与滑块验证 **同一套 encrypt 管线、不同 `s` 字段 mode**。

### `sites/fcbox` — 丰巢滑块

- **核心**：取双图 URL → OpenCV → **Node `slider_encrypt.js`** 加密轨迹 → 提交 `checkCode`；README 提及 AdsPower **备选**（分析向），交付仍以协议为准。

### `sites/verify5` — V5 / 数美系（进行中笔记）

- **识别**：`v5.js` SDK；AES-256-CTR；传输 **WebSocket `F` 或 iframe `M`**（见 `logs/phase1-discovery.md`）。

---

## 三、后续对话中如何「用」这份备忘

1. **定点查阅**：提到某站时优先 **`sites/<name>/README.md`** 与 **`docs/*.md`**，本文件只做索引。
2. **不复述密钥**：云码 token、Cookie、`real_fingerprint.json` 内容等 **never** 贴入对话或规则。
3. **真实样本优先**：站点经验只能帮助缩小范围，不能替代真实抓包、真实响应和真实端到端对照。
4. **验证码 + 加密耦合任务**：Plan 里必须写清 **初始化接口 / 校验接口 / 票据字段 / 加密是否与登录同源**，并附至少一组真实样本证据（与 `qoder-reverse.md` Phase 3 模板一致）。
5. **新增站点**：建议同步更新本文件「分站点要点」一行 + 更新「横向模式」表（可选）。

---

## 四、与其它规则的边界

| 主题 | 本文件 | `qoder-reverse.md` |
|------|--------|--------------------|
| 真实数据优先、端到端验证、禁止占位验收 | 仅做补充提醒，不单独定义标准 | **唯一强制源** |
| 调试路线 A/B/C、禁止自动化采集 | 不重复强调 | **唯一强制源** |
| 具体站点参数与文件锚点 | **本文件** | 仅通用 Phase |
| 验证码类型与厂商线索 | 互补 §2.7 | §2.7 协议视角边界 |

将本规则 **`alwaysApply` 设为 `true`** 仅在长时间密集做多站点逆向时需要；默认 `false` 以免上下文过长。
