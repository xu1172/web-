# 抖音 a_bogus 纯算实现

基于 GitHub 开源实现优化的本地纯算版本，无需浏览器环境即可生成 a_bogus 签名参数。

## 核心算法

1. **SM3 哈希** - 国密哈希算法，用于计算请求参数的摘要
2. **RC4 加密** - 流加密算法，用于混淆签名数据
3. **自定义 Base64 编码** - 使用抖音自定义的字符表进行编码

## 文件说明

| 文件 | 说明 |
|------|------|
| `abogus_local.py` | **本地纯算实现（核心文件）** |
| `abogus_reference.py` | 参考实现（来自 GitHub） |
| `test_abogus_local.py` | 单元测试脚本 |
| `spider_example.py` | 爬虫使用示例 |
| `verify_with_real_request.py` | 真实请求验证脚本 |
| `jsvmp_analysis.md` | JSVMP 分析文档 |
| `jsvmp_instructions.md` | 指令集分析文档 |

## 验证结果

✅ **已通过真实请求验证**

使用浏览器真实请求参数测试，状态码 200，可以正确获取数据。

```
状态码: 200
Content-Type: application/json
✅ 请求成功!
```

## 使用方法

### 快速开始

```python
from abogus_local import ABogus, generate_a_bogus

# 方式1: 使用便捷函数
a_bogus = generate_a_bogus(
    url_params="device_platform=webapp&aid=6383",
    user_agent="Mozilla/5.0..."
)

# 方式2: 使用类实例
bogus = ABogus()
a_bogus = bogus.get_value(
    url_params="device_platform=webapp&aid=6383",
    user_agent="Mozilla/5.0..."
)

print(a_bogus)
# 输出: Dy8MQ5LhDk6kvfyk5w4LfY3q66o3YKQI0SwkMD4fxAYO5g39HMTD9e7o8PGvYBSjMG8eIeEjy2hVT3ohrQ4y0Hbf9W0L/45ksDSkml5Q57SSs1X9eghgJ02qKkt5SM74RvB-rOXKqhZHmRVp09oHKhm2V1dzFgf3qJLz8j==
```

### 在爬虫中使用

```python
import requests
from urllib.parse import urlencode
from abogus_local import ABogus

class DouyinSpider:
    def __init__(self):
        self.abogus = ABogus()
        self.session = requests.Session()
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
        }
    
    def fetch_video(self, aweme_id):
        params = {
            "device_platform": "webapp",
            "aid": "6383",
            "aweme_id": aweme_id,
        }
        
        # 生成 a_bogus
        params["a_bogus"] = self.abogus.get_value(
            urlencode(params),
            self.headers["User-Agent"]
        )
        
        # 发送请求
        response = self.session.get(
            "https://www.douyin.com/aweme/v1/web/aweme/detail/",
            params=params,
            headers=self.headers
        )
        
        return response.json()

# 使用
spider = DouyinSpider()
data = spider.fetch_video("7345492945006595379")
```

## 性能测试

```
批量生成 3 个 a_bogus:
  总耗时: 0.003 秒
  平均每个: 0.84 ms
```

## 与 JSVMP 分析的关系

这个纯算实现与之前的 JSVMP 分析有以下关联：

1. **核心算法一致** - 都使用了 SM3 哈希、RC4 加密和自定义 Base64
2. **实现方式不同** - 
   - JSVMP 分析：需要解码字节码、实现虚拟机执行器（复杂）
   - 纯算实现：直接实现算法逻辑（简单高效）
3. **适用场景不同** - 
   - JSVMP 分析：适用于理解加密原理、逆向学习
   - 纯算实现：适用于实际生产环境的爬虫开发

## 注意事项

1. **Cookies 要求** - 实际请求需要有效的 cookies（ttwid, msToken 等）
2. **User-Agent 一致性** - 生成 a_bogus 时使用的 UA 必须与请求时一致
3. **参数顺序** - URL 参数的顺序会影响 a_bogus 的值
4. **时间戳** - 实现中自动处理时间戳，无需手动传入

## 依赖

- Python 3.8+
- 可选: `gmssl` (用于 SM3 哈希，如未安装则使用备用实现)

```bash
pip install gmssl  # 可选，提高 SM3 性能
```

## 测试结果

```
✓ 基本功能测试 - 通过
✓ URL 编码参数测试 - 通过
✓ 本地实现 vs 参考实现对比 - 通过
✓ 多次调用测试（验证随机性）- 通过
✓ 边界情况测试 - 通过
✓ 便捷函数测试 - 通过
```

## 许可证

参考实现来自开源项目，本代码仅供学习研究使用。
