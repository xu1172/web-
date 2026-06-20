# DHL 调试笔记

## Snapshot 1 — Phase 0: 情报收集
- Time: 2026-06-14
- Route: B (js-reverse-mcp)
- Confirmed: DHL 使用 Akamai 3.0, sensor_data ~58元素, bm_sz 格式
- Next: Phase 1

## Snapshot 2 — Phase 1: 流量分析
- Time: 2026-06-14
- Route: B
- Confirmed: API GET /utapi 返回 200 + 完整数据，**无需 Akamai Cookie**
- Confirmed: Akamai JS URL = /Ief7Yk59o/A9V-08ijA/fS/Ykk-b2hwcAY/EX1EPCha/RgYq (77KB)
- Gap: 未观察到 sensor_data POST
- Next: Phase 2

## Snapshot 3 — Phase 2: Akamai 脚本分析
- Time: 2026-06-14
- Confirmed: Ng() 500+ 变量映射, Cn() 加密字符串表, fY.call(PE) 入口
- Confirmed: 31 个函数, 全部通过变量编码调用
- Gap: 字符串表未解密, 分发路径未追踪
- Next: Phase 3

## Snapshot 4 — Phase 3: Plan
- Time: 2026-06-14
- Confirmed: 三条路线 Plan (纯协议✅ / 补环境🟡 / 纯算❌)
- Next: Phase 4

## Snapshot 5 — Phase 4: 补环境尝试
- Time: 2026-06-14
- Route: B → 补环境 Node.js
- v1 (vm.createContext): C[O.pO(...)] is not a constructor
- v2 (eval): Cannot read properties of undefined (reading 'ak_chlge')
- v3 (fY hook): Cannot read properties of undefined (reading 'call')
- Conclusion: 补环境需要更深层浏览器 API 兼容（可能需 jsdom + canvas 库）
- Alternative: curl_cffi 直接调用 API 已可用
- Next: 用户决定路径
