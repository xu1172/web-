# 加密定位 — 京东 h5st

> 函数定位、Hook 命中、输入输出对照

## 1. 核心函数定位

### 1.1 主签名入口

- **文件**: `assets/js/js_security_v3_0.1.4.js`
- **类**: `ParamsSign`（全局暴露 `window.ParamsSign`）
- **方法**: `sign(f)` → `signSync(f)`

### 1.2 栈虚拟机

- **方法**: `_$sdnmd(f)`
- **特征**: 500+ case 的 while/switch + 程序表驱动
- **输入**: 签名请求对象 `f`（含 `appid`, `functionId`, `body`）
- **输出**: 完整 h5st 字符串（10 段，分号分隔）

### 1.3 Token 应用

- **方法**: `_$pam(tk, algo)`
- **输入**: `tk` — 92 字符会话密钥, `algo` — 算法字符串（`function test(...){}`）
- **输出**: 设置 `_isNormal=true`，填充 `_algos` 和 `_defaultAlgorithm`

### 1.4 指纹初始化

- **方法**: `_$rds()`
- **链**: `_$rds()` → `setTimeout` → `_$rgo()` → `_$ram()` → Canvas 指纹 → `_$YJ.post()` XHR

### 1.5 XHR 通道

- **方法**: `_$YJ.post(url, body, callback, errback)`
- **实现**: 内部 `new window.XMLHttpRequest()`（非 fetch）
- **拦截**: XHR 桩在沙箱中转发到 `cactus.jd.com/request_algo`

## 2. 算法类型

| 组件 | 算法 | 说明 |
|------|------|------|
| 段 5 (signHash) | SHA256 | 请求参数签名 |
| 段 9 (checksum) | SHA256 | h5st 整体校验和 |
| 指纹 | MD5 | Canvas → 像素数组 → MD5 → 32 字符 |
| Token 应用 | `_$pam` 自定义 | 将 tk/algo 写入内部 `_algos` 表 |

## 3. 关键修复

### 3.1 `yyyy` 日期格式缺陷

```javascript
// 改前（闭包变量 _$fw 被覆盖，RegExp.$1 获取错误匹配）:
/(y+)/i.test(_$fw) && (_$fw = _$fw.replace(RegExp.$1, String(_$fG.getFullYear())...))

// 改后:
_$fw = _$fw.replace(/y+/i, String(_$fG.getFullYear()))
```

**影响**: 无修复时 h5st 段 1 为 `yyyy0613...`，修复后为 `20260613...`

## 4. 输入输出对照

### 4.1 `_$rds()` 前

```
_defaultAlgorithm: {}
_algos: {}
_isNormal: false
```

### 4.2 `_$rds()` → `_$ram()` → `_$YJ.post()` → `_$pam()` 后

```
_defaultAlgorithm: { algo_0: ..., algo_1: ... }
_algos: { algo_0: ..., algo_1: ..., tk06...: ... }
_isNormal: true
fingerprint: "jj2jije51bbezz26"
```

### 4.3 `sign()` 前 vs 后

```
输入: { appid:"search-pc-java", functionId:"pc_search_searchWare", body:{enc:"utf-8",...} }

输出 h5st (10 段):
  20260613173005123;jj2jije51bbezz26;73806;tk06...;5.3;1781345481491;...5.3;1781345481491;...;...
```
