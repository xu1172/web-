# 京东 h5st 签名逆向

> **目标站点**: `api.m.jd.com` / `cactus.jd.com`
> **目标参数**: h5st — 京东搜索 API 签名令牌（v5.3，10 段分号分隔结构）
> **状态**: ✅ API 200 OK，h5st 通过服务器校验；剩余 605 风控验证
> **日期**: 2026-06-13

## 是什么

京东 h5st 是京东搜索接口（`pc_search_searchWare` 等）的 **动态签名令牌**，由客户端安全 JS `js_security_v3_0.1.4.js` 实时生成。本项目在 Node.js VM 沙箱中源码级还原其生成逻辑，实现 **纯算本地生成** h5st，用 Python `requests` 协议直连 API。

## 核心文件

| 文件 | 作用 |
|------|------|
| `assets/js/js_security_v3_0.1.4.js` | 京东原始安全 JS（232KB，混淆） |
| `assets/js/js_security_v3_0.1.4_patched.js` | 修复版（yyyy 日期缺陷单行 patch） |
| `src/jd_h5st_signer.js` | 主签名器（v8 最终版，XHR 自动 token 应用） |
| `src/browser_stubs.js` | Canvas/WebGL/Audio 浏览器指纹桩 |
| `src/check_algos.js` | 算法键检查脚本 |
| `src/crawl_test.js` | Node.js 端到端验证 |
| `src/crawl_test.py` | Python 协议侧端到端验证 |

## 调用链

```
sign(f) → _$sdnmd(f) [500+ case 栈虚拟机]
              ↓
        _$pam(tk, algo) [Token 应用]
              ↓
        _$rds() [指纹 + 令牌初始化]
              ↓
        _$rgo() → _$ram() → Canvas 指纹 → _$YJ.post() → XHR
              ↓
    POST cactus.jd.com/request_algo → {tk, fp, algo}
```

## 使用示例

```javascript
const { JdH5stSigner } = require('./src/jd_h5st_signer');
const signer = await JdH5stSigner.create({ appId: '73806' });
const { h5st } = await signer.sign({
  appid: 'search-pc-java',
  functionId: 'pc_search_searchWare',
  body: { enc: 'utf-8', pvid: '...', from: 'home', page: 1, s: 1 },
});
// API 调用需附带 Cookie + x-api-eid-token header
```

## 关键发现

1. `_$sdnmd` 是 500+ case 的栈虚拟机，while/switch + 程序表驱动
2. `yyyy` 日期缺陷是格式字符串闭包变量覆盖问题（非反自动化标记），单行 patch 修复
3. `_$YJ.post()` 使用 XHR 而非 fetch，沙箱需提供完整 XHR 实现
4. `_$pam(tk, algo)` 是 Token 唯一应用入口，设置 `_isNormal=true`
5. Canvas 指纹决定风控评级，确定性桩可生成合法 MD5 但可能被识别为合成
