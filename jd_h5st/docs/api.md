# API 文档 — 京东 h5st

> 接口、真实样本、响应、Cookie 传递链

## 1. 接口清单

### 1.1 Token 获取

```
POST https://cactus.jd.com/request_algo
Content-Type: application/json

Request:
{
  "version": "5.3",
  "fp": "<16-char-device-fingerprint>",
  "appId": "73806",
  "timestamp": 1781345481491,
  "platform": "web",
  "expandParams": "",
  "fv": "h5_file_v5.3.4",
  "localTk": ""
}

Response (200):
{
  "status": 200,
  "data": {
    "result": {
      "tk": "tk06...<92 chars>",
      "fp": "<16 chars>",
      "algo": "function test(tk,fp,ts,ai,algo){...}"
    }
  }
}
```

### 1.2 搜索 API

```
POST https://api.m.jd.com/api
Content-Type: application/x-www-form-urlencoded

Query: ?appid=search-pc-java&functionId=pc_search_searchWare

Body (form-encoded):
  body={"enc":"utf-8","pvid":"...","from":"home","area":"14_1167_1170_19060","page":1,"s":1}
  &

Required Headers:
  - Cookie: <browser-session-cookies>
  - x-api-eid-token: <value-of-3AB9D23F7A4B3CSS-cookie>
  - User-Agent: Chrome 148

Response (200):
{
  "code": "605",           // 605 = 风控挑战
  "echo": "the request needs to authenticate"
}
// 或正常数据响应
```

### 1.3 搜索页面（h5st 原始来源）

```
GET https://search.jd.com/Search?keyword=xxx&enc=utf-8
  → 加载 main_search/pro/0.0.11/js/index.*.js
  → 调用 window.PSign.sign(f) → 返回 h5st
```

## 2. Cookie 角色

| Cookie | 用途 | 传递方式 |
|--------|------|----------|
| `pin` / `pinId` / `unick` | 登录用户标识 | API Cookie |
| `__jdu` / `__jdv` / `__jda` / `__jdb` / `__jdc` | 京东设备跟踪 | API Cookie |
| `shshshfpa` / `shshshfpb` | 安全会话指纹 | API Cookie |
| `3AB9D23F7A4B3CSS` | 安全令牌 | Cookie + 独立 Header `x-api-eid-token` |
| `thor` | 威胁检测令牌 | Cookie |
| `sdtoken` | 安全设备令牌 | Cookie |

## 3. 样本锚点

- 指纹种子数据（`localStorage` 中的 `WQ_dy1_vk`、`WQ_gather_cv1`、`WQ_gather_wgl1`）由浏览器沙箱预填
- fingerprint (16 char) 来自 Canvas 指纹 MD5 → 存入 `WQ_dy1_vk` JSON 结构
- tk (92 char) 来自 `request_algo` 响应，由 `_$pam()` 应用到 `_algos` 表中
