# API · hub/v3 首页推荐流

Phase 1（AdsPower + `js-reverse-mcp`）动态抓取结果，已作为 `src/main.py` 的协议基线。

## 1. 基本定义

| 项 | 值 |
|---|---|
| Method | `GET` |
| URL | `https://mobile.yangkeduo.com/proxy/api/api/alexa/cells/hub/v3` |
| 场景 | 首页推荐流（下拉触发） |
| 登录 | 不需要，`pdduid=0` |
| Content-Type | 响应 `application/json;charset=UTF-8` |

## 2. Query 参数

| 参数 | 类型 | 示例 | 说明 |
|---|---|---|---|
| `pdduid` | string | `0` | 游客模式固定 0 |
| `platform` | string | `H5` | 端类型 |
| `page_sn` | string | `10002` | 页面编号（首页） |
| `page_id` | string | `index_list.html` | 页面逻辑 ID |
| `engine_version` | string | `3.0` | PDD 前端引擎版本 |
| `offset` | number | `10` / `30` / `50` / `70` / `90` | 分页起点（count 间隔滚动） |
| `count` | number | `20` | 每页条数（固定 20） |
| `list_id` | string | `wgxptmt48f` | 会话粘性的推荐流 ID |
| `anti_content` | string | `0asAfa5E...`（≈470–700） | **动态加密参数，由 Node 补环境生成** |

## 3. Headers（最小必要集）

| Header | 值 |
|---|---|
| `User-Agent` | iPhone Safari Mobile UA（见 `main.py`） |
| `Referer` | `https://mobile.yangkeduo.com/` |
| `Origin` | `https://mobile.yangkeduo.com` |
| `Accept` | `application/json, text/plain, */*` |
| `Accept-Language` | `zh-CN,zh;q=0.9` |
| `anti-content` | **与 query 中 `anti_content` 相同值** |

其他常见 Cookie（`api_uid`/`_nano_fp`/`webp`）不是必需项：本协议在游客模式无 Cookie 也能拿到 200。

## 4. 响应结构（裁剪）

```json
{
  "has_more": true,
  "data": {
    "list_id": "wgxptmt48f",
    "goods_list": [
      {
        "data": {
          "goods_id": 785925741090,
          "goods_name": "...",
          "short_name": "...",
          "market_price": 2800,       // 分
          "normal_price": 2189,       // 分
          "sales_tip": "本店已拼3770件",
          "thumb_url": "https://img.pddpic.com/.../xxx.jpeg",
          "link_url": "goods.html?goods_id=..."
        }
      }
    ]
  }
}
```

字段补充：
- `market_price` / `normal_price` 单位为「分」。
- 响应中极少条目会带 `mall_id`；如需店铺维度数据可单独请求店铺 API。
- `goods_list[].data.link_url` 里的 `_oak_rcto` 是本次推荐的曝光 token，调用端无需关心。

## 5. 分页行为实测

| page | offset | count | 新增商品 | 说明 |
|---|---|---|---|---|
| 1 | 10 | 20 | 20 | 首页首次滚动 |
| 2 | 30 | 20 | ~14 | 与 page 1 有少量重复（推荐策略特性） |
| 3 | 50 | 20 | ~15 | 同上 |
| 4 | 70 | 20 | ~19 | 同上 |
| 5 | 90 | 20 | 0 | 推荐流到顶，`goods_list` 为空数组 |

同一 `list_id` 下连续 5 页，实际稳定得到 **≈ 68 条唯一商品**。

## 6. 失败模式

| 现象 | 成因 | 处置 |
|---|---|---|
| 响应 `goods_list` 为 `[]` | offset 超过推荐流上限 | 视为采集结束 |
| HTTP 200 但 `data` 为 null / 含 `error_code` | `anti_content` 被风控判失效 | 重新请求 Node 生成并重试一次 |
| HTTP 403 / 风控页 | 单 IP 高频 | 降频（>= 1.5 s/req），换出口 IP |
| 脚本启动时 `chunk_3636.js` 加载失败 | PDD 发版更新了 chunk hash | 参考 `README.md` 步骤重抓 |
