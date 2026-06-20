# DHL 快递追踪 - Akamai 3.0 逆向

> 目标: `https://www.dhl.com/cn-zh/home/tracking.html?tracking-id=XUZA59875`
> 追踪号码: XUZA59875
> 防护: Akamai Bot Manager 3.0

## 逆向目标

1. 突破 Akamai 428 防护，获取有效 `_abck` Cookie
2. 调用 DHL tracking API 获取物流轨迹数据
3. 双路线实现：纯算还原 + 补环境

## 关键 Cookie

| Cookie | 说明 |
|--------|------|
| `_abck` | 信任状态标记（~0~=通过） |
| `bm_sz` | 验证状态加密 cookie |
| `ak_bmsc` | 性能优化 cookie |

## Akamai 流程

```
GET /tracking.html → 提取 JS URL → GET sensor.js → 生成 sensor_data
→ POST sensor_data → 获取有效 _abck → GET tracking API
```

## 文件结构

- `plan.md` - 执行方案
- `docs/api.md` - 接口文档
- `docs/crypto.md` - 加密分析
- `docs/notes.md` - 调试笔记
- `src/` - 源代码（Python/Node.js）
