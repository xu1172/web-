"""
极验 w 参数生成 - 通过 js-reverse-mcp 驱动浏览器SDK

核心方案:
1. Python 获取新的 captcha 参数 (gt, challenge)
2. 通过 js-reverse-mcp evaluate_script 在浏览器中初始化极验实例
3. Hook XHR 捕获浏览器生成的真实 w 参数
4. 返回 w 参数给 Python 用于协议请求

这避免了反混淆的复杂性,直接利用浏览器环境执行原始 JS SDK
"""

import json
import logging
import subprocess
import sys
import time
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


def _call_mcp_evaluate(js_function: str, main_world: bool = True):
    """
    通过 npx 调用 js-reverse-mcp 的 evaluate_script 工具
    
    由于 MCP 工具需要通过 Qoder 的 CallMcpTool 接口调用,
    这个模块设计为被主脚本通过 Qoder Agent 间接调用
    """
    raise NotImplementedError(
        "此模块需要通过 Qoder Agent 的 CallMcpTool 接口调用, "
        "不能独立运行。请使用 generate_w_via_browser() 的包装函数。"
    )


class GeetestBrowserWGenerator:
    """
    通过浏览器生成极验 w 参数的生成器
    
    使用方式: 在 Qoder Agent 中通过 CallMcpTool 逐步调用
    """
    
    # 缓存上一次生成的 w 参数
    _last_fullpage_w = None
    _last_click_w = None
    
    @staticmethod
    def get_hook_install_js() -> str:
        """返回安装 XHR Hook 的 JS 代码"""
        return '''() => {
            window.__captured_w_params = [];
            window.__captured_geetest_responses = [];
            
            const origXHROpen = XMLHttpRequest.prototype.open;
            const origXHRSend = XMLHttpRequest.prototype.send;
            
            XMLHttpRequest.prototype.open = function(method, url) {
                this.__url = url;
                this.__method = method;
                return origXHROpen.apply(this, arguments);
            };
            
            XMLHttpRequest.prototype.send = function(body) {
                const self = this;
                if (this.__url && typeof this.__url === 'string') {
                    const url = this.__url;
                    
                    // 捕获 w 参数
                    if (url.includes('w=')) {
                        const wMatch = url.match(/[?&]w=([^&]+)/);
                        if (wMatch) {
                            const w = decodeURIComponent(wMatch[1]);
                            let type = 'unknown';
                            if (url.includes('get.php') && !url.includes('type=click')) type = 'fullpage';
                            else if (url.includes('ajax.php')) type = 'click_submit';
                            else if (url.includes('reset.php')) type = 'reset';
                            
                            window.__captured_w_params.push({
                                type: type,
                                w: w,
                                w_length: w.length,
                                url_path: url.split('?')[0],
                                timestamp: Date.now()
                            });
                        }
                    }
                    
                    // 捕获极验 API 响应
                    this.addEventListener('load', function() {
                        try {
                            if (url.includes('geetest.com')) {
                                const text = self.responseText;
                                const jsonMatch = text.match(/\\((.+)\\)/);
                                if (jsonMatch) {
                                    const data = JSON.parse(jsonMatch[1]);
                                    window.__captured_geetest_responses.push({
                                        url: url.substring(0, 100),
                                        data: data,
                                        timestamp: Date.now()
                                    });
                                }
                            }
                        } catch(e) {}
                    });
                }
                return origXHRSend.apply(this, arguments);
            };
            
            return { status: 'hook_installed', ts: Date.now() };
        }'''
    
    @staticmethod
    def get_init_geetest_js(gt: str, challenge: str) -> str:
        """返回初始化极验实例的 JS 代码"""
        return f'''() => {{
            return new Promise((resolve, reject) => {{
                try {{
                    // 隐藏容器
                    let container = document.getElementById('geetest_hidden_container');
                    if (!container) {{
                        container = document.createElement('div');
                        container.id = 'geetest_hidden_container';
                        container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:300px;height:300px;';
                        document.body.appendChild(container);
                    }}
                    
                    window.__current_geetest_instance = null;
                    window.__geetest_ready = false;
                    
                    initGeetest({{
                        gt: "{gt}",
                        challenge: "{challenge}",
                        offline: false,
                        new_captcha: true,
                        product: "embed",
                        width: "300px",
                        https: true
                    }}, function(captchaObj) {{
                        window.__current_geetest_instance = captchaObj;
                        window.__geetest_ready = true;
                        
                        captchaObj.onReady(function() {{
                            resolve({{
                                status: 'ready',
                                hasInstance: true
                            }});
                        }});
                        
                        captchaObj.onSuccess(function() {{
                            const result = captchaObj.getValidate();
                            if (result) {{
                                window.__geetest_validate_result = result;
                            }}
                        }});
                        
                        captchaObj.onError(function(e) {{
                            resolve({{
                                status: 'error',
                                message: String(e)
                            }});
                        }});
                        
                        captchaObj.appendTo('#geetest_hidden_container');
                        
                        // 超时保护
                        setTimeout(() => {{
                            resolve({{
                                status: 'timeout',
                                hasInstance: !!window.__current_geetest_instance
                            }});
                        }}, 10000);
                    }});
                }} catch(e) {{
                    reject(e);
                }}
            }});
        }}'''
    
    @staticmethod
    def get_trigger_fullpage_js() -> str:
        """触发 fullpage 阶段 w 参数生成的 JS"""
        return '''() => {
            const instance = window.__current_geetest_instance;
            if (!instance) return { error: 'no_geetest_instance' };
            
            // 清除之前的捕获
            window.__captured_w_params = [];
            
            // 调用 validate 触发极验SDK生成 w 参数
            try {
                instance.validate();
            } catch(e) {}
            
            return { 
                triggered: true,
                captured_count: window.__captured_w_params.length
            };
        }'''
    
    @staticmethod
    def get_read_captured_w_js(w_type: str = None) -> str:
        """读取捕获的 w 参数"""
        if w_type:
            return f'''() => {{
                const all = window.__captured_w_params || [];
                const filtered = all.filter(x => x.type === '{w_type}');
                return {{
                    total: all.length,
                    filtered: filtered.length,
                    items: filtered.map(x => ({{
                        type: x.type,
                        w: x.w,
                        w_length: x.w_length,
                        timestamp: x.timestamp
                    }}))
                }};
            }}'''
        else:
            return '''() => {
                return {
                    total: (window.__captured_w_params || []).length,
                    items: (window.__captured_w_params || []).map(x => ({
                        type: x.type,
                        w_length: x.w_length,
                        url_path: x.url_path,
                        timestamp: x.timestamp
                    }))
                };
            }'''
    
    @staticmethod
    def get_read_captcha_image_js() -> str:
        """读取验证码图片URL"""
        return '''() => {
            const imgs = document.querySelectorAll('#geetest_hidden_container img');
            const urls = [];
            for (let i = 0; i < imgs.length; i++) {
                if (imgs[i].src && imgs[i].src.includes('geetest')) {
                    urls.push(imgs[i].src);
                }
            }
            
            // 也检查 canvas 背景
            const canvases = document.querySelectorAll('#geetest_hidden_container canvas');
            const canvasData = [];
            for (let i = 0; i < canvases.length; i++) {
                try {
                    canvasData.push({
                        width: canvases[i].width,
                        height: canvases[i].height,
                        dataUrl: canvases[i].toDataURL().substring(0, 100)
                    });
                } catch(e) {}
            }
            
            return {
                images: urls,
                canvases: canvasData,
                containerHTML: document.getElementById('geetest_hidden_container').innerHTML.substring(0, 500)
            };
        }'''
    
    @staticmethod
    def get_submit_click_js(coordinates_json: str) -> str:
        """模拟点击坐标提交"""
        return f'''() => {{
            const coords = {coordinates_json};
            
            // 获取极验验证码容器中的 canvas
            const container = document.getElementById('geetest_hidden_container');
            if (!container) return {{ error: 'no_container' }};
            
            const canvas = container.querySelector('canvas');
            if (!canvas) return {{ error: 'no_canvas' }};
            
            const rect = canvas.getBoundingClientRect();
            
            // 创建点击事件序列
            const events = [];
            coords.forEach((coord, index) => {{
                const x = rect.left + coord.x;
                const y = rect.top + coord.y;
                
                const mousedown = new MouseEvent('mousedown', {{
                    clientX: x, clientY: y, bubbles: true
                }});
                const mouseup = new MouseEvent('mouseup', {{
                    clientX: x, clientY: y, bubbles: true
                }});
                const click = new MouseEvent('click', {{
                    clientX: x, clientY: y, bubbles: true
                }});
                
                canvas.dispatchEvent(mousedown);
                canvas.dispatchEvent(mouseup);
                canvas.dispatchEvent(click);
                
                events.push({{ x: coord.x, y: coord.y, index: index }});
            }});
            
            // 等待 w 参数生成
            return {{
                clicked: true,
                event_count: events.length,
                canvas_rect: {{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }},
                captured_w: (window.__captured_w_params || []).filter(x => x.type === 'click_submit').map(x => ({{
                    type: x.type,
                    w_length: x.w_length,
                    timestamp: x.timestamp
                }}))
            }};
        }}'''
    
    @staticmethod
    def get_validate_result_js() -> str:
        """获取最终验证结果"""
        return '''() => {
            return {
                validate_result: window.__geetest_validate_result || null,
                captured_w_count: (window.__captured_w_params || []).length,
                captured_responses: (window.__captured_geetest_responses || []).map(x => ({
                    url: x.url,
                    status: x.data ? x.data.status : null,
                    has_validate: !!(x.data && x.data.data && x.data.data.validate)
                }))
            };
        }'''


