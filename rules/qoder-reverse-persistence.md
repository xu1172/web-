---
description: 省 token 原则、阶段快照与会话恢复规范
alwaysApply: true
---

# 留痕与节流规范

## 1. 省 token 原则

- 对话里只留结论/证据路径/差异点/下一步，长日志写文件
- 已确认的接口/参数只引用文件路径，不重复回显
- 长命令/多行 Python 写成 `.py`/`.js` 文件执行，不用 `-c`

## 2. 文档职责

| 文件 | 唯一职责 |
|------|----------|
| `plan.md` | 方案、准入门槛、待验证项 |
| `docs/api.md` | 接口、真实样本、响应、Cookie 传递链 |
| `docs/crypto.md` | 函数定位、Hook 命中、输入输出对照 |
| `docs/notes.md` | 阶段快照、失败尝试、差异、下一步 |

能落盘的不要堆在对话里。

## 3. 阶段快照

每完成关键节点在 `docs/notes.md` 追加快照（6-12 行），格式：

```markdown
## Snapshot
- Time: `<时间>`
- Route: `<A/B/C>`
- Scope: `<页面/接口/样本锚点>`
- Confirmed: `<已确认结论>`
- Gap: `<未解决差异>`
- Next: `<下一步动作>`
```

对话被压缩后，应能仅靠 `docs/notes.md` 恢复上下文。

## 4. 恢复现场

上下文压缩/中断后，按顺序读取：

1. `sites/{domain}/plan.md`
2. `sites/{domain}/docs/notes.md`
3. `sites/{domain}/docs/api.md`
4. `sites/{domain}/docs/crypto.md`

恢复后只汇报：当前阶段、已确认结论、未解决问题、下一步。

## 5. 任务清理

保留：`README.md` / `plan.md` / `src/` / `docs/`

删除：`assets/` / `tests/` / 临时日志 / AST 中间产物
