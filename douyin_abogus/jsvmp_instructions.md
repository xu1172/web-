# 抖音 bdms.js JSVMP 字节码指令集分析

## 基本信息
- **文件**: bdms_1.0.1.19_fix.js
- **字节码执行器**: `d` 函数
- **位置**: 索引 131630
- **长度**: 3718 字节
- **指令范围**: 0-75

## 指令分发结构
```javascript
for(;;) {
    var t = o[a++];  // 读取操作码
    if(t < 38)
        if(t < 19)
            if(t < 9)
                if(t < 4)
                    if(t < 2)
                        if(0 === t) { ... }  // 指令 0
                        else { ... }          // 指令 1
                    else if(2 === t) { ... }  // 指令 2
                    else { ... }              // 指令 3
                else if(t < 6) ...
                else if(6 === t) ...
                else { ... }                  // 指令 7
            else if(t < 14) ...
            else if(14 === t) ...
            else if(15 === t) ...
            else if(16 === t) ...
            else { ... }                      // 指令 17
        else if(t < 28) ...
        else if(t < 33) ...
        else if(t < 35) ...
        else if(t < 36) ...
        else { ... }                          // 指令 36
    else if(t < 57) ...
    else if(t < 67) ...
    else if(t < 72) ...
    else if(t < 74) ...
    else if(t < 75) ...
    else { ... }                              // 指令 75
}
```

## 指令映射表

| 操作码 | 类型 | 描述 | 代码示例 |
|--------|------|------|----------|
| 0 | CALL | 函数调用 | `var r=o[a++]; p-=r; var e=v.slice(p+1,p+r+1), n=v[p--], d=v[p--]; ... n.apply(d,e)` |
| 1 | LE | 小于等于 | `w=v[p--]; v[p]=v[p]<=w` |
| 2 | GT | 大于 | `w=v[p--]; v[p]=v[p]>w` |
| 3 | FOR_IN | for-in 循环 | `x=o[a++], S=v[p--], P=[]; for(var j in S) P.push(j); ...` |
| 4 | POP_JUMP | 弹出跳转 | `x=o[a++]; var O=v[p--], R=v[p--]; P=s[x], j=void 0; do{j=P[0].shift()}...` |
| 5 | - | (未识别) | - |
| 6 | - | (未识别) | - |
| 7 | - | (未识别) | - |
| 8 | - | (未识别) | - |
| 9 | - | (未识别) | - |
| 10 | - | (未识别) | - |
| 11 | - | (未识别) | - |
| 12 | - | (未识别) | - |
| 13 | - | (未识别) | - |
| 14 | STORE | 存储属性 | `E=v[p--]; var T=v[p--]; (S=v[p--])[T]=E` |
| 15 | - | (未识别) | - |
| 16 | - | (未识别) | - |
| 17 | JUMP_IF_FALSE | 条件跳转 | `var U=o[a++]; v[p]?--p:a+=U` |
| 18 | - | (未识别) | - |
| ... | ... | ... | ... |
| 40 | INC | 前置自增 | `var M=v[p--]; E=++(S=v[p--])[M], v[++p]=E` |
| ... | ... | ... | ... |
| 47 | DEFINE_GETTER | 定义 getter | `x=o[a++]; var Q=v[p--]; Object.defineProperty(v[p],Z[x],{get:Q,...})` |
| ... | ... | ... | ... |
| 50 | POST_INC | 后置自增 | `var q=v[p--]; E=(S=v[p--])[q]++, v[++p]=E` |
| ... | ... | ... | ... |
| 60 | LOAD_GLOBAL | 加载全局变量 | `x=o[a++]; var Y=Z[x]; if(!(Y in globalThis))... E=globalThis[Y], v[++p]=E` |
| ... | ... | ... | ... |
| 72 | CHECK_GLOBAL | 检查全局变量 | `x=o[a++]; var W=Z[x]; W in globalThis||(globalThis[W]=void 0)` |
| 73 | LOAD_STRING | 加载字符串 | `x=o[a++], v[++p]=Z[x]` |
| 74 | - | (未识别) | - |
| 75 | LOAD_NULL | 加载 null | `v[++p]=null` |

## 关键发现

### 1. 寄存器/栈结构
- `v[]`: 值栈
- `p`: 栈指针
- `a`: 指令指针
- `o[]`: 字节码数组
- `Z[]`: 字符串表

### 2. 函数调用机制
指令 0 处理函数调用:
```javascript
var r = o[a++];        // 读取参数数量
p -= r;                // 调整栈指针
var e = v.slice(p+1, p+r+1);  // 提取参数
var n = v[p--];        // 获取函数
var d = v[p--];        // 获取 this
// 调用函数 n.apply(d, e)
```

### 3. 属性访问机制
- 指令 14: 设置属性 `S[T] = E`
- 指令 47: 定义 getter

### 4. 全局变量访问
- 指令 60: 读取全局变量 `globalThis[Y]`
- 指令 72: 检查全局变量是否存在
- 指令 73: 加载字符串常量

## 分析结论

这是一个典型的 **JSVMP (JavaScript Virtual Machine Protection)** 实现：

1. **字节码编码**: 原始 JS 代码被编译成自定义字节码
2. **指令分发**: 使用嵌套 if-else 而非 switch-case
3. **栈机模型**: 基于栈的虚拟机架构
4. **字符串表**: 所有字符串常量存储在 Z 数组中
5. **全局环境**: 通过 globalThis 访问浏览器环境

## 下一步分析方向

1. 完整解码字节码数据 (29KB)
2. 分析 a_bogus 生成的具体字节码序列
3. 识别 SM3 哈希调用点
4. 还原 URL 参数构造逻辑
