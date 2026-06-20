"""
抖音 a_bogus 纯算实现爬虫示例
展示如何在实际请求中使用本地生成的 a_bogus
"""

import requests
import time
from urllib.parse import urlencode, quote
from abogus_local import ABogus


class DouyinSpider:
    """
    抖音爬虫示例
    使用本地纯算生成 a_bogus 参数
    """
    
    def __init__(self):
        self.abogus = ABogus()
        self.session = requests.Session()
        
        # 基础请求头
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Referer": "https://www.douyin.com/",
            "Origin": "https://www.douyin.com",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
        }
        
        # 基础 cookies（需要根据实际情况更新）
        self.cookies = {
            # "ttwid": "your_ttwid_here",
            # "msToken": "your_msToken_here",
        }
    
    def generate_a_bogus(self, params: dict) -> str:
        """
        生成 a_bogus 参数
        
        Args:
            params: URL 参数字典
            
        Returns:
            a_bogus 签名字符串
        """
        # 将参数字典转换为 URL 字符串
        params_str = urlencode(params, doseq=True)
        
        # 使用本地纯算生成 a_bogus
        a_bogus = self.abogus.get_value(
            params_str,
            self.headers["User-Agent"]
        )
        
        return a_bogus
    
    def fetch_aweme_detail(self, aweme_id: str):
        """
        获取视频详情
        
        Args:
            aweme_id: 视频 ID
            
        Returns:
            视频详情数据
        """
        # 构建基础参数
        params = {
            "device_platform": "webapp",
            "aid": "6383",
            "channel": "channel_pc_web",
            "pc_client_type": "1",
            "version_code": "190500",
            "version_name": "19.5.0",
            "cookie_enabled": "true",
            "browser_language": "zh-CN",
            "browser_platform": "Win32",
            "browser_name": "Chrome",
            "browser_online": "true",
            "engine_name": "Blink",
            "os_name": "Windows",
            "os_version": "10",
            "platform": "PC",
            "screen_width": "1920",
            "screen_height": "1080",
            "browser_version": "123.0.0.0",
            "engine_version": "123.0.0.0",
            "cpu_core_num": "12",
            "device_memory": "8",
            "aweme_id": aweme_id,
        }
        
        # 生成 a_bogus
        a_bogus = self.generate_a_bogus(params)
        params["a_bogus"] = a_bogus
        
        # 构建完整 URL
        url = "https://www.douyin.com/aweme/v1/web/aweme/detail/"
        
        print(f"请求 URL: {url}")
        print(f"参数: {urlencode(params)[:100]}...")
        print(f"a_bogus: {a_bogus[:60]}...")
        
        try:
            response = self.session.get(
                url,
                params=params,
                headers=self.headers,
                cookies=self.cookies,
                timeout=30
            )
            
            print(f"响应状态: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status_code") == 0:
                    print("✓ 请求成功！")
                    return data
                else:
                    print(f"✗ API 错误: {data.get('status_msg')}")
                    return None
            else:
                print(f"✗ HTTP 错误: {response.status_code}")
                print(f"响应: {response.text[:200]}")
                return None
                
        except Exception as e:
            print(f"✗ 请求异常: {e}")
            return None
    
    def fetch_user_info(self, sec_user_id: str):
        """
        获取用户信息
        
        Args:
            sec_user_id: 用户 sec_user_id
            
        Returns:
            用户信息数据
        """
        params = {
            "device_platform": "webapp",
            "aid": "6383",
            "channel": "channel_pc_web",
            "source": "channel_pc_web",
            "sec_user_id": sec_user_id,
            "pc_client_type": "1",
            "version_code": "190500",
            "version_name": "19.5.0",
            "cookie_enabled": "true",
            "browser_language": "zh-CN",
            "browser_platform": "Win32",
            "browser_name": "Chrome",
            "browser_online": "true",
            "engine_name": "Blink",
            "os_name": "Windows",
            "os_version": "10",
            "platform": "PC",
        }
        
        a_bogus = self.generate_a_bogus(params)
        params["a_bogus"] = a_bogus
        
        url = "https://www.douyin.com/aweme/v1/web/user/profile/other/"
        
        print(f"请求 URL: {url}")
        print(f"a_bogus: {a_bogus[:60]}...")
        
        try:
            response = self.session.get(
                url,
                params=params,
                headers=self.headers,
                cookies=self.cookies,
                timeout=30
            )
            
            print(f"响应状态: {response.status_code}")
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"响应: {response.text[:200]}")
                return None
                
        except Exception as e:
            print(f"✗ 请求异常: {e}")
            return None


