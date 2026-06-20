# jd_h5st 逆向方案

> 日期: 2026-06-13
> 状态: Phase 4 进行中 — h5st 签名已还原，605 风控待解决

## 1. 目标接口

| 项目 | 值 |
|------|-----|
| 搜索 API | `POST https://api.m.jd.com/api` |
| Token 接口 | `POST https://cactus.jd.com/request_algo` |
| functionId | `pc_search_searchWare` |
| appId | `search-pc-java` |
| Content-Type | `application/x-www-form-urlencoded` |

## 2. 请求参数

### 搜索 API 载荷

```json
{
  "enc": "utf-8",
  "pvid": "<uuid>",
  "from": "home",
  "area": "14_1167_1170_19060",
  "page": 1,
  "s": 1
}
```

### 必需 Headers

| Header | 来源 |
|--------|------|
| `h5st` | Node.js 签名器生成 |
| `Cookie` | 浏览器会话（含 `pin`, `__jdu`, `shshshfpb`, `3AB9D23F7A4B3CSS` 等） |
| `x-api-eid-token` | Cookie 中 `3AB9D23F7A4B3CSS` 的值 |
| `User-Agent` | Chrome 148 |

### 动态参数

| 参数 | 长度 | 来源 |
|------|------|------|
| h5st | ~860 | `js_security_v3_0.1.4.js` → `ParamsSign.sign()` |
| fingerprint | 16 | Canvas 指纹 + localStorage 种子数据 |
| sessionKey (tk) | 92 | `cactus.jd.com/request_algo` 响应 |

## 3. h5st 结构（10 段，分号分隔）

| # | 名称 | 长度 | 说明 |
|---|------|------|------|
| 1 | datetime | 17 | `YYYYMMDDHHMMSSmmm` |
| 2 | fingerprint | 16 | 设备指纹 |
| 3 | appId | 5 | Token 标识 |
| 4 | sessionKey | 92 | `tk06...` |
| 5 | signHash | 64 | SHA256 请求签名 |
| 6 | version | 3 | 固定 `5.3` |
| 7 | timestamp | 13 | 毫秒时间戳 |
| 8 | encodedPayload | 544 | 编码请求载荷 |
| 9 | checksum | 64 | SHA256 校验和 |
| 10 | fixedSuffix | 60 | 全局固定值 |

## 4. 加密方式

- **实现方案**: Node.js VM 沙箱 + 纯算还原（无需补环境大框架）
- **算法类型**: `_$sdnmd` 500+ case 栈虚拟机 + SHA256 + `_$pam` Token 应用
- **关键修复**: `yyyy` 日期格式字符串缺陷（单行 patch）
- **指纹**: Canvas 确定性桩（@napi-rs/canvas → 32 字符 MD5）
- **Token 获取**: XHR 桩拦截 `request_algo` 响应 → 自动调用 `_$pam(tk, algo)`

## 5. 已验证结论

- [x] JS 沙箱加载成功
- [x] `yyyy` 日期修复 → h5st 段 1 正确
- [x] `_$rds()` 指纹读取 → 生成 16 字符 fp
- [x] `request_algo` → 200 返回 `{tk, algo}`
- [x] `_$pam(tk, algo)` → `_isNormal=true`
- [x] `sign()` → 完整 10 段 h5st
- [x] API 调用 → 200 OK（非 403）
- [ ] 605 风控 → Canvas 指纹被识别为合成

## 6. 待验证/待解决

- [ ] 605 风控 — Canvas 指纹需匹配真实 Chrome 148 渲染参数
- [ ] Cookie 有效期与刷新策略
- [ ] h5st 过期时间与复用策略

## 7. 实现方案确认

- **方式**: 纯算（Node.js VM 沙箱源码级还原）
- **Python 集成**: `subprocess` 调用 Node.js 签名器，或 stdio JSON-RPC 长连接
- **验证码**: 当前 605 返回 `evType:3`，方向为优化 Canvas 桩或接入验证码处理
