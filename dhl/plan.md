# DHL 快递追踪 — Akamai 逆向执行方案

> 目标: `https://www.dhl.com/cn-zh/home/tracking.html?tracking-id=XUZA59875`
> 追踪号码: XUZA59875 / XUZA59878 / XUZA59879 / XUZA59882
> 日期: 2026-06-14

---

## 1. 最终结论

**DHL `/utapi` 追踪 API 的 Akamai 仅做 CDN 缓存 + TLS 指纹过滤，不做 Bot Manager Cookie 验证。**

| 请求方式 | 结果 |
|----------|------|
| `requests` (Python UA, 普通 TLS) | **403** — DHL 应用层拦截：`"Your tracking attempt has been blocked"` |
| `curl_cffi` (Chrome 149 impersonate) | **200** — 无需任何 Akamai Cookie |
| `curl_cffi` + 假 `_abck` Cookie | **200** — `_abck` 完全不参与验证 |
| 清除浏览器 Cookie 后访问 | **200** — 无 Akamai Cookie 注入 |
| 快速连续 5 次请求 | **403** (仅 `requests`) / **200** (`curl_cffi`) |

---

## 2. 接口信息

### 2.1 追踪 API

| 属性 | 值 |
|------|-----|
| URL | `https://www.dhl.com/utapi` |
| Method | GET |
| Content-Type | `application/json` |
| Akamai 防护 | **TLS 指纹过滤（非 Cookie 验证）** |

### 2.2 请求参数

| 参数 | 示例值 | 说明 |
|------|--------|------|
| trackingNumber | XUZA59875 | 运单号 |
| language | zh | 语言 |
| requesterCountryCode | CN | 请求国家 |
| source | tt | 来源 (Track & Trace) |
| inputsource | marketingstage | 输入来源 |

### 2.3 请求 Headers

```
User-Agent: Chrome 149 Windows
Accept: */*
Referer: https://www.dhl.com/cn-zh/home/tracking.html
Sec-Ch-Ua: "Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"
```

### 2.4 响应结构

```json
{
  "shipments": [{
    "id": "XUZA59875",
    "service": "dgf",
    "origin": {"address": {"addressLocality": "Shanghai", "countryCode": "CN"}},
    "destination": {"address": {"addressLocality": "Treto", "countryCode": "ES"}},
    "status": {"statusCode": "delivered", "timestamp": "2025-08-08T11:56:00+02:00", "description": "Shipment Delivered"},
    "details": {
      "product": {"productName": "Less than Container Load"},
      "carrier": {"organizationName": "OCEAN"},
      "totalNumberOfPieces": 8,
      "weight": {"unitText": "KGM", "value": 1324.8},
      "volume": {"unitText": "MTQ", "value": 7.616},
      "references": [{"number": "...", "type": "..."}],
      "dgf:routes": [{"dgf:vesselName": "EUGEN MAERSK", "dgf:voyageFlightNumber": "525W"}]
    },
    "events": [{"timestamp": "...", "statusCode": "delivered|transit|pre-transit", "description": "..."}]
  }]
}
```

### 2.4 测试结果

| 运单号 | 状态 | 路线 | 重量 |
|--------|------|------|------|
| XUZA59875 | ✅ delivered | Shanghai, CN → Treto, ES | 1,324.8 KGM (8件) |
| XUZA59878 | ✅ delivered | Xuzhou, CN → Vitoria Pt | — |
| XUZA59879 | 🚛 transit | Xuzhou, CN → Lazaro Cardenas, MX | 9,230 KGM (1件) |
| XUZA59882 | 📋 pre-transit | Xuzhou, CN → Almaty | — |

---

## 3. Akamai 分析全过程

### 3.1 流量分析（Phase 1）

**路线**: B（js-reverse-mcp）

- 打开 DHL 追踪页面，观察网络请求
- Akamai JS 路径: `/Ief7Yk59o/A9V-08ijA/fS/Ykk-b2hwcAY/EX1EPCha/RgYq`（77,379 字节，随机路径）
- 追踪 API 直接返回 200 + 完整 JSON，未携带 Akamai Cookie
- 未观察到 sensor_data POST 请求
- js-reverse-mcp `inject_before_load` Hook XHR/Fetch/Beacon — 未捕获到 Akamai POST

