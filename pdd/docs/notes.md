# Phase 0 · 情报摘要

对拼多多 H5 `mobile.yangkeduo.com` 的 anti_content / 推荐流接口已知情报总结，
用于指引后续流量抓取与加密定位。

## 1. 站点特征

- 域名：`mobile.yangkeduo.com`（移动 H5）
- 入口 HTML：`GET /` 返回带 `<script>` 引用的 CSR React 应用
- 静态资源 CDN：`https://static.pddpic.com/assets/js/<chunkId>_<hash>.js`
- 风控 JS：`https://static.pddpic.com/assets-rcf/<hash>.js`（经实证为埋点上传器，**与 anti_content 生成无关**）
- 首屏接口：`/proxy/api/...` 前缀，受同源风控拦截
- 不需要登录即可访问首页推荐流（游客 `pdduid=0`）

## 2. anti_content 家族判断

- 字符特征：以 `0as` 开头，长度 ≈ 470–700，Base64 变体字符集（含 `-` `_`）
- 行业公开线索：PDD `anti_content` 属于「自定义 VMP + 指纹采样混合」
- 依赖浏览器环境：navigator / document / screen / performance / canvas / webgl / userAgent / referrer / cookie
- 编码机制：内部使用 msgpack + 指纹拼装 + 自研 VMP 序列化，每次生成都不同

## 3. hub/v3 接口初步猜测（待 Phase 1 实证）

| 字段 | 来源 | 是否加密 |
|---|---|---|
| `anti_content` | 本地补环境生成 | ✓ |
| `pdduid` | 游客 0 / 登录后自动 | ✗ |
| `offset` / `count` / `list_id` | 分页协议 | ✗ |
| `page_sn` / `page_id` | 页面语义标识 | ✗ |

Phase 1 实证结论见 `api.md`：全部已确认，且 `anti_content` 是唯一需要逆向的动态加密参数。

## 4. 关键工具

- AdsPower 浏览器（Profile `k1bhfp97`，端口 50325） → 抓流量、读 DevTools
- `js-reverse-mcp` → `list_network_requests`、`set_breakpoint_on_text`、`evaluate_script`
- Node `vm.createContext` → 最小化沙箱、隔离真实全局
- `requests` → 发协议请求；不使用 `aiohttp` 以便保持简洁
