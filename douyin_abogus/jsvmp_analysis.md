# 抖音 bdms.js JSVMP 完整分析

## 1. 文件结构概览

### 1.1 基本信息
- **文件名**: bdms_1.0.1.19_fix.js
- **文件大小**: 147,523 字节
- **主要功能**: a_bogus 签名生成

### 1.2 核心组件

| 组件 | 类型 | 功能 | 位置 |
|------|------|------|------|
| SM3 | 哈希算法 | 国密哈希 | 内嵌在字节码中 |
| d | 函数 | 字节码执行器 | 索引 131630 |
| X | 函数 | 虚拟机入口 | 索引 131034 |
| W | 函数 | 变长整数解码 | 索引 136264 |
| K | 函数 | 字符串解码 | 索引 136374 |
| C | 函数 | 数据解压缩 | 索引 91342 |
| _ | 函数 | 字符解码器 | 索引 136614 |
| J | 函数 | 字节码初始化 | 索引 91657 |

## 2. 字节码解码流程

### 2.1 数据格式
```
[0-3]   "PK\x02\x00"  - ZIP 文件签名
[4-7]   校验和字节    - 用于计算 XOR 密钥
[8...]  加密数据      - 经过 XOR 和压缩的数据
```

### 2.2 解码步骤

#### 步骤 1: Base64 解码
```javascript
const decoded = atob(base64String);
```

#### 步骤 2: 提取校验和
```javascript
let checksum = 0;
for (let n = 4; n < 8; ++n) {
    checksum += decoded.charCodeAt(n);
}
const key = checksum % 256; // 251
```

#### 步骤 3: XOR 解密
```javascript
// _ 函数实现
function _(charCode, index) {
    return (charCode ^ (index + index % 10 * key) % 256) >>> 0;
}

const decrypted = Uint8Array.from(
    decoded.slice(8), 
    (_, i) => _(decoded.charCodeAt(i + 8), i)
);
```

#### 步骤 4: 解压缩 (C 函数)
```javascript
// C 函数调用 pako 或类似的 inflate 算法
const data = C(decrypted, { i: 2 });
```

#### 步骤 5: 解析数据结构
```javascript
// W 函数: 读取变长整数
function W(data) {
    let result = 0;
    let shift = 0;
    while (true) {
        const byte = data.read();
        result |= (byte & 0x7F) << shift;
        shift += 7;
        if (!(byte & 0x80)) break;
    }
    // 处理符号位
    if (shift < 32 && (byte & 0x40)) {
        result |= -1 << shift;
    }
    return result;
}

// K 函数: 读取字符串
function K(data) {
    const len = W(data);
    let str = '';
    for (let i = 0; i < len; i++) {
        str += String.fromCharCode(data.read());
    }
    return str;
}
```

#### 步骤 6: 填充 Z 和 z 数组
```javascript
// 读取字符串表
const stringCount = W(data);
for (let i = 0; i < stringCount; i++) {
    Z.push(K(data));
}

// 读取其他数据
const otherCount = W(data);
for (let i = 0; i < otherCount; i++) {
    // 读取复杂数据结构
    const value1 = W(data);
    const value2 = Boolean(W(data));
    // ...
    z.push([...]);
}
```

## 3. 字节码执行器 (d 函数)

### 3.1 虚拟机架构
- **栈 (v[])**: 存储操作数
- **栈指针 (p)**: 指向栈顶
- **指令指针 (a)**: 指向当前指令
- **字节码 (o[])**: 存储指令
- **字符串表 (Z[])**: 存储字符串常量

### 3.2 指令集 (0-75)

| 操作码 | 名称 | 功能 | 伪代码 |
|--------|------|------|--------|
| 0 | CALL | 函数调用 | `v[p] = func.apply(this, args)` |
| 1 | LE | 小于等于 | `v[p] = v[p] <= v[p+1]` |
| 2 | GT | 大于 | `v[p] = v[p] > v[p+1]` |
| 3 | FOR_IN | for-in 循环 | 迭代对象属性 |
| 4 | POP_JUMP | 弹出跳转 | 条件跳转 |
| 14 | STORE | 存储属性 | `obj[prop] = value` |
| 17 | JUMP_IF_FALSE | 条件跳转 | `if (!v[p]) a += offset` |
| 40 | INC | 前置自增 | `v[p] = ++obj[prop]` |
| 47 | DEFINE_GETTER | 定义 getter | `Object.defineProperty(...)` |
| 50 | POST_INC | 后置自增 | `v[p] = obj[prop]++` |
| 60 | LOAD_GLOBAL | 加载全局变量 | `v[p] = globalThis[name]` |
| 72 | CHECK_GLOBAL | 检查全局变量 | `name in globalThis` |
| 73 | LOAD_STRING | 加载字符串 | `v[p] = Z[index]` |
| 75 | LOAD_NULL | 加载 null | `v[p] = null` |

### 3.3 指令分发逻辑
```javascript
for (;;) {
    const opcode = o[a++];
    
    if (opcode < 38) {
        if (opcode < 19) {
            if (opcode < 9) {
                if (opcode < 4) {
                    if (opcode < 2) {
                        if (opcode === 0) { /* CALL */ }
                        else { /* LE */ }
                    } else if (opcode === 2) { /* GT */ }
                    else { /* FOR_IN */ }
                }
                // ... 更多嵌套条件
            }
            // ...
        }
        // ...
    }
    // ...
}
```

## 4. a_bogus 生成流程

### 4.1 触发点
当使用 `fetch` 或 `XMLHttpRequest` 发送请求时，bdms.js 会拦截请求并添加 a_bogus 参数。

### 4.2 生成步骤
1. **收集参数**: URL 参数、User-Agent、时间戳等
2. **构造输入**: 将参数拼接成字符串
3. **调用 SM3**: 计算哈希值
4. **编码输出**: 将哈希值编码为 URL-safe Base64

### 4.3 关键代码位置
```
拦截器: bdms.js:130952 (n 函数)
执行器: bdms.js:131083 (X 函数)  
字节码: bdms.js:131912 (d 函数)
```

## 5. 纯算还原方案

### 5.1 需要实现的部分

1. **字节码解码器**
   - 实现 `_` 函数 (XOR 解密)
   - 实现 `C` 函数 (pako inflate)
   - 实现 `W` 函数 (变长整数)
   - 实现 `K` 函数 (字符串解码)

2. **字节码执行器**
   - 实现 `d` 函数 (指令解释器)
   - 实现所有 76 条指令的处理逻辑

3. **SM3 哈希**
   - 已实现 (见 sm3.js)

4. **浏览器环境模拟**
   - 补全 `globalThis` 对象
   - 补全 `URLSearchParams`
   - 补全 `XMLHttpRequest`

### 5.2 工作量评估
- 字节码解码: 1-2 天
- 指令集实现: 3-5 天
- 环境补全: 1-2 天
- 调试验证: 2-3 天
- **总计: 7-12 天**

## 6. 建议

由于完整纯算还原需要大量时间，建议：

1. **短期方案**: 使用浏览器环境生成 a_bogus
2. **长期方案**: 逐步进行纯算还原
3. **替代方案**: 分析字节码找到关键算法，直接实现签名逻辑

## 7. 关键发现

1. 字节码使用 **ZIP + XOR + 变长整数** 多重编码
2. 指令集采用 **嵌套 if-else** 而非 switch-case 分发
3. **SM3 哈希** 是核心加密算法
4. 字符串表在运行时动态解码
5. 虚拟机使用 **栈式架构**