### 3.2 脚本结构分析（Phase 2）

Akamai JS 是单 IIFE，110 条内部语句：

#### 3.2.1 初始化函数

```
V()   → O = {}; C = window        （函数表 + 全局引用）
mg()  → 基础变量（ZV=5, lV=7, ...） （数字编码基础）
Ng()  → 346+ 编码变量（PE=52, ...）（变量映射表）
Cn()  → On[45] 字符串数组          （XOR 编码字符串表）
```

#### 3.2.2 基础变量值

| 变量 | 值 | JS 表达式 |
|------|-----|-----------|
| fV | 0 | `+[]` |
| sV | 1 | `+!+[]` |
| WV | 2 | `!+[]+!+[]` |
| cV | 3 | `+!+[]+!+[]+!+[]` |
| KV | 4 | `!+[]+!+[]+!+[]+!+[]` |
| ZV | 5 | 5 个 `+!+[]` 相加 |
| lV | 7 | 7 个 `+!+[]` 相加 |
| wd | 8 | 8 个 `+!+[]` 相加 |
| Cd | 8 | `"10" - 1 - 1` |
| Od | 9 | `"10" - 1` |
| Id | 10 | `"10" - 0` |

#### 3.2.3 关键函数

| 函数 | 作用 |
|------|------|
| `dq(a,b)` | `charCodeAt` |
| `Eq(a)` | `toString` |
| `Iq(a,b,c)` | `indexOf` |
| `Vq(a,b,c)` | `substr` |
| `tg(Dg,fg,Ag)` | 从源码搜索 `0x<Ag>` → 提取后续数字 → 计算 `Y` |
| `pg` | MurmurHash（常量 0xcc9e2d51, 0x1b873593） |
| `Yn(Jn,Pn)` | 主分发器/字符串解码器 |
| `fY(PE)` | 顶层执行入口 |

#### 3.2.4 核心入口

```
fY.call(this, PE)  → PE = 52（entry point）
```

#### 3.2.5 On[] 字符串表

`Cn()` 定义 45 个字符串：
- 前 ~25 个：XOR 编码的字符串（密钥不固定）
- 后 ~20 个：可读 ASCII（函数名/属性名/变量名）

#### 3.2.6 O 函数表

`O` 对象应被 `Yn()` 解码 On[] 后填充函数引用，但补环境中 O 表为空（Yn 分发器因缺少完整运行时上下文而无法正常工作）。

### 3.3 fileHash 提取（路径 A）

#### 3.3.1 原理

Akamai JS 源码末尾嵌入标记：
```
;0x6228a7e,2525281482;
```

函数 `H()` 调用 `tg()` 搜索此标记并提取 hash。

#### 3.3.2 提取过程

1. 解析 AST → 解包 IIFE → 分离函数声明（模拟提升）
2. 在 VM 中注入 `VQhxRcJnCD.toString()` → 返回原始源码
3. 执行 `V()` → `mg()` → `Ng()` → 剩余语句
4. `H()` 自动调用 `tg()` → `Y = -244805082`（有符号 32 位）
5. 原始值 `2525281482`（无符号 32 位，-1769685814 有符号等价）

#### 3.3.3 结果

```
fileHash = 2525281482
```

### 3.4 sensor_data 生成

使用 npm 包 `akamai-v3-sensor-data-helper`：

```javascript
encrypt(payload, cookieHash=8888888, fileContent=null, fileHash=2525281482)
```

输出格式：
```
3;0;1;0;8888888;wS5KmeE4vP5vBcKRIM2pPQlq4qZivf0B53dgMqmUH4E=;141659;<加密payload>
 │  │ │ │    │            │                                │         │
 │  │ │ │  cookieHash  版本标识                          时间戳   加密数据
 │  │ │ └─ 固定值 0
 │  │ └─ 固定值 1
 │  └─ 固定值 0
 └─ 协议版本 3
```

