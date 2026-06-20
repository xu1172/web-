# CRV 滑块验证码请求链路分析

## 分析时间
2026-04-23

## 验证码框架识别

**极验 (Geetest) 定制化版本**

确认依据：
- HTML 类名全部以 `geetest_` 开头（`geetest_captcha`, `geetest_slice`, `geetest_bg` 等）
- 全局存在 `window.Geetest`、`window.initGeetest`、`window.Geetest_LANG`
- 请求域名 `athena.crv.com.cn` / `athenares.crv.com.cn` 为华润自建的极验服务
- 核心参数名符合极验特征：`captcha_id`、`challenge`、`lot_number`、`w`

## 请求链路

### 1. 页面加载阶段

| 接口 | 方法 | 说明 |
|------|------|------|
| `https://cpcloud.crv.com.cn/api/cmp-gateway/app/common` | GET | 应用通用配置 |
| `https://cpcloud.crv.com.cn/api/fea-vsmp/rotationchart/view/listRotationChart` | GET | 轮播图 |
| `https://cpcloud.crv.com.cn/api/fea-vsmp/vender/introduce/portal/venderintroduce/isOpenAegis` | GET | 是否开启风控 |
| `https://cpcloud.crv.com.cn/api/fea-vsmp/login/turnOnValidate` | GET | 是否开启验证码验证 |

### 2. 验证码初始化阶段

**接口**: `GET https://athena.crv.com.cn/load`

**请求参数**:
```
captcha_id=a755b69aedd176d3cd4f8a515d07a69f
risk_type=slide
challenge=004e1d6c-e5d4-40b0-9ef0-66e6ad1a3829
client_type=web
callback=geetest_1776924508869
```

**关键参数说明**:
- `captcha_id`: 固定值，站点标识
- `challenge`: UUID 格式，每次初始化生成
- `risk_type=slide`: 确认为滑块类型
- `callback`: JSONP 回调函数名

**加载资源**:
- `https://athenares.crv.com.cn/www/js/captcha.1.0.0.js` (208KB, 主逻辑)
- `https://athenares.crv.com.cn/www/js/gct.1.0.0.9.js` (环境检测/指纹)
- `https://athenares.crv.com.cn/www/i18n/zh.js` (国际化)
- `https://athenares.crv.com.cn/www/css/captcha/style.css`

### 3. 验证码二次加载

**接口**: `GET https://athena.crv.com.cn/load`

**请求参数**:
```
captcha_id=a755b69aedd176d3cd4f8a515d07a69f
lot_number=981a21d17792f05d5bee07f2c83eb8cd
challenge=004e1d6c-e5d4-40b0-9ef0-66e6ad1a3829
risk_type=slide
callback=geetest_1776924508838
```

注意：第二次 load 携带了第一次返回的 `lot_number`，用于获取具体题目图片。

### 4. 图片资源

| 资源 | URL 模式 | 说明 |
|------|----------|------|
| 滑块图 | `.../slide/slice/{uuid}.png` | 粉色滑块拼图 |
| 缺口背景图 | `.../slide/bg/{uuid}.png` | 带缺口的背景 |
| 完整背景图 | `.../slide/fullbg/{uuid}.png` | 无缺口完整背景（用于识别） |

**当前样本**:
- slice: `e62d821033764003b949fe6e24ec3900.png`
- bg: `e62d821033764003b949fe6e24ec3900.png`
- fullbg: `502dc1b3-f329-42ac-8dc7-9ccea77aa7a2.png`

### 5. 验证提交阶段

**接口**: `GET https://athena.crv.com.cn/verify`

**请求参数**:
```
lot_number=981a21d17792f05d5bee07f2c83eb8cd
captcha_id=a755b69aedd176d3cd4f8a515d07a69f
client_type=web
challenge=004e1d6c-e5d4-40b0-9ef0-66e6ad1a3829
pt=10
w={加密参数，长度约600+字符}
callback=geetest_1776924506083
```

**关键参数说明**:
- `lot_number`: 题目批次号
- `challenge`: 初始化返回的挑战码
- `pt=10`: 固定值，可能为版本或类型标识
- `w`: 核心加密参数，包含轨迹、缺口距离、环境指纹等

### 6. 登录提交阶段（待确认）

用户提供的 token: `tR5pqscPQ0EI8n7thn38hAIyyakstNb6-DFUuT9pGwI`

**分析**: 该 token 未在验证码初始化/验证链路中出现，推测为登录接口本身使用的 token（如预登录获取或前端生成的临时 token），在验证码通过后随登录表单一并提交。

## 核心突破口

1. **w 参数生成**: 位于 `captcha.1.0.0.js` 或 `gct.1.0.0.9.js` 中，需 AST 解混淆后定位 builder 函数
2. **缺口识别**: 可通过对比 `bg.png` 与 `fullbg.png` 计算像素差，或使用云码识别
3. **轨迹模拟**: 极验标准滑块轨迹，需包含时间戳、坐标、状态码
4. **环境检测**: `gct.js` 中已发现 webdriver、chrome、plugins、mimeTypes 检测逻辑

## 下一步

1. 对 `captcha.js` 和 `gct.js` 进行 AST 解混淆
2. 在 verify 接口设置断点，Hook `w` 参数生成
3. 提取核心加密算法，在 Node.js 中复现