def demo_generate_only():
    """
    仅演示 a_bogus 生成，不发送请求
    """
    print("=" * 80)
    print("抖音 a_bogus 纯算生成演示")
    print("=" * 80)
    
    spider = DouyinSpider()
    
    # 示例参数
    params = {
        "device_platform": "webapp",
        "aid": "6383",
        "channel": "channel_pc_web",
        "aweme_id": "7345492945006595379",
    }
    
    a_bogus = spider.generate_a_bogus(params)
    
    print(f"\n输入参数: {params}")
    print(f"生成的 a_bogus: {a_bogus}")
    print(f"长度: {len(a_bogus)}")
    print(f"URL 编码: {quote(a_bogus, safe='')}")
    
    # 验证格式
    print(f"\n格式验证:")
    print(f"  - 包含自定义字符: {all(c in ABogus._ABogus__str['s2'] for c in a_bogus.rstrip('='))}")
    print(f"  - 长度合理: {150 <= len(a_bogus) <= 180}")


def demo_with_real_request():
    """
    演示带真实请求的使用（需要有效的 cookies）
    """
    print("\n" + "=" * 80)
    print("抖音 a_bogus 实际请求演示")
    print("=" * 80)
    
    spider = DouyinSpider()
    
    # 示例视频 ID
    aweme_id = "7345492945006595379"
    
    print(f"\n获取视频详情: {aweme_id}")
    result = spider.fetch_aweme_detail(aweme_id)
    
    if result:
        aweme = result.get("aweme_detail", {})
        print(f"\n视频标题: {aweme.get('desc', 'N/A')[:50]}...")
        print(f"作者: {aweme.get('author', {}).get('nickname', 'N/A')}")
        print(f"点赞数: {aweme.get('statistics', {}).get('digg_count', 0)}")
    else:
        print("\n注意：实际请求需要有效的 cookies（ttwid, msToken 等）")
        print("请先在浏览器中登录抖音，然后复制 cookies 到代码中")


def demo_batch_generation():
    """
    演示批量生成 a_bogus
    """
    print("\n" + "=" * 80)
    print("批量生成 a_bogus 演示")
    print("=" * 80)
    
    spider = DouyinSpider()
    
    # 多个视频 ID
    aweme_ids = [
        "7345492945006595379",
        "7345492945006595380",
        "7345492945006595381",
    ]
    
    print(f"\n批量生成 {len(aweme_ids)} 个 a_bogus:")
    
    start_time = time.time()
    
    for aweme_id in aweme_ids:
        params = {
            "device_platform": "webapp",
            "aid": "6383",
            "aweme_id": aweme_id,
        }
        
        a_bogus = spider.generate_a_bogus(params)
        print(f"  {aweme_id}: {a_bogus[:50]}...")
    
    elapsed = time.time() - start_time
    print(f"\n总耗时: {elapsed:.3f} 秒")
    print(f"平均每个: {elapsed/len(aweme_ids)*1000:.2f} ms")


def main():
    """主函数"""
    import sys
    
    print("\n" + "=" * 80)
    print("抖音 a_bogus 纯算实现爬虫示例")
    print("=" * 80)
    
    print("\n选择演示模式:")
    print("1. 仅生成 a_bogus（无需 cookies）")
    print("2. 实际请求演示（需要 cookies）")
    print("3. 批量生成演示")
    print("4. 运行所有演示")
    
    if len(sys.argv) > 1:
        choice = sys.argv[1]
    else:
        choice = input("\n请输入选项 (1-4): ").strip() or "1"
    
    if choice == "1":
        demo_generate_only()
    elif choice == "2":
        demo_with_real_request()
    elif choice == "3":
        demo_batch_generation()
    elif choice == "4":
        demo_generate_only()
        demo_batch_generation()
        demo_with_real_request()
    else:
        print("无效选项，运行默认演示")
        demo_generate_only()


if __name__ == "__main__":
    main()