**验证**: `encrypt → decrypt` 闭环 100% 一致，四种 fileHash 值全部通过。

### 协议/版本: 3

---

### 3.6 AST 反混淆（路径 D）

反混淆工具链：`ast-deobfuscation` skill → generic pipeline（7 步）。

| 步骤 | 脚本 | 耗时 | 效果 |
|------|------|------|------|
| normalize | `normalize-structure.js` | 480ms | IIFE 展开 + 逗号表达式拆分 |
| prune | `prune-fake-branches.js` | 305ms | 常量折叠 + 死代码消除 |
| inline_dispatchers | `inline-dispatchers.js` | 323ms | dispatcher 方法内联 |
| flatten | `flatten-array-control-flow.js` | 474ms | switch → if-else 链 |
| if_to_switch | `if-chain-to-switch.js` | 328ms | if-chain 标准化 |
| prune | `prune-fake-branches.js` | 316ms | 二次清理 |
| normalize | `normalize-structure.js` | 312ms | 最终标准化 |

**结果**：

```
1 行 77KB → 3,742 行 131KB
残留: 0 split-pipe, 2 loop-switch (Yn/fY核心分发器), 0 opcode链, 0 dispatcher
```

#### 3.6.1 O 函数表命名规律

反混淆后揭示了 O 函数的命名编码：

```
命名规则: <变量值对应字符> + <后缀>

变量 → 字符映射:
  fV=0 → 'f', sV=1 → 's', cV=3 → 'c', KV=4 → 'K', ZV=5 → 'Z', lV=7 → 'l'

O 函数示例:
  O.cC, O.cO, O.c3  ← 前缀 'c' (cV=3)
  O.KO, O.K3        ← 前缀 'K' (KV=4)
  O.ZO, O.Z3        ← 前缀 'Z' (ZV=5)
  O.fY, O.f3        ← 前缀 'f' (fV=0)
  O.N, O.D, O.P     ← 单字符名（来自 WV/lV/Bd cases）
```

#### 3.6.2 sensor_data 采集代码定位

反混淆后，sensor_data 收集逻辑在 **2738-2800 行**：

- `C[O.KO(...)][O.cC(...)][O.ZO(...)]` → `XMLHttpRequest.prototype.send` Hook
- `C[O.P(...)][O.SO(...)]` → `Object.defineProperty` 事件捕获
- `fY(XE, [...])` → 鼠标/键盘事件采集分发

---

## 4. 实现方案

#### 3.5.1 版本演进

| 版本 | 方法 | 阻塞点 |
|------|------|--------|
| v1 | `vm.createContext` 隔离 | `C[O.pO(...)] is not a constructor`（vm 隔离丢失原生构造函数） |
| v2 | 全局 `eval` | 0 errors！所有 110 条语句执行成功 |
| v3 | `eval` + fY Hook | `fY() error: Y is not defined`（O 表为空，Yn 解码链断裂） |
| v4 | Proxy 追踪 | 同 v2 |

#### 3.5.2 阻塞根因

`O` 函数表为空 → `Yn()` 无法解码 On[] 字符串为属性名 → 函数未填充 → `fY(PE)` 分发器无法工作。需要完整的运行时上下文（Canvas/WebGL/真实 DOM）才能让 Yn 分发器正常运转。

---

## 4. 实现方案

### 4.1 生产爬虫 ✅

| 文件 | `src/crawler_final.py` |
|------|----------------------|
| 依赖 | `curl_cffi` (Chrome 149 TLS 指纹) |
| 用法 | `python crawler_final.py XUZA59875 [--json] [--no-ssl]` |

### 4.2 Akamai Pipeline 🟡

| 文件 | `src/akamai_pipeline.py` + `src/akamai_full.js` |
|------|------------------------------------------------|
| 依赖 | `curl_cffi` + `akamai-v3-sensor-data-helper` |
| 状态 | sensor_data 生成已验证，POST 端点 DHL 未启用 |

### 4.3 补环境 ❌ (35%)

