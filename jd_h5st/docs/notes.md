# 阶段快照 — 京东 h5st

## Snapshot 1 — 初始化
- **Time**: 2026-06-13 14:00
- **Route**: B（js-reverse-mcp 分析）→ 纯算还原（Node.js VM）
- **Scope**: `js_security_v3_0.1.4.js` 加载到 Node.js VM 沙箱
- **Confirmed**: JS 可在 VM 中运行，需要 localStorage、crypto.webcrypto、XHR 桩
- **Gap**: Canvas 指纹、Token 获取、sign() 调用链未验证
- **Next**: 实现浏览器桩，打通完整签名链

## Snapshot 2 — yyyy 日期缺陷修复
- **Time**: 2026-06-13 15:51
- **Route**: 纯算还原
- **Scope**: h5st 段 1 日期格式
- **Confirmed**: `yyyy` 不是反自动化标记，是 `_$sdnmd` 内闭包变量覆盖导致的正则匹配错误；单行 patch 修复
- **Gap**: 仍需确认其他 9 段是否完整正确
- **Next**: 验证 Token 获取链（`_$YJ.post()` → `request_algo` → `_$pam()`）

## Snapshot 3 — Token 链打通
- **Time**: 2026-06-13 17:45
- **Route**: 纯算还原
- **Scope**: `_$rds()` → `_$rgo()` → `_$ram()` → `_$YJ.post()` → `_$pam(tk, algo)` 完整链
- **Confirmed**: XHR 桩拦截 `request_algo` 响应自动调用 `_$pam(tk, algo)`，`_isNormal=true`，`_algos` 表正确填充
- **Gap**: 最终 h5st 段 5 (signHash) 和段 9 (checksum) 为 SHA256，需验证服务端校验
- **Next**: 用完整 h5st 调用搜索 API，验证服务端响应

## Snapshot 4 — API 200 OK
- **Time**: 2026-06-13 18:12
- **Route**: 纯算还原 → 协议请求
- **Scope**: Node.js 生成 h5st → Python/Node.js 调用 `api.m.jd.com/api`
- **Confirmed**: h5st 通过服务器校验（200 非 403），段结构完整，SHA256 签名正确
- **Gap**: API 返回 `code:605` "需要验证" → Canvas 指纹被识别为合成（MD5 不在服务器白名单中）
- **Next**: 优化 Canvas 桩渲染参数匹配真实 Chrome 148，或接入验证码处理

## Snapshot 5 — 浏览器指纹桩迭代
- **Time**: 2026-06-13 18:12+
- **Route**: 纯算还原
- **Scope**: `browser_stubs.js` Canvas/WebGL/Audio 桩
- **Confirmed**: `@napi-rs/canvas` Skia 引擎渲染，`browser_stubs.js` 已实现但未集成到 `jd_h5st_signer.js`（当前使用确定性像素桩）
- **Gap**: 605 风控未解决，指纹与真实浏览器有差异
- **Next**: 集成 `@napi-rs/canvas` 到主签名器，用真实 Canvas 渲染替代确定性桩
