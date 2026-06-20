"""
DHL Akamai 3.0 补环境求解器
使用 curl_cffi (TLS指纹) + Node.js (vm2补环境) 突破 Akamai 防护

流程:
  1. GET /tracking.html → 提取 Akamai JS URL + 初始 Cookie
  2. GET Akamai JS → 保存 sensor.js
  3. Node.js vm2 执行 sensor.js → 捕获 sensor_data
  4. POST sensor_data → 获取有效 _abck Cookie
  5. 携带有效 Cookie → 调用 tracking API

用法:
  python akamai_solver.py XUZA59875
"""
import sys
import re
import json
import time
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urljoin, urlparse

from curl_cffi import requests as cffi_requests


# ─── 配置 ──────────────────────────────────────────────
BASE_URL = "https://www.dhl.com"
TRACKING_URL = f"{BASE_URL}/cn-zh/home/tracking.html"
UTAPI_URL = f"{BASE_URL}/utapi"
NODE_SCRIPT = Path(__file__).parent / "akamai_env.js"

# Chrome 149 TLS 指纹
IMPERSONATE = "chrome110"  # curl_cffi 支持的 Chrome 版本


class AkamaiSession:
    """管理 Akamai 验证会话"""

    def __init__(self, verbose: bool = False):
        self.verbose = verbose
        self.session = cffi_requests.Session()
        # curl_cffi 默认使用 certifi；公司代理环境会 SSL 失败
        # 通过设置 impersonate 获得正确的 TLS 指纹
        self.base_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "max-age=0",
            "Sec-Ch-Ua": '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Upgrade-Insecure-Requests": "1",
        }
        self.session.headers.update(self.base_headers)
        self.cookies = {}

    def log(self, *args):
        if self.verbose:
            print(f"[AkamaiSession]", *args)

    def get(self, url: str, **kwargs) -> cffi_requests.Response:
        """GET 请求，自动维护 Cookie"""
        resp = self.session.get(
            url,
            impersonate=IMPERSONATE,
            headers={"Referer": self._referer(url)},
            **kwargs,
        )
        self._update_cookies(resp)
        return resp

    def post(self, url: str, data=None, json_data=None, **kwargs) -> cffi_requests.Response:
        """POST 请求，自动维护 Cookie"""
        resp = self.session.post(
            url,
            data=data,
            json=json_data,
            impersonate=IMPERSONATE,
            headers={"Referer": self._referer(url)},
            **kwargs,
        )
        self._update_cookies(resp)
        return resp

    def _referer(self, url: str) -> str:
        return TRACKING_URL

    def _update_cookies(self, resp: cffi_requests.Response):
        """从响应提取 Set-Cookie"""
        for cookie in resp.cookies:
            self.cookies[cookie.name] = cookie.value

    def get_cookie_string(self) -> str:
        return "; ".join(f"{k}={v}" for k, v in self.cookies.items())


def extract_akamai_js_url(html: str) -> Optional[str]:
    """从首页 HTML 提取 Akamai sensor JS URL

    Akamai JS 特征:
    - 路径格式: /XXXX/XXXX/... (随机字符)
    - script 标签无特定 ID
    """
    # 方法1: 查找所有 script src
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
    for src in scripts:
        # Akamai JS 通常路径较长，且不含常见关键词
        parsed = urlparse(src)
        path = parsed.path or src
        # 过滤已知的非 Akamai 脚本
        skip_keywords = [
            "clientlib", "adobedtm", "cookielaw", "googletagmanager",
            "jquery", "bundle", "launch", "otSDKStub", "AppMeasurement",
            "dove.dhl.com", "csr.js",
        ]
        if not any(kw in src for kw in skip_keywords):
            if len(path) > 10 and path.count("/") >= 3:
                return src if src.startswith("http") else urljoin(BASE_URL, src)

    # 方法2: 匹配 Akamai 特征模式: /随机串/随机串/.../随机串
    akamai_pattern = re.findall(r'"(/[A-Za-z0-9_-]{8,}/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/[A-Za-z0-9_-]{8,})"', html)
    if akamai_pattern:
        return urljoin(BASE_URL, akamai_pattern[0])

    return None