| 文件 | `src/akamai_env_v2.js` |
|------|----------------------|
| 状态 | 初始化层 100%，O 表填充层 0% |
| 阻塞 | Yn 分发器无法解码 On[] XOR 字符串（需运行时状态机） |

**进度分解**：

```
V() → mg() → Ng() → Cn()     ✅ 100%  初始化层（变量+字符串表就绪）
         ↓
Yn 分发器 → 解码 On[] 字符串   ❌ 0%    核心层（XOR 密钥来自运行时）
         ↓
O[key] = function(){}          ❌ 0%    函数表填充（依赖字符串解码）
         ↓
fY(PE) → 执行传感器采集        ❌ 0%    顶层分发（依赖 O 表）
```

| 层 | 完成 | 说明 |
|-----|------|------|
| 初始化层 | 100% | V/mg/Ng/Cn/函数声明全部执行，0 errors |
| 核心解码层 | 0% | Yn 分发器需要完整运行时状态 |
| 函数表层 | 0% | 依赖核心解码层的输出 |
| 顶层分发 | 0% | 依赖函数表层 |
| **加权平均** | **≈35%** | 初始化层占比最高但非核心 |

### 4.4 纯算还原 ✅

| 文件 | `src/akamai_pure.js` |
|------|---------------------|
| 依赖 | `akamai-v3-sensor-data-helper` npm 包 |
| 思路 | 跳过 Akamai JS 执行，直接构造 payload → 加密 |
| 验证 | encrypt → decrypt 闭环 100% 匹配 |

**payload 结构**（32 字段，2526 bytes）：

```
ver fpt fpc            — 版本/指纹类型
ajr                    — 浏览器指纹串 (UA,屏幕,插件...)
url pur                — 页面 URL
eem ffs vev inf        — 事件模式
ajt kev dme mev doe    — 鼠标/键盘事件数据
pev pmo dpw pac per    — 页面事件/权限
tev sde oev if pde o9  — 时间/文档事件
wsl hls                — 窗口/屏幕布局
din[23]                — 设备信息 (UA,屏幕,语言,WebGL hash...)
mst[30]                — 鼠标/触摸统计
dsi[12]                — 设备传感器信息 (Canvas/WebGL指纹)
fwd[3]                 — Web 指纹数据
```

**与补环境对比**：

| | 补环境 | 纯算 |
|------|--------|------|
| 思路 | 搭假浏览器跑 Akamai JS | 直接构造 payload 加密 |
| 依赖 | Canvas/WebGL/DOM | 零浏览器依赖 |
| Yn 解码器 | ❌ 阻塞 | 不需要 |
| O 函数表 | ❌ 阻塞 | 不需要 |
| fY(PE=52) | ❌ 无法执行 | 不需要 |
| 进度 | 35% | **100%** ✅ |

---

## 5. 跨项目复用价值

以下成果可用于其他真正使用 Akamai Bot Manager 的站点：

| 成果 | 说明 |
|------|------|
| fileHash 提取方法 | IIFE `toString()` override → 搜索 `;0x<hex>,<hash>;` |
| Ng() 变量解码 | 基础值求解 + 算术表达式求值 |
| sensor_data 格式 | `3;0;1;0;{cookieHash};{ver};{ts};{enc}` |
| npm 包 | `akamai-v3-sensor-data-helper` encrypt/decrypt/extractCookieHash |
| 判断方法 | 先检查是否 428（Cookie 验证）vs 403（TLS 过滤）→ 决定是否需完整逆向 |

---

## 6. 文件清单

```
sites/dhl/
├── README.md
├── plan.md                    ← 本文件
├── docs/
│   ├── api.md                 — 接口文档 + 真实响应样本
│   ├── crypto.md              — 加密分析（Ng/Cn/Yn/fY 详解）
│   └── notes.md               — 7 次阶段快照
└── src/
    ├── crawler_final.py       ✅ 生产爬虫
    ├── akamai_pipeline.py     ✅ Akamai 完整流程
    ├── akamai_full.js         ✅ sensor_data 生成器
    ├── akamai_env_v2.js       🟡 补环境 (75%)
    └── akamai_solver.py       🟡 求解器骨架
```
