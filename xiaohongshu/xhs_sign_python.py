"""
小红书 x-s 签名生成 - Python 生产级方案

架构:
- Python: 业务逻辑 + HTTP 请求
- Chrome DevTools: 调用浏览器中已初始化的 mnsv2 生成签名

使用方法:
1. 确保 Chrome 已启动并连接到 127.0.0.1:9222
2. 浏览器已打开小红书页面
3. 运行此脚本

依赖:
pip install requests
"""

import requests
import json
import time
from typing import Dict, Optional


class XiaoHongShuSign:
    """小红书签名生成器"""
    
    def __init__(self, chrome_debug_port: int = 9222):
        """
        初始化签名生成器
        
        Args:
            chrome_debug_port: Chrome DevTools 调试端口
        """
        self.chrome_debug_port = chrome_debug_port
        self.session = requests.Session()
        
    def generate_sign_via_browser(self, f: str, c: str, d: str) -> Optional[str]:
        """
        通过浏览器 mnsv2 生成 mns 签名
        
        Args:
            f: 请求参数 (JSON 字符串)
            c: 签名密钥1
            d: 签名密钥2
            
        Returns:
            mns 签名,失败返回 None
        """
        try:
            # 构造 JavaScript 代码
            js_code = f"""
            (function() {{
                try {{
                    var f = {json.dumps(f)};
                    var c = {json.dumps(c)};
                    var d = {json.dumps(d)};
                    
                    if (typeof window.mnsv2 !== 'function') {{
                        return JSON.stringify({{
                            error: 'mnsv2 未初始化',
                            has_mnsv2: typeof window.mnsv2
                        }});
                    }}
                    
                    var result = window.mnsv2(f, c, d);
                    return JSON.stringify({{
                        success: true,
                        mns: result
                    }});
                }} catch (e) {{
                    return JSON.stringify({{
                        error: e.message,
                        stack: e.stack
                    }});
                }}
            }})();
            """
            
            # 调用 Chrome DevTools
            url = f"http://127.0.0.1:{self.chrome_debug_port}/json"
            tabs_response = requests.get(url)
            tabs = tabs_response.json()
            
            # 找到第一个标签页
            if not tabs:
                print("❌ 未找到浏览器标签页")
                return None
                
            tab = tabs[0]
            web_socket_url = tab.get('webSocketDebuggerUrl')
            
            if not web_socket_url:
                # 使用 HTTP API 执行脚本
                tab_id = tab.get('id')
                eval_url = f"http://127.0.0.1:{self.chrome_debug_port}/json/execute/{tab_id}"
                
                payload = {
                    "expression": js_code
                }
                
                response = requests.post(eval_url, json=payload)
                result = response.json()
                
                # 解析结果
                result_data = json.loads(result.get('result', {}).get('result', {}).get('value', '{}'))
                
                if result_data.get('success'):
                    return result_data.get('mns')
                else:
                    print(f"❌ 签名生成失败: {result_data.get('error')}")
                    return None
            else:
                # WebSocket 方式 (需要 websocket-client 库)
                print("⚠️ WebSocket 方式需要安装 websocket-client 库")
                return None
                
        except Exception as e:
            print(f"❌ 调用浏览器失败: {e}")
            return None
    
    def generate_x_s(self, url: str, params: Dict, cookies: str) -> Optional[str]:
        """
        生成完整的 x-s 签名
        
        Args:
            url: 请求 URL
            params: 请求参数
            cookies: Cookie 字符串
            
        Returns:
            x-s 签名
        """
        # 1. 构造请求体
        f = json.dumps({
            'url': url,
            'params': params
        })
        
        # 2. 从 Cookie 中提取密钥
        # 注意: 这里需要根据实际情况提取 c 和 d
        c = self._extract_cookie_value(cookies, 'a1')
        d = self._extract_cookie_value(cookies, 'webId')
        
        if not c or not d:
            print("❌ 未找到必要的 Cookie (a1, webId)")
            return None
        
        # 3. 调用浏览器生成签名
        mns = self.generate_sign_via_browser(f, c, d)
        
        if not mns:
            return None
        
        # 4. 构造 x-s
        x_s = f"mns0301_{mns}"
        
        return x_s
    
    def _extract_cookie_value(self, cookies: str, key: str) -> Optional[str]:
        """
        从 Cookie 字符串中提取值
        
        Args:
            cookies: Cookie 字符串
            key: Cookie 名称
            
        Returns:
            Cookie 值
        """
        for cookie in cookies.split(';'):
            cookie = cookie.strip()
            if cookie.startswith(f'{key}='):
                return cookie.split('=', 1)[1]
        return None
    
    def test_request(self) -> bool:
        """
        测试完整的请求流程
        
        Returns:
            是否成功
        """
        print("=" * 60)
        print("小红书 x-s 签名测试")
        print("=" * 60)
        
        # 测试参数
        url = "/api/sns/web/v1/homefeed"
        params = {
            "cursor_score": "",
            "num": 24
        }
        
        # 从浏览器获取 Cookie (示例)
        cookies = "a1=975e405e5d685096a247505198768687; webId=6cb167ba87e1a756420d916fc234803c"
        
        print(f"\n📍 请求 URL: {url}")
        print(f"📍 请求参数: {json.dumps(params, ensure_ascii=False)}")
        print(f"📍 Cookie: {cookies}")
        
        # 生成 x-s
        print("\n⏳ 生成 x-s 签名...")
        x_s = self.generate_x_s(url, params, cookies)
        
        if not x_s:
            print("❌ x-s 签名生成失败")
            return False
        
        print(f"✅ x-s: {x_s}")
        
        # 发送请求
        print("\n⏳ 发送请求...")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.xiaohongshu.com/explore',
            'Cookie': cookies,
            'x-s': x_s,
            'x-t': str(int(time.time() * 1000))
        }
        
        try:
            response = self.session.get(
                f'https://edith.xiaohongshu.com{url}',
                params=params,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 请求成功! 状态码: {response.status_code}")
                print(f"📊 响应数据: {json.dumps(data, ensure_ascii=False)[:200]}...")
                return True
            else:
                print(f"❌ 请求失败! 状态码: {response.status_code}")
                print(f"📄 响应: {response.text[:200]}")
                return False
                
        except Exception as e:
            print(f"❌ 请求异常: {e}")
            return False


def main():
    """主函数"""
    # 创建签名生成器
    signer = XiaoHongShuSign(chrome_debug_port=9222)
    
    # 运行测试
    success = signer.test_request()
    
    if success:
        print("\n" + "=" * 60)
        print("🎉 测试通过!签名系统工作正常")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("❌ 测试失败!请检查:")
        print("1. Chrome 是否已启动并连接到 127.0.0.1:9222")
        print("2. 浏览器是否已打开小红书页面")
        print("3. Cookie 是否有效")
        print("=" * 60)


if __name__ == '__main__':
    main()
