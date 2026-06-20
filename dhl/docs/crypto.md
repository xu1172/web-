# DHL Akamai 加密分析

## 实证状态

### ✅ 已证实
| 项目 | 结论 |
|------|------|
| 追踪 API | **不需要 Akamai Cookie**，直接返回 200 + JSON |
| Akamai 版本 | 3.0（77KB sensor.js） |
| 混淆方式 | 单行 IIFE + 数字方程式编码 + XOR 字符串表 |
| 入口 | `fY.call(this, PE)` |

### 🟡 待证实
| 项目 | 状态 |
|------|------|
| sensor_data 生成 | 补环境 v3 未完成（深层 API 依赖） |
| _abck 验证流程 | 未触发（API 无需此步） |
| 纯算还原 | 未开始（需 AST 反混淆） |

## Akamai 脚本结构（已分析）

```
(function VQhxRcJnCD(){
  V();     // 初始化
  mg();    // 初始化
  Ng();    // 变量映射表 (~500 个编码变量)
  
  var Cn = function(){ On = [...] };  // 加密字符串表（XOR）
  var dq = function(a,b){ return a.charCodeAt(b); };  // 字符编码
  var Gg = function(Ug){...};  // 哈希函数
  var lm = function(xg){...};  // 取模循环
  
  // ...31 个函数定义...
  
  return fY.call(this, PE);  // 主分发器入口
  // 导出: O, Pr, p5, lr, Xn, wn
}())
```

## 补环境阻塞点

### v1 (vm.createContext)
- Blocked at: `C[O.pO(...)] is not a constructor`
- 原因: vm 隔离上下文中缺少原生构造函数

### v2/v3 (全局作用域 eval)
- Blocked at: `Cannot read properties of undefined (reading 'ak_chlge')`
- 原因: 内部数据对象创建失败（某个浏览器 API 返回不匹配）
- 然后: `Cannot read properties of undefined (reading 'call')`
- 原因: 分发器 `Fr` 依赖链断裂

### 需补充的浏览器 API（按优先级）

1. **高优先级** — 阻塞执行:
   - 某些全局对象/函数需精确匹配浏览器行为
   - `document.createElement('canvas').getContext('2d')` 返回值需更完整
   
2. **中优先级** — 可能触发:
   - `navigator.plugins` 的完整 PluginArray 原型链
   - `AudioContext` 的完整 API（createOscillator 等）
   - `performance.getEntriesByType('resource')` 返回值
   
3. **低优先级** — 验证相关:
   - `SpeechSynthesis` API
   - `Permissions` API
   - `Notification` API

## 推荐后续路径

### 短期（可用方案）
使用 curl_cffi 直接调用追踪 API（当前可行）

### 中期（补环境完善）
1. 先 AST 反混淆 (`ast-deobfuscation` skill) 降低调试难度
2. 逐步补全浏览器 API
3. 或使用 `akamai-v3-sensor-data-helper` npm 包

### 长期（纯算还原）
1. AST 反混淆 → 提取核心算法
2. 独立实现 sensor_data 生成（Python/Node.js）
3. 跳过浏览器依赖