# ============ 独立 Node.js w 参数生成方案 (降级) ============

def generate_w_via_nodejs(mode: str, gt: str, challenge: str, 
                          c: list = None, s: str = "", 
                          coords: list = None) -> Optional[str]:
    """
    降级方案: 通过 Node.js 补环境生成 w 参数
    
    Args:
        mode: 'fullpage' 或 'click'
        gt: 极验 gt 参数
        challenge: 极验 challenge 参数
        c: 加密参数 c
        s: 加密参数 s
        coords: 点选坐标列表
    
    Returns:
        w 参数字符串或 None
    """
    import os
    
    js_path = os.path.join(os.path.dirname(__file__), 'geetest_jsdom.js')
    cmd = ['node', js_path,
           '--mode', mode,
           '--gt', gt,
           '--challenge', challenge]
    
    if c:
        cmd.extend(['--c', json.dumps(c)])
    if s:
        cmd.extend(['--s', s])
    if coords:
        cmd.extend(['--coords', json.dumps(coords)])
    
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=30,
            cwd=os.path.dirname(__file__)
        )
        
        if result.returncode != 0:
            logger.error(f"Node.js 执行失败: {result.stderr[:200]}")
            return None
        
        # 从 stdout 解析 JSON
        for line in result.stdout.strip().split('\n'):
            if line.startswith('{'):
                try:
                    data = json.loads(line)
                    w = data.get('w', '')
                    if w:
                        logger.info(f"Node.js w 参数生成成功: mode={mode}, len={len(w)}")
                        return w
                except json.JSONDecodeError:
                    continue
        
        logger.error(f"Node.js 未返回有效 w 参数")
        return None
        
    except subprocess.TimeoutExpired:
        logger.error("Node.js 执行超时")
    except Exception as e:
        logger.error(f"Node.js 调用异常: {e}")
    
    return None
