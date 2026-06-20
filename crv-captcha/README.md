# CRV 极验4 滑块验证码纯协议逆向工程

华润万家供应商服务系统(CRV) 极验4滑块验证码纯协议破解，无需浏览器/模拟滑动，直接通过 HTTP 请求完成验证码识别与提交。

## 项目概述

- **目标站点**: `https://cpcloud.crv.com.cn/web/fea-vsmp/login`（华润万家供应商服务系统）
- **验证码框架**: 极验4定制版（Geetest 4）
- **验证码类型**: 滑块验证（slide）
- **API 端点**: `https://athena.crv.com.cn`（业务）/ `https://athenares.crv.com.cn`（静态资源）
- **识别服务**: 云码打码平台 (Yuma API, type=20111)
- **核心成果**: 完整三步协议流程，verify2 稳定返回 `result=success`，score=3

## 项目结构

```
crv-captcha/
├── assets/                             # 极验JS资源文件
│   ├── captcha_live_patched.js         # [核心] 修补版极验主JS（208KB），暴露 __encrypt/__gct 内部函数
│   ├── gct.js                          # [核心] gct 运行时脚本（6.6KB），生成 gct 数字令牌和 em 环境指纹
│   ├── okq_strings.json                # 字符串解码字典（XOR密钥 'TwIa[q' 解码 okq() 混淆字符串表）
│   ├── deob-captcha/
│   │   ├── final.js                    # 解混淆后的 captcha 源码（参考用）
│   │   └── pipeline-report.json        # 解混淆流水线报告
│   └── deob-gct/
│       ├── final.js                    # 解混淆后的 gct 源码（参考用）
│       └── pipeline-report.json        # 解混淆流水线报告
├── src/                                # 核心脚本
│   ├── test_full_protocol.py           # [核心] 完整协议测试入口，编排三步验证流程
│   ├── generate_w.js                   # [核心] w 参数生成器（Node.js vm 加载极验JS + 补环境）
│   ├── encrypt_w_helper.js             # [备用] 纯算法 w 参数生成（AES-128-CBC + RSA-1024，不依赖极验JS）
│   ├── hook_encrypt.js                 # Hook 分析工具：在 vm 中劫持 encrypt 函数捕获明文 s 对象
│   ├── decode_okq.js                   # 字符串解码工具：从 final.js 提取 okq() 字符串表
│   └── run_okq.js                      # okq 解码运行入口
├── env/
│   └── browser.js                      # 最小浏览器补环境框架（vm2 context）
├── logs/
│   └── request-chain.md                # 请求链路分析文档（HTML分析、网络抓包记录）
├── package.json                        # Node.js 依赖：crypto-js、node-rsa
└── package-lock.json
```

## 三步协议流程

```
load1 ──→ verify1 (pt=10, ai无感) ──→ load2 ──→ 云码识别 ──→ verify2 (pt=10, slide滑块)
 ↓              ↓                          ↓                        ↓
获取lot_number  加密s={geetest,gct,em,    获取图片URL + ypos        加密s={geetest,gct,em,
challenge       type:"ai",passtime:10}    新lot_number              trackOffset,type:"slide",
               w=512                     新challenge               answer:gap_x*0.9,
                                                                    passtime}
                                                                   w=640
```

### 详细步骤

| 步骤 | 接口 | 关键参数 | 说明 |
|------|------|----------|------|
| Step 1: load1 | `GET /load` | `captcha_id`, `challenge`, `risk_type=slide` | 首次加载，返回 `lot_number`、`pt=10`、`captcha_type=ai` |
| Step 2: 生成 w1 | 本地 Node.js | `verify1` 模式 | `s` 对象为 `{geetest,gct,em,type:"ai",passtime:10}`，w=512 |
| Step 3: verify1 | `POST /verify` | `lot_number`, `w`, `pt=10` | 无感验证，预期返回 `result=fail`（正常，标记 lot 已验证） |
| Step 4: load2 | `GET /load` | 带上 `lot_number` | 二次加载，返回 `captcha_type=slide` + 图片路径 + 新 `lot_number`/`challenge` |
| Step 5: 下载图片 | `GET` 静态资源 | bg / fullbg / slice | 下载滑块背景图、完整背景图、滑块图 |
| Step 6: 云码识别 | Yuma API | type=20111 | 传入 `slide_image` + `background_image` base64，返回缺口 x 坐标 |
| Step 7: 生成轨迹 | 本地 | Python/JS | 生成带 y 轴抖动的自然轨迹 |
| Step 8: 生成 w2 | 本地 Node.js | `slide` 模式 | `s` 对象包含 `trackOffset`、`answer`（缩放后坐标）、`passtime`，w=640 |
| Step 9: verify2 | `POST /verify` | `lot_number2`, `w2`, `pt=10` | 滑块验证，成功返回 `result=success`、score=3、pass_token |

## w 参数生成机制

### 加密结构

```
w = AES-128-CBC密文(hex) + RSA-1024加密AES密钥(hex)
```

- **AES-128-CBC**: 随机 16 位 hex key（8字节），IV 固定为 `"0000000000000000"` Latin1 编码
- **RSA-1024**: PKCS#1 v1.5 填充，加密 AES key
- **明文**: `s` 对象的 JSON 字符串

