# 阿里云智能验证码 - 纯协议逆向实现

对阿里云 NVC (NoCaptcha Verification) 智能验证码的 Node.js 补环境 + Python 协议请求实现，无需任何浏览器自动化。

## 目录结构

```
aliyun_captcha/
├── assets/                    # 核心 JS 文件（从目标网站提取）
│   ├── awsc.js                # AWSC 安全框架，提供 AWSC.use() 模块加载
│   ├── nvc.js                 # NVC 验证核心，含 getNVCVal()/getNC()/getSC()
│   ├── nc.js                  # NoCaptcha 核心（~221KB），弹窗验证码逻辑
│   └── guide.js               # 入口引导，调用 nvcPrepare 后动态加载 nvc.js
├── env/
│   └── browser.js             # Node.js 补环境框架（676 行）
│                              #   - buildBrowserEnv()：构建完整浏览器 API 模拟
│                              #   - createVMContext()：创建 vm 沙箱上下文
│                              #   - executeInContext()：在沙箱中执行 JS
│                              #   - createNativeFunction()：包装函数 toString → [native code]
│                              #   - 预置 UMID/UAB 模拟模块（_awsc_modules）
│                              #   - 预置 UAB 采集配置（__nvc_uaboption）
└── src/
    ├── captcha.py             # Python 协议封装（主模块）
    │                          #   AliyunSmartCaptcha 类：
    │                          #     call_nvc_prepare() → nvcPrepare API
    │                          #     get_nvc_token() → subprocess 调 Node.js 生成
    │                          #     verify() → 提交 nvcAnalyze 验证
    ├── generate_token.js      # Node.js Token 生成器
    │                          #   CLI: node generate_token.js <c> <token> [appkey] [scene] [key1] [nvcCode]
    ├── test_full.py           # 端到端集成测试
    └── test_env.js            # 补环境单元测试
```

## 验证流程

```
① GET cf.aliyun.com/nvc/nvcPrepare.jsonp?a={...}
   └→ 返回 {code: 200, result: {a, b, c}}  — 获取 capCode + nvcPreRes

② Node.js 本地生成 NVC Token
   ├→ vm.createContext(补环境)
   ├→ 加载 awsc.js → AWSC.use 劫持注入 UMID/UAB 模拟模块
   ├→ 加载 nvc.js
   ├→ 手动触发 UMID/UAB 初始化
   └→ getNVCVal() → URL-encoded JSON token

③ GET cf.aliyun.com/nvc/nvcAnalyze.jsonp?a={nvc_token}
   └→ 返回 {code: 200, result: {sessionId, sig}}
```

## NVC Token 结构

```json
{
  "a": "CF_APP_1",              // appkey
  "b": "140#base64...",          // UAB 行为指纹（前置版本号#）
  "c": "时间戳:随机数",          // token 标识
  "d": "nvc_register",           // scene 场景名
  "e": "amYofgSTn...",           // nvcPreRes.c 返回码
  "f": "sessionId 字符串",       // 服务端返回（验证成功后）
  "g": "sig 签名字符串",         // 服务端返回（验证成功后）
  "h": {                         // trans 配置
    "umidToken": "T2gAN1aK...",  // UMID 设备指纹 token
    "key1": "code0",
    "nvcCode": 200
  },
  "j": {"test": 1}               // 额外数据
}
```

## 使用方法

### 环境要求
- Python 3.6+
- Node.js 14+
- `pip install requests`

### 快速开始

```python
from captcha import AliyunSmartCaptcha

# 创建实例
captcha = AliyunSmartCaptcha()

# 三步完成验证
captcha.call_nvc_prepare()           # ① 获取 preRes
nvc_token = captcha.get_nvc_token()  # ② 生成加密 Token
result = captcha.verify(nvc_token)   # ③ 提交验证

# result 示例:
# {"result": {"code": 200, "msg": "success", "result": {"sessionId": "...", "sig": "..."}, "success": true}, "success": true}
```

### 自定义参数

```python
captcha = AliyunSmartCaptcha(
    appkey='CF_APP_1',      # 应用标识
    scene='nvc_register'     # 场景名称
)
```

### 运行测试

```bash
# 补环境单元测试
node src/test_env.js

# 端到端集成测试
python src/test_full.py
```

## 关键技术决策

1. **AWSC.use 劫持**：nvc.js 中 `loadScript(c.url.awsc)` 在 vm 沙箱中永不 resolve，通过劫持模块加载器，当检测到请求 "um"/"uab" 时直接返回模拟模块，跳过真实的脚本加载

2. **vm.createContext 沙箱**：使用 Node.js 内置 vm 模块创建隔离上下文而非 jsdom，避免 DOM 渲染开销

3. **UMID/UAB 模拟**：在 env/browser.js 中预置模拟模块，um 提供 init(cfg, cb) 返回硬编码 UMID token，uab 提供 getUA(cfg) 返回预生成 UAB 指纹

4. **createNativeFunction**：所有模拟 API 的 `toString()` 返回 `function xxx() { [native code] }`，配合 `protectFunctionToString()` 防止被检测

5. **Python subprocess**：通过 `subprocess.run` 调用 Node.js，JSON stdout 传递数据，避免复杂的通信方式

6. **capCode 路由**：200=智能验证(直接 getNVCVal)，400=滑块验证(需加载 nc.js 弹窗)，600=刮刮卡(需 getSC)

## 验证码类型说明

| capCode | 类型 | 说明 |
|---------|------|------|
| 200 | 智能验证 | 无感验证，直接通过 getNVCVal() 生成 token |
| 400 | 滑块验证 | 需要弹出 NoCaptcha 滑块交互窗 |
| 600 | 刮刮卡 | 需要弹出刮刮卡交互窗 |

本项目默认使用 capCode=200 智能验证模式。

## 许可

仅供学习与研究使用，请勿用于非法用途。