def run_node_env(sensor_js_path: str, cookies: str, page_url: str,
                 timeout: int = 30) -> dict:
    """运行 Node.js 补环境脚本"""
    cmd = [
        "node",
        str(NODE_SCRIPT),
        sensor_js_path,
        cookies,
        page_url,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(Path(__file__).parent),
        )

        stdout = result.stdout.strip()
        stderr = result.stderr.strip()

        if stderr:
            print(f"  [Node stderr] {stderr[:500]}")

        if stdout:
            return json.loads(stdout)
        else:
            return {"status": "error", "message": "No output from Node.js"}

    except subprocess.TimeoutExpired:
        return {"status": "error", "message": f"Node.js timeout ({timeout}s)"}
    except json.JSONDecodeError:
        return {"status": "error", "message": f"Invalid JSON output: {stdout[:200] if stdout else 'empty'}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def solve_akamai(tracking_number: str, verbose: bool = False) -> dict:
    """主求解流程"""
    session = AkamaiSession(verbose=verbose)

    # ── Step 1: GET 首页，获取 HTML 和初始 Cookie ──
    print(f"[1/5] GET {TRACKING_URL}")
    try:
        resp = session.get(TRACKING_URL, params={
            "tracking-id": tracking_number,
            "submit": "1",
            "inputsource": "marketingstage",
        })
    except Exception as e:
        print(f"  ERROR: {e}")
        print(f"  Hint: 可能需要禁用 SSL 验证或配置代理")
        return {"error": f"Failed to fetch homepage: {e}"}

    html = resp.text
    print(f"  Status: {resp.status_code}, Size: {len(html)} bytes")
    print(f"  Cookies: {session.get_cookie_string()[:200]}")

    # ── Step 2: 提取 Akamai JS URL ──
    print(f"[2/5] Extracting Akamai JS URL...")
    js_url = extract_akamai_js_url(html)

    if not js_url:
        print("  WARNING: No Akamai JS URL found. API might work without Akamai.")
        # 直接尝试 API
        return call_tracking_api(session, tracking_number)

    print(f"  Found: {js_url}")

    # ── Step 3: GET Akamai JS ──
    print(f"[3/5] Downloading Akamai sensor JS...")
    try:
        js_resp = session.get(js_url)
        sensor_js = js_resp.text
        print(f"  Size: {len(sensor_js)} bytes")
    except Exception as e:
        print(f"  ERROR downloading JS: {e}")
        return call_tracking_api(session, tracking_number)

    # 保存 sensor.js
    assets_dir = Path(__file__).parent.parent / "assets"
    assets_dir.mkdir(exist_ok=True)
    sensor_path = assets_dir / "sensor_latest.js"
    sensor_path.write_text(sensor_js, encoding="utf-8")

    # ── Step 4: Node.js 补环境 ──
    print(f"[4/5] Running Node.js 补环境...")
    env_result = run_node_env(
        str(sensor_path),
        session.get_cookie_string(),
        TRACKING_URL + f"?tracking-id={tracking_number}&submit=1&inputsource=marketingstage",
    )
    print(f"  Result: {json.dumps(env_result, ensure_ascii=False)[:500]}")

    # 如果有 sensor_data，POST 回去
    if env_result.get("status") == "ok" and env_result.get("sensor_data"):
        sensor_data = env_result["sensor_data"]
        post_url = env_result.get("post_url") or js_url

        print(f"  POST sensor_data to {post_url} ({len(str(sensor_data))} bytes)")
        try:
            post_resp = session.post(
                post_url,
                data=sensor_data,
                headers={"Content-Type": "text/plain"},
            )
            print(f"  POST Status: {post_resp.status_code}")
            print(f"  Set-Cookie: {str(post_resp.headers.get('set-cookie', ''))[:200]}")
            print(f"  Cookies after POST: {session.get_cookie_string()[:200]}")
        except Exception as e:
            print(f"  POST ERROR: {e}")

    # ── Step 5: 调用追踪 API ──
    print(f"[5/5] Calling tracking API...")
    return call_tracking_api(session, tracking_number)


def call_tracking_api(session: AkamaiSession, tracking_number: str) -> dict:
    """调用 DHL tracking API"""
    params = {
        "trackingNumber": tracking_number,
        "language": "zh",
        "requesterCountryCode": "CN",
        "source": "tt",
        "inputsource": "marketingstage",
    }

    try:
        resp = session.get(UTAPI_URL, params=params)
        print(f"  Status: {resp.status_code}")

        if resp.status_code == 200:
            data = resp.json()
            shipments = data.get("shipments", [])
            if shipments:
                s = shipments[0]
                status = s.get("status", {})
                return {
                    "success": True,
                    "tracking_number": tracking_number,
                    "status": status.get("statusCode"),
                    "status_desc": status.get("description"),
                    "origin": s.get("origin", {}).get("address", {}).get("addressLocality"),
                    "destination": s.get("destination", {}).get("address", {}).get("addressLocality"),
                    "events_count": len(s.get("events", [])),
                    "raw": data,
                }
            return {"success": True, "tracking_number": tracking_number, "raw": data}
        elif resp.status_code == 428:
            return {
                "success": False,
                "error": "Akamai 验证未通过 (428). 需要更新 sensor_data 生成逻辑.",
                "status_code": 428,
            }
        else:
            return {
                "success": False,
                "error": f"Unexpected status: {resp.status_code}",
                "response": resp.text[:500],
            }

    except Exception as e:
        return {"success": False, "error": str(e)}


def direct_track(tracking_number: str) -> dict:
    """直接调用 API (无 Akamai) - 作为回退方案"""
    try:
        resp = cffi_requests.get(
            UTAPI_URL,
            params={
                "trackingNumber": tracking_number,
                "language": "zh",
                "requesterCountryCode": "CN",
                "source": "tt",
                "inputsource": "marketingstage",
            },
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
                "Referer": TRACKING_URL,
            },
            impersonate=IMPERSONATE,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"success": True, "method": "direct", "raw": data}
        return {"success": False, "error": f"Status {resp.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    import argparse
    parser = argparse.ArgumentParser(description="DHL Akamai 求解器")
    parser.add_argument("tracking_number", nargs="?", default="XUZA59875",
                        help="运单号 (默认: XUZA59875)")
    parser.add_argument("--direct", action="store_true",
                        help="直接调用 API (跳过 Akamai)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="详细输出")
    parser.add_argument("--output", "-o", choices=["text", "json"], default="text",
                        help="输出格式")

    args = parser.parse_args()

    if args.direct:
        print(f"Direct API call for {args.tracking_number}...")
        result = direct_track(args.tracking_number)
    else:
        print(f"Akamai solver for {args.tracking_number}...")
        print("=" * 60)
        result = solve_akamai(args.tracking_number, verbose=args.verbose)
        print("=" * 60)

    if args.output == "json":
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if result.get("success"):
            if "method" in result:
                print(f"\n[DONE] Direct API call succeeded")
            else:
                print(f"\n[DONE] Akamai flow completed")
            print(f"  Tracking: {result.get('tracking_number')}")
            print(f"  Status: {result.get('status_desc') or result.get('status')}")
            print(f"  Origin: {result.get('origin')}")
            print(f"  Destination: {result.get('destination')}")
            print(f"  Events: {result.get('events_count')}")

            # 打印物流事件
            raw = result.get("raw", {})
            shipments = raw.get("shipments", [])
            if shipments:
                events = shipments[0].get("events", [])
                if events:
                    print(f"\n  Recent tracking events:")
                    for ev in events[:5]:
                        loc = ev.get("location", {}).get("address", {}).get("addressLocality", "")
                        print(f"    {ev.get('timestamp')} [{ev.get('statusCode')}] {ev.get('description')} ({loc})")
        else:
            print(f"\n[FAILED] {result.get('error')}")


if __name__ == "__main__":
    main()