### s 对象结构

**verify1 (ai 无感验证)**:
```json
{
  "geetest": "captcha",
  "gct": "138800804",
  "em": {"ph": 0, "cp": 0, "ek": "11", "wd": 1, "nt": 0, "si": 0, "sc": 0},
  "type": "ai",
  "passtime": 10
}
// JSON 长度约 115 字符 → AES 密文 128 字符 → w=128+256=384，但实际为 512（增加了随机填充）
```

**verify2 (slide 滑块验证)**:
```json
{
  "geetest": "captcha",
  "gct": "138800804",
  "em": {"ph": 0, "cp": 0, "ek": "11", "wd": 1, "nt": 0, "si": 0, "sc": 0},
  "trackOffset": "s0s1...",
  "type": "slide",
  "answer": 161,
  "passtime": 2200
}
// trackOffset 约 27 字符 → JSON 长度约 192 → w=640
```

### w 长度公式

```
w_length = ceil((json_len + 1) / 16) * 16 * 2 + 256
```

- verify1: json ≈ 115 → padded=128 → AES hex=256 → w=512
- verify2: json ≈ 192 → padded=192 → AES hex=384 → w=640

### trackOffset 轨迹编码

轨迹差分编码流程：
1. **calcData**: 对轨迹点做差分 `[dx, dy, dt]`，连续相同 dx/dy 的 dt 累加
2. **encodeSpecial**: `[dx, dy]` 若为常见模式（如 `[1,0]`, `[2,0]`, `[1,-1]` 等 9 种），编码为单字母 `s~z`
3. **encodeNum**: 数值用 73 字符基表编码，负数加 `!` 前缀，大数加 `$` 前缀

关键要求：
- 轨迹点数控制在 **3 点**（起点、中间点、终点），确保 trackOffset 短而 w=640
- 必须带 **y 轴随机抖动**（±3px），全 0 轨迹被判定为机器人

## 关键参数与配置

### 站点配置

| 参数 | 值 | 说明 |
|------|-----|------|
| `captcha_id` | `a755b69aedd176d3cd4f8a515d07a69f` | 华润 CRV 站点标识 |
| `API_BASE` | `https://athena.crv.com.cn` | 极验业务 API |
| `STATIC_BASE` | `https://athenares.crv.com.cn` | 静态资源 CDN |
| `challenge` | UUID 格式 | 每次会话随机生成 |

### 云码配置

| 参数 | 值 | 说明 |
|------|-----|------|
| `type` | `20111` | 极验4滑块识别类型 |
| `API` | `http://api.jfbym.com/api/YmServer/customApi` | 云码自定义 API |
| `slide_image` | 滑块原图 base64 | 80×80 粉色滑块 |
| `background_image` | 背景原图 base64 | 300×200 带缺口背景 |

### 图片缩放因子

**关键发现**: 图片原始宽度 300px，但在 Canvas 中显示约 270px，极验服务端使用的坐标系统基于 Canvas 尺寸。

```
answer = round(gap_x * 0.9)
```

云码返回的是图片像素坐标（0~300），需要乘以 0.9 转换为服务端坐标。

### 图片规格

| 图片 | 尺寸 | 说明 |
|------|------|------|
| bg | 300×200 | 带缺口的背景图 |
| fullbg | 300×200 | 完整背景图 |
| slice | 80×80 | 滑块拼图 |
| ypos | 整数 | 滑块的垂直偏移位置 |

## 运行方式

### 环境要求

- **Python 3.8+**: requests
- **Node.js 18+**: crypto-js, node-rsa

### 安装依赖

```bash
cd crv-captcha
npm install
```

### 执行测试

```bash
cd src
python test_full_protocol.py
```

成功输出示例：
```
=== 验证成功! ===
[verify2] status=success result=success
score=3, pass_token=133a746ebb55...
```

## 技术要点总结

### 成功关键因素

1. **w 参数 w=640 要求**: trackOffset 必须约 25-35 字符，轨迹点数控制为 3 点
2. **answer 缩放 0.9**: 图片坐标系到 Canvas 坐标系的转换
3. **y 轴抖动**: 轨迹中 y 坐标不能全为 0，必须包含 ±3px 随机抖动
4. **三步协议**: 必须先 verify1（预期 fail）才能 load2 拿到滑块图片
5. **load2 返回新参数**: verify2 必须使用 load2 返回的新 `lot_number` 和 `challenge`

### 补环境方案

`generate_w.js` 在 Node.js 中通过 `vm` 模块创建沙箱环境，加载极验原版 JS，补全浏览器 API：

- **document/canvas/navigator**: 核心 DOM 和指纹 API
- **XMLHttpRequest**: Mock 实现，不发送真实网络请求
- **performance.timing**: 模拟浏览器性能时间线
- **localStorage/sessionStorage**: 内存存储
- **Geetest_LANG**: 预置极验语言包

### 安全特征规避

极验4 检测以下特征并在验证失败时返回 `result=fail`：
- 轨迹 y 轴全为 0（机器人特征）
- answer 值异常（超出图片范围）
- w 参数长度异常（不是 512 或 640）
- passtime 过短（< 100ms）
- 轨迹点数过多（trackOffset 过长导致 w > 640）
