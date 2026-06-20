"""
B站极验验证码 - 协议交互模块

处理极验3代点选验证码的完整API交互流程:
1. gettype.php  - 获取验证码类型配置
2. get.php      - 获取验证码参数(含w指纹参数)
3. get.php?type=click - 获取点选验证码图片
4. ajax.php     - 提交验证结果(含w加密参数)

极验API文档参考: https://docs.geetest.com/
"""

import json
import logging
import os
import re
import subprocess
import time
from typing import Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)


class GeetestHandler:
    """
    极验3代点选验证码协议处理器

    完整处理极验验证码的API交互,获取validate/seccode供B站登录使用
    """

    API_SERVER = "https://api.geetest.com"
    STATIC_SERVER = "https://static.geetest.com"

    def __init__(self, gt: str, challenge: str):
        """
        Args:
            gt: 极验gt参数 (从B站captcha接口获取)
            challenge: 极验challenge (从B站captcha接口获取)
        """
        self.gt = gt
        self.challenge = challenge
        self.c = []       # 加密参数c
        self.s = ""       # 加密参数s
        self.click_pic = ""  # 点选图片路径
        self.pic_type = ""   # 图片类型
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com/",
        })

    def step1_gettype(self) -> bool:
        """
        Step 1: 获取验证码类型配置
        GET api.geetest.com/gettype.php?gt=...&callback=...
        """
        callback = f"geetest_{int(time.time() * 1000)}"
        url = f"{self.API_SERVER}/gettype.php"
        params = {
            "gt": self.gt,
            "callback": callback,
        }

        try:
            resp = self._session.get(url, params=params, timeout=10)
            resp.raise_for_status()
            logger.info(f"[Step1] gettype响应长度: {len(resp.text)}")
            return True
        except Exception as e:
            logger.error(f"[Step1] gettype失败: {e}")
            return False

    def _call_node_geetest(self, mode: str, coords: list = None) -> Optional[str]:
        """
        调用 Node.js geetest_w.js 生成 w 参数

        Args:
            mode: 'fullpage' 或 'click'
            coords: 点击坐标 (click模式需要)

        Returns:
            w参数字符串, 失败返回None
        """
        js_path = os.path.join(os.path.dirname(__file__), 'geetest_w.js')
        cmd = [
            'node', js_path,
            '--mode', mode,
            '--gt', self.gt,
            '--challenge', self.challenge,
            '--c', json.dumps(self.c),
            '--s', self.s,
        ]
        if coords:
            cmd.extend(['--coords', json.dumps(coords)])

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=15,
                cwd=os.path.dirname(__file__),
            )
            if result.returncode != 0:
                logger.error(f"Node.js geetest_w 执行失败: {result.stderr}")
                return None

            data = json.loads(result.stdout.strip())
            w = data.get('w', '')
            if w:
                logger.info(f"w参数生成成功: mode={mode}, length={len(w)}")
            return w

        except subprocess.TimeoutExpired:
            logger.error("Node.js geetest_w 执行超时")
        except Exception as e:
            logger.error(f"Node.js geetest_w 调用异常: {e}")
        return None

    def step2_get_fullpage(self, w: str = "") -> bool:
        """
        Step 2: fullpage阶段 - 获取初始配置
        先生成w指纹参数, 再请求极验API

        Args:
            w: 如果为空, 尝试通过Node.js生成
        """
        if not w:
            w = self._call_node_geetest('fullpage') or ""
            logger.info(f"[Step2] 使用Node.js生成的w参数, 长度: {len(w)}")
        callback = f"geetest_{int(time.time() * 1000)}"
        url = f"{self.API_SERVER}/get.php"
        params = {
            "gt": self.gt,
            "challenge": self.challenge,
            "lang": "zh-cn",
            "pt": 0,
            "client_type": "web",
            "callback": callback,
        }
        if w:
            params["w"] = w

        try:
            resp = self._session.get(url, params=params, timeout=10)
            resp.raise_for_status()

            # 解析JSONP响应
            text = resp.text
            json_match = re.search(r'\((.+)\)', text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(1))
                if data.get("status") == "success":
                    inner = data.get("data", {})
                    self.c = inner.get("c", [])
                    self.s = inner.get("s", "")
                    logger.info(f"[Step2] fullpage配置获取成功: c={self.c}, s={self.s}")
                    return True

            logger.warning(f"[Step2] fullpage响应解析失败")
            return False

        except Exception as e:
            logger.error(f"[Step2] get失败: {e}")
            return False

    def step3_get_click_captcha(self) -> Tuple[bool, str]:
        """
        Step 3: 获取点选验证码图片
        GET api.geetest.com/get.php?is_next=true&type=click&...

        Returns:
            (success, image_url) - 图片URL
        """
        callback = f"geetest_{int(time.time() * 1000)}"
        url = f"{self.API_SERVER}/get.php"
        params = {
            "is_next": "true",
            "type": "click",
            "gt": self.gt,
            "challenge": self.challenge,
            "lang": "zh-cn",
            "https": "false",
            "protocol": "https://",
            "offline": "false",
            "product": "embed",
            "api_server": "api.geetest.com",
            "isPC": "true",
            "autoReset": "true",
            "width": "100%",
            "callback": callback,
        }

        try:
            resp = self._session.get(url, params=params, timeout=10)
            resp.raise_for_status()

            text = resp.text
            json_match = re.search(r'\((.+)\)', text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(1))
                if data.get("status") == "success":
                    inner = data.get("data", {})
                    self.click_pic = inner.get("pic", "")
                    self.pic_type = inner.get("pic_type", "word")
                    # 更新c和s
                    self.c = inner.get("c", self.c)
                    self.s = inner.get("s", self.s)

                    image_url = f"{self.STATIC_SERVER}{self.click_pic}"
                    logger.info(f"[Step3] 点选验证码图片: {image_url}")
                    return True, image_url

            logger.warning("[Step3] 点选验证码获取失败")
            return False, ""

        except Exception as e:
            logger.error(f"[Step3] 获取点选验证码失败: {e}")
            return False, ""

    def step4_validate_click(
        self,
        coordinates: list,
        w: str = "",
    ) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        Step 4: 提交点选验证结果
        GET api.geetest.com/ajax.php?gt=...&challenge=...&w=...

        Args:
            coordinates: 点击坐标列表 [{"x": 123, "y": 45}, ...]
            w: 包含点击坐标的加密w参数

        Returns:
            (success, validate, message)
        """
        if not w:
            w = self._call_node_geetest('click', coordinates) or ""
            logger.info(f"[Step4] 使用Node.js生成的click w参数, 长度: {len(w)}")

        callback = f"geetest_{int(time.time() * 1000)}"
        url = f"{self.API_SERVER}/ajax.php"
        params = {
            "gt": self.gt,
            "challenge": self.challenge,
            "lang": "zh-cn",
            "pt": 0,
            "client_type": "web",
            "w": w,
            "callback": callback,
        }

        try:
            resp = self._session.get(url, params=params, timeout=15)
            resp.raise_for_status()

            text = resp.text
            json_match = re.search(r'\((.+)\)', text, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group(1))
                logger.info(f"[Step4] ajax响应: {json.dumps(data, ensure_ascii=False)[:200]}")

                if data.get("status") == "success":
                    inner = data.get("data", {})
                    validate = inner.get("validate", "")
                    message = inner.get("message", "")
                    if validate:
                        logger.info(f"[Step4] 验证成功! validate={validate}")
                        return True, validate, message
                    else:
                        logger.warning(f"[Step4] 验证未通过: {message}")
                        return False, None, message

                message = data.get("message", "")
                logger.warning(f"[Step4] 验证失败: {message}")
                return False, None, message

            return False, None, "响应解析失败"

        except Exception as e:
            logger.error(f"[Step4] ajax提交失败: {e}")
            return False, None, str(e)

    def get_captcha_image(self, image_url: str) -> Optional[bytes]:
        """下载验证码图片原始字节"""
        try:
            resp = self._session.get(image_url, timeout=15)
            resp.raise_for_status()
            return resp.content
        except Exception as e:
            logger.error(f"下载验证码图片失败: {e}")
            return None

    def build_click_w_param(self, coordinates: list) -> str:
        """构建点选验证码的w参数（占位）"""
        coords_str = "|".join([f"{c['x']},{c['y']}" for c in coordinates])
        logger.info(f"点击坐标序列: {coords_str}")
        return coords_str

    def get_captcha_image_via_browser(self, call_mcp_fn) -> Optional[bytes]:
        """
        通过 js-reverse-mcp 获取浏览器中极验验证码图片
        
        Args:
            call_mcp_fn: MCP调用函数 (server_name, tool_name, args) -> result
        
        Returns:
            图片字节数据或 None
        """
        # 从网络请求中找到 click 图片URL
        try:
            result = call_mcp_fn('js-reverse-mcp', 'list_network_requests', {
                'urlFilter': 'geetest.com/get.php',
                'resourceTypes': ['script'],
                'pageSize': 5,
            })
            
            # 解析网络请求文本
            import re
            urls = re.findall(r'(https://static\.geetest\.com[\S]+)', str(result))
            if urls:
                logger.info(f"找到极验图片URL: {urls[0][:80]}")
                return self.get_captcha_image(urls[0])
            
            # 也尝试从 get.php 的响应中提取
            json_match = re.search(r'"pic":\s*"([^"]+)"', str(result))
            if json_match:
                pic_path = json_match.group(1)
                image_url = f"{self.STATIC_SERVER}{pic_path}"
                logger.info(f"从响应中提取图片路径: {image_url[:80]}")
                return self.get_captcha_image(image_url)
            
        except Exception as e:
            logger.error(f"通过浏览器获取验证码图片失败: {e}")
        return None

    def submit_click_via_browser(self, coordinates: List[Dict], call_mcp_fn) -> Tuple[bool, Optional[str], Optional[str]]:
        """
        通过 js-reverse-mcp 在浏览器中模拟点击坐标并获取验证结果
        
        Args:
            coordinates: 点击坐标 [{"x": 123, "y": 45}, ...]
            call_mcp_fn: MCP调用函数
        
        Returns:
            (success, validate, message)
        """
        try:
            # 模拟点击
            coords_js = json.dumps(coordinates)
            click_js = f'''() => {{
                // 找到极验 iframe
                const iframes = document.querySelectorAll('iframe');
                for (let i = 0; i < iframes.length; i++) {{
                    try {{
                        const cw = iframes[i].contentWindow;
                        const doc = cw.document;
                        const canvas = doc.querySelector('canvas');
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
                            return {{ clicked: true, canvas_found: true }};
                        }}
                    }} catch(e) {{
                        // 跨域 iframe
                    }}
                }}
                return {{ clicked: false, reason: 'no_accessible_canvas' }};
            }}'''
            
            click_result = call_mcp_fn('js-reverse-mcp', 'evaluate_script', {
                'function': click_js,
                'mainWorld': True,
            })
            logger.info(f"浏览器点击结果: {str(click_result)[:200]}")
            
            # 等待极验处理
            time.sleep(3)
            
            # 从网络请求中查找 ajax.php 的响应
            ajax_result = call_mcp_fn('js-reverse-mcp', 'list_network_requests', {
                'urlFilter': 'ajax.php',
                'resourceTypes': ['script'],
                'pageSize': 3,
            })
            
            # 解析 validate
            validate_match = re.search(r'"validate":\s*"([a-f0-9]+)"', str(ajax_result))
            if validate_match:
                validate = validate_match.group(1)
                logger.info(f"从网络请求中捕获 validate: {validate[:16]}...")
                return True, validate, ""
            
            # 尝试从极验实例获取结果
            get_validate_js = '''() => {
                const iframes = document.querySelectorAll('iframe');
                for (let i = 0; i < iframes.length; i++) {
                    try {
                        const cw = iframes[i].contentWindow;
                        if (cw._geetest_instance) {
                            const result = cw._geetest_instance.getValidate();
                            if (result) return result;
                        }
                    } catch(e) {}
                }
                // 也检查主页面的实例
                if (window.__geetest_validate_result) return window.__geetest_validate_result;
                return null;
            }'''
            
            val_result = call_mcp_fn('js-reverse-mcp', 'evaluate_script', {
                'function': get_validate_js,
                'mainWorld': True,
            })
            
            if val_result and 'validate' in str(val_result):
                val_match = re.search(r'"(\w{32})"', str(val_result))
                if val_match:
                    return True, val_match.group(1), ""
            
            logger.warning("未能从浏览器获取验证结果")
            return False, None, "验证结果获取失败"
            
        except Exception as e:
            logger.error(f"浏览器提交验证失败: {e}")
            return False, None, str(e)
