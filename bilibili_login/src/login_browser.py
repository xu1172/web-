"""
B站登录 - 浏览器辅助协议方案

核心策略:
- 利用 js-reverse-mcp 驱动浏览器中的极验SDK完成w参数生成
- Python负责B站API交互(RSA加密、登录提交)
- 浏览器负责极验验证码流程(指纹生成、w参数、点选)

使用方式: 通过 Qoder Agent 的 CallMcpTool 接口调用
"""

import json
import logging
import os
import sys
import time
import re
from typing import Optional, Tuple

import requests

sys.path.insert(0, os.path.dirname(__file__))

from rsa_encrypt import encrypt_password
from captcha_solver import BiliClickCaptchaSolver

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("bili_browser_login")

# ============ 配置 ============
YUNMA_TOKEN = "tR5pqscPQ0EI8n7thn38hAIyyakstNb6-DFUuT9pGwI"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Referer": "https://www.bilibili.com/",
    "Origin": "https://www.bilibili.com",
    "Accept": "*/*",
    "Content-Type": "application/x-www-form-urlencoded",
}


class BilibiliBrowserLogin:
    """B站登录 - 浏览器辅助协议方案"""

    PASSPORT_BASE = "https://passport.bilibili.com"

    def __init__(self, yunma_token: str = YUNMA_TOKEN, call_mcp_fn=None):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.captcha_solver = BiliClickCaptchaSolver(yunma_token)
        self.call_mcp = call_mcp_fn  # CallMcpTool 函数引用

        self.gt = ""
        self.challenge = ""
        self.token = ""
        self.rsa_key = ""
        self.hash_salt = ""

    def _evaluate(self, js_code: str, main_world: bool = True):
        """通过 MCP 在浏览器中执行 JS"""
        return self.call_mcp('js-reverse-mcp', 'evaluate_script', {
            'function': js_code,
            'mainWorld': main_world,
        })

    def _list_requests(self, url_filter: str, page_size: int = 5):
        """通过 MCP 获取网络请求"""
        return self.call_mcp('js-reverse-mcp', 'list_network_requests', {
            'urlFilter': url_filter,
            'resourceTypes': ['script'],
            'pageSize': page_size,
        })

    def _get_request(self, reqid: int):
        """通过 MCP 获取单个请求详情"""
        return self.call_mcp('js-reverse-mcp', 'list_network_requests', {
            'reqid': reqid,
        })

    # ========== Step 1: B站API ==========
    def step1_get_captcha(self) -> bool:
        """获取验证码参数 (Python协议)"""
        url = f"{self.PASSPORT_BASE}/x/passport-login/captcha"
        resp = self.session.get(url, params={"source": "main-fe-header", "t": str(time.time())}, timeout=10)
        data = resp.json()

        if data.get("code") != 0:
            logger.error(f"captcha接口错误: {data}")
            return False

        captcha_data = data["data"]
        self.token = captcha_data.get("token", "")
        geetest = captcha_data.get("geetest", {})
        self.gt = geetest.get("gt", "")
        self.challenge = geetest.get("challenge", "")
        logger.info(f"[Step1] gt={self.gt[:8]}..., challenge={self.challenge[:8]}..., token={self.token[:8]}...")
        return True

    def step2_get_rsa_key(self) -> bool:
        """获取RSA公钥 (Python协议)"""
        url = f"{self.PASSPORT_BASE}/x/passport-login/web/key"
        resp = self.session.get(url, params={"_": str(int(time.time() * 1000))}, timeout=10)
        data = resp.json()

        if data.get("code") != 0:
            logger.error(f"key接口错误: {data}")
            return False

        key_data = data["data"]
        self.hash_salt = key_data.get("hash", "")
        self.rsa_key = key_data.get("key", "")
        logger.info(f"[Step2] RSA公钥获取成功, hash={self.hash_salt}")
        return True

    # ========== Step 3: 极验验证码 (浏览器驱动) ==========
    def step3_geetest_via_browser(self) -> Optional[Tuple[str, str]]:
        """
        通过浏览器完成极验验证码
        
        流程:
        1. 在浏览器中初始化极验实例 (使用新的gt/challenge)
        2. 触发验证 → 极验SDK自动生成w参数并发起fullpage请求
        3. 从网络请求中提取点选验证码图片
        4. 云码识别坐标
        5. 通过CDP模拟点击
        6. 从网络请求中提取validate
        
        Returns:
            (validate, seccode) 或 None
        """
        logger.info("[Step3] 开始浏览器辅助极验验证流程")

        # 3a. 在浏览器中初始化新的极验实例
        init_js = f'''() => {{
            return new Promise((resolve) => {{
                // 创建隐藏容器
                let container = document.getElementById('bili_login_container');
                if (!container) {{
                    container = document.createElement('div');
                    container.id = 'bili_login_container';
                    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:rgba(0,0,0,0.5);';
                    document.body.appendChild(container);
                }}
                
                window.__bili_login_w_params = [];
                window.__bili_login_instance = null;
                
                // Hook script src 来捕获 w 参数
                const origSetAttr = Element.prototype.setAttribute;
                Element.prototype.setAttribute = function(name, value) {{
                    if (name === 'src' && typeof value === 'string' && value.includes('geetest.com') && value.includes('w=')) {{
                        const wMatch = value.match(/[?&]w=([^&]+)/);
                        if (wMatch) {{
                            window.__bili_login_w_params.push({{
                                w: decodeURIComponent(wMatch[1]),
                                url: value.substring(0, 100),
                                timestamp: Date.now()
                            }});
                        }}
                    }}
                    return origSetAttr.apply(this, arguments);
                }};
                
                initGeetest({{
                    gt: "{self.gt}",
                    challenge: "{self.challenge}",
                    offline: false,
                    new_captcha: true,
                    product: "embed",
                    width: "300px",
                    https: true
                }}, function(captchaObj) {{
                    window.__bili_login_instance = captchaObj;
                    captchaObj.onReady(function() {{
                        resolve({{ status: 'ready' }});
                    }});
                    captchaObj.onError(function(e) {{
                        resolve({{ status: 'error', message: String(e) }});
                    }});
                    captchaObj.onSuccess(function() {{
                        const result = captchaObj.getValidate();
                        window.__bili_login_validate = result;
                    }});
                    captchaObj.appendTo('#bili_login_container');
                    setTimeout(() => resolve({{ status: 'timeout' }}), 20000);
                }});
            }});
        }}'''

        result = self._evaluate(init_js)
        logger.info(f"[Step3a] 极验实例初始化: {str(result)[:200]}")

        # 3b. 触发验证流程
        time.sleep(2)
        trigger_js = '''() => {
            const inst = window.__bili_login_instance;
            if (!inst) return { error: 'no_instance' };
            try { inst.validate(); } catch(e) {}
            return { triggered: true, w_count: window.__bili_login_w_params.length };
        }'''
        result = self._evaluate(trigger_js)
        logger.info(f"[Step3b] 验证触发: {str(result)[:200]}")

        # 3c. 等待极验加载验证码并从网络请求获取图片
        time.sleep(3)

        # 从网络请求中查找 get.php?type=click 的响应
        network_result = self._list_requests('geetest.com/get.php', 10)
        logger.info(f"[Step3c] 网络请求搜索完成")

        # 解析图片URL
        pic_path = None
        c = []
        s = ""

        # 尝试从请求详情中提取
        pic_match = re.search(r'"pic":\s*"([^"]+)"', str(network_result))
        if pic_match:
            pic_path = pic_match.group(1)
            logger.info(f"[Step3c] 图片路径: {pic_path}")

        c_match = re.search(r'"c":\s*\[([^\]]+)\]', str(network_result))
        if c_match:
            c = [int(x.strip()) for x in c_match.group(1).split(',')]
        s_match = re.search(r'"s":\s*"([^"]+)"', str(network_result))
        if s_match:
            s = s_match.group(1)

        if not pic_path:
            logger.error("[Step3c] 未找到验证码图片, 尝试直接从浏览器获取")
            # 尝试从浏览器DOM中获取
            img_js = '''() => {
                const imgs = document.querySelectorAll('#bili_login_container img');
                const urls = [];
                for (let i = 0; i < imgs.length; i++) {
                    if (imgs[i].src && imgs[i].src.includes('geetest')) urls.push(imgs[i].src);
                }
                return { images: urls };
            }'''
            img_result = self._evaluate(img_js)
            img_urls = re.findall(r'(https://static\.geetest\.com[^\s"]+)', str(img_result))
            if img_urls:
                pic_path = img_urls[0].replace('https://static.geetest.com', '')
                logger.info(f"[Step3c] 从DOM获取图片: {pic_path}")

        if not pic_path:
            logger.error("[Step3c] 获取验证码图片失败")
            return None

        # 3d. 下载验证码图片
        image_url = f"https://static.geetest.com{pic_path}"
        try:
            resp = self.session.get(image_url, timeout=15)
            if resp.status_code != 200:
                logger.error(f"[Step3d] 图片下载失败: {resp.status_code}")
                return None
            image_bytes = resp.content
            logger.info(f"[Step3d] 验证码图片下载成功: {len(image_bytes)} bytes")
        except Exception as e:
            logger.error(f"[Step3d] 图片下载异常: {e}")
            return None

        # 保存调试图片
        debug_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'captcha_latest.jpg')
        with open(debug_path, 'wb') as f:
            f.write(image_bytes)

        # 3e. 云码识别坐标
        ok, coords, msg = self.captcha_solver.solve(image_bytes)
        if not ok:
            logger.error(f"[Step3e] 云码识别失败: {msg}")
            return None
        logger.info(f"[Step3e] 云码识别成功: {coords}")

        # 3f. 通过 CDP 模拟点击
        coords_js = json.dumps(coords)
        click_js = f'''() => {{
            const container = document.getElementById('bili_login_container');
            if (!container) return {{ error: 'no_container' }};
            
            // 查找所有iframe
            const iframes = container.querySelectorAll('iframe');
            for (let i = 0; i < iframes.length; i++) {{
                try {{
                    const doc = iframes[i].contentDocument;
                    if (!doc) continue;
                    const canvas = doc.querySelector('canvas.geetest_canvas_img') || doc.querySelector('canvas');
                    if (canvas) {{
                        const coords = {coords_js};
                        const rect = canvas.getBoundingClientRect();
                        coords.forEach((coord, index) => {{
                            const x = rect.left + coord.x;
                            const y = rect.top + coord.y;
                            canvas.dispatchEvent(new MouseEvent('mousedown', {{clientX: x, clientY: y, bubbles: true}}));
                            canvas.dispatchEvent(new MouseEvent('mouseup', {{clientX: x, clientY: y, bubbles: true}}));
                            canvas.dispatchEvent(new MouseEvent('click', {{clientX: x, clientY: y, bubbles: true}}));
                        }});
                        return {{ clicked: true, iframe_index: i, canvas_size: `${{rect.width}}x${{rect.height}}` }};
                    }}
                }} catch(e) {{
                    // 跨域iframe
                }}
            }}
            
            // 也尝试主容器中的canvas
            const mainCanvas = container.querySelector('canvas');
            if (mainCanvas) {{
                const rect = mainCanvas.getBoundingClientRect();
                const coords = {coords_js};
                coords.forEach((coord) => {{
                    const x = rect.left + coord.x;
                    const y = rect.top + coord.y;
                    mainCanvas.dispatchEvent(new MouseEvent('mousedown', {{clientX: x, clientY: y, bubbles: true}}));
                    mainCanvas.dispatchEvent(new MouseEvent('mouseup', {{clientX: x, clientY: y, bubbles: true}}));
                    mainCanvas.dispatchEvent(new MouseEvent('click', {{clientX: x, clientY: y, bubbles: true}}));
                }});
                return {{ clicked: true, in_main: true }};
            }}
            
            return {{ clicked: false, reason: 'no_canvas' }};
        }}'''

        click_result = self._evaluate(click_js)
        logger.info(f"[Step3f] 点击结果: {str(click_result)[:200]}")

        # 3g. 等待极验处理并从网络请求获取validate
        time.sleep(5)

        # 从网络请求中搜索 ajax.php 的响应
        ajax_result = self._list_requests('ajax.php', 5)
        validate_match = re.search(r'"validate":\s*"([a-f0-9]{32})"', str(ajax_result))
        if validate_match:
            validate = validate_match.group(1)
            seccode = f"{validate}|jordan"
            logger.info(f"[Step3g] 验证成功! validate={validate}")
            return validate, seccode

        # 也检查极验实例的回调结果
        val_js = '''() => {
            if (window.__bili_login_validate) return window.__bili_login_validate;
            const inst = window.__bili_login_instance;
            if (inst) {
                try { return inst.getValidate(); } catch(e) {}
            }
            return null;
        }'''
        val_result = self._evaluate(val_js)
        if val_result:
            val_match = re.search(r'"([a-f0-9]{32})"', str(val_result))
            if val_match:
                validate = val_match.group(1)
                seccode = f"{validate}|jordan"
                logger.info(f"[Step3g] 从实例获取validate: {validate}")
                return validate, seccode

        logger.error("[Step3g] 未获取到validate")
        return None

    # ========== Step 4: 登录 ==========
    def step4_login(self, username: str, password: str, validate: str, seccode: str) -> dict:
        """提交登录 (Python协议)"""
        encrypted_pwd = encrypt_password(password, self.rsa_key, self.hash_salt)
        logger.info(f"[Step4] 密码加密完成, 密文长度: {len(encrypted_pwd)}")

        url = f"{self.PASSPORT_BASE}/x/passport-login/web/login"
        data = {
            "source": "main-fe-header",
            "username": username,
            "password": encrypted_pwd,
            "keep": "0",
            "token": self.token,
            "challenge": self.challenge,
            "validate": validate,
            "seccode": seccode,
            "go_url": "https://www.bilibili.com",
        }

        try:
            resp = self.session.post(url, data=data, timeout=15)
            result = resp.json()
            logger.info(f"[Step4] 登录响应: code={result.get('code')}, message={result.get('message')}")
            return result
        except Exception as e:
            logger.error(f"[Step4] 登录请求失败: {e}")
            return {"code": -1, "message": str(e)}

    def login(self, username: str, password: str) -> dict:
        """执行完整登录流程"""
        logger.info("=" * 60)
        logger.info("B站密码登录 - 浏览器辅助协议方案")
        logger.info(f"账号: {username}")
        logger.info("=" * 60)

        if not self.call_mcp:
            return {"code": -1, "message": "需要提供 call_mcp 函数"}

        # Step 1: 获取验证码参数
        if not self.step1_get_captcha():
            return {"code": -1, "message": "获取验证码参数失败"}

        # Step 2: 获取RSA公钥
        if not self.step2_get_rsa_key():
            return {"code": -1, "message": "获取RSA公钥失败"}

        # Step 3: 浏览器辅助极验验证
        result = self.step3_geetest_via_browser()
        if not result:
            return {"code": -1, "message": "极验验证码未通过"}
        validate, seccode = result

        # Step 4: 登录提交
        return self.step4_login(username, password, validate, seccode)
