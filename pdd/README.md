# 拼多多 H5 Hub Feed 协议采集器

本子项目针对 `https://mobile.yangkeduo.com/` 首页推荐流接口 `hub/v3` 做纯协议采集。
采用「Node.js 补环境生成 `anti_content`」+「Python 发请求」的双进程方案，
严格不使用任何自动化浏览器（无 Selenium / Playwright / Puppeteer）。

## 目录结构

```
sites/yangkeduo/
├── README.md                        本文件
├── assets/
│   └── js/
│       └── chunk_3636.js            运行期必需：含 webpack 模块 53636（RiskControlCrawler）
├── docs/
│   ├── notes.md                     Phase 0 情报摘要
│   ├── api.md                       hub/v3 接口表与参数表
│   └── crypto.md                    anti_content 逆向实证与调用链
└── src/
    ├── env/
    │   └── browser.js               Node vm 沙箱的 browser 环境 stub
    ├── runner.js                    Node 长驻服务：stdin/stdout JSON 协议
    ├── main.py                      Python 主脚本：采集前 5 页
    └── output/
        └── goods.jsonl              采集落地（运行时生成）
```

## 运行方式

前置条件：
- Node.js ≥ 20（需要内置 `vm.createContext`）
- Python ≥ 3.10 + `requests`
- 已激活项目根 `venv`

```powershell
# 在项目根
.\venv\Scripts\Activate.ps1
python sites/yangkeduo/src/main.py
```

自定义 Node 可执行文件路径：`$env:NODE_BIN = "C:\path\to\node.exe"`

## 输出示例（goods.jsonl 每行一条）

```json
{"goods_id": 785925741090, "goods_name": "韩版上班通勤手提包包女2025新款...",
 "market_price": 2800, "normal_price": 2189,
 "short_name": "...", "sales_tip": "本店已拼3770件",
 "thumb_url": "https://img.pddpic.com/.../xxx.jpeg",
 "link_url": "goods.html?goods_id=..."}
```

字段单位：价格为「分」（market_price=2800 → 28.00 元）。

## 一次成功运行的实测指标

- 请求 5 页（offset = 10, 30, 50, 70, 90，count = 20）
- 前 4 页每页返回 20 条；第 5 页响应为空（推荐流见底）
- 跨页去重后 ≈ 68 条唯一商品
- 每页独立生成 `anti_content`（长度 ≈ 470–472，`0as` 开头）
- 全程一个 Node 子进程、一个 requests.Session

## 协议核心信息（详见 docs/）

| 项 | 值 |
|---|---|
| URL | `GET https://mobile.yangkeduo.com/proxy/api/api/alexa/cells/hub/v3` |
| 加密参数 | `anti_content`（同值写入 `anti-content` header 与 query） |
| 生成位置 | chunk `3636_<hash>.js` → webpack 模块 `53636`（即 `RiskControlCrawler`） |
| 关键调用 | `new Crawler({serverTime}).messagePackSync({...flags})` |
| 登录态 | 不需要；`pdduid=0` 游客模式 |

## 已知限制

1. 第 5 页（offset=90）常态性为空——推荐流本身到顶的正常表现，非采集失败。
2. `list_id` 当前固定沿用浏览器抓到的真实值 `wgxptmt48f`；若服务端要求强制轮换，
   可放开 `main.py` 中 `list_id = new_lid` 分支（代码已预留）。
3. `chunk_3636.js` 的 hash 随 PDD 发版变动，若上线后生成失败需要重新下载：
   - 请求 `https://mobile.yangkeduo.com/` 获取 HTML
   - 正则 `\b3636_[a-f0-9]{16,}\.js` 抓新 URL
   - 覆盖 `assets/js/chunk_3636.js`
4. `anti_content` 里含有 canvas/webgl/指纹采样；若服务端加严风控指纹校验，
   需要把 `src/env/browser.js` 的 stub 值与 AdsPower 浏览器快照对齐。

## 约束声明

- 严格协议还原；不做任何自动化浏览器驱动。
- 仅采集公开推荐流；不登录、不抓用户隐私。
- 请求间隔 1.2 + [0, 0.8] 秒随机抖动，避免高频。
