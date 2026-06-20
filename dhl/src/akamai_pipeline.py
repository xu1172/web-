"""
DHL Akamai 3.0 — 完整协议请求 Pipeline

流程:
  1. GET 首页 → 提取 Akamai JS URL
  2. GET Akamai JS → 保存
  3. Node.js 生成 sensor_data (akamai_full.js)
  4. POST sensor_data → 获取 _abck / bm_sz
  5. 携带 Cookie 调用 tracking API

用法:
  python akamai_pipeline.py XUZA59875
"""
import sys
import re
import json
import subprocess
from pathlib import Path
from urllib.parse import urljoin

from curl_cffi import requests as cffi_requests

IMPERSONATE = "chrome110"
BASE_URL = "https://www.dhl.com"
TRACKING_URL = f"{BASE_URL}/cn-zh/home/tracking.html"
UTAPI_URL = f"{BASE_URL}/utapi"
NODE_SCRIPT = Path(__file__).parent / "akamai_full.js"
FILE_HASH = 2525281482  # Extracted from DHL Akamai JS


def extract_js_url(html: str) -> str | None:
    """从 HTML 提取 Akamai sensor JS URL"""
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
    skip = [
        "clientlib", "adobedtm", "cookielaw", "googletagmanager",
        "jquery", "bundle", "launch", "otSDKStub", "AppMeasurement",
    ]
    for src in scripts:
        if not any(kw in src for kw in skip):
            path = src.split("?")[0]
            if len(path) > 15 and path.count("/") >= 3:
                return src if src.startswith("http") else urljoin(BASE_URL, src)
    return None


def generate_sensor_data(page_url: str) -> dict:
    """调用 Node.js 生成 sensor_data"""
    result = subprocess.run(
        ["node", str(NODE_SCRIPT), page_url],
        capture_output=True, text=True, timeout=30,
        cwd=str(Path(__file__).parent),
    )
    return json.loads(result.stdout)


def solve_and_track(tracking_number: str, verbose: bool = False) -> dict:
    """完整 Akamai + Tracking 流程"""
    session = cffi_requests.Session()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }

    page_url = f"{TRACKING_URL}?tracking-id={tracking_number}&submit=1&inputsource=marketingstage"

    # Step 1: GET homepage
    if verbose:
        print(f"[1] GET {page_url}")
    try:
        resp = session.get(page_url, headers=headers, impersonate=IMPERSONATE)
    except Exception as e:
        # Retry without SSL
        resp = session.get(page_url, headers=headers, impersonate=IMPERSONATE, verify=False)

    if verbose:
        print(f"    Status: {resp.status_code}, Cookies: {len(resp.cookies)}")

    # Step 2: Extract Akamai JS URL
    js_url = extract_js_url(resp.text)
    if js_url and verbose:
        print(f"[2] Akamai JS: {js_url}")
    elif not js_url and verbose:
        print(f"[2] No Akamai JS URL found (may not be required)")

    # Step 3: Generate sensor_data
    if verbose:
        print(f"[3] Generating sensor_data...")
    sensor_result = generate_sensor_data(page_url)
    if verbose:
        print(f"    Status: {sensor_result.get('status')}, Length: {sensor_result.get('sensor_data_length', 0)}")

    # Step 4: POST sensor_data (if we have the URL)
    if js_url and sensor_result.get("status") == "ok":
        post_url = js_url  # POST to same path as JS
        if verbose:
            print(f"[4] POST sensor_data to {post_url}")
        try:
            post_resp = session.post(
                post_url,
                data=sensor_result["sensor_data"],
                headers={"Content-Type": "text/plain", **headers},
                impersonate=IMPERSONATE,
            )
            if verbose:
                print(f"    POST Status: {post_resp.status_code}")
                set_cookie = post_resp.headers.get("set-cookie", "")
                if "_abck" in set_cookie:
                    print(f"    _abck: {set_cookie[:200]}")
        except Exception as e:
            if verbose:
                print(f"    POST failed: {e}")

    # Step 5: Call tracking API
    if verbose:
        print(f"[5] Calling tracking API...")
    try:
        api_resp = session.get(
            UTAPI_URL,
            params={
                "trackingNumber": tracking_number,
                "language": "zh",
                "requesterCountryCode": "CN",
                "source": "tt",
                "inputsource": "marketingstage",
            },
            headers={**headers, "Accept": "*/*", "Referer": TRACKING_URL},
            impersonate=IMPERSONATE,
        )
    except Exception as e:
        api_resp = session.get(UTAPI_URL, params={
            "trackingNumber": tracking_number, "language": "zh",
            "requesterCountryCode": "CN", "source": "tt",
            "inputsource": "marketingstage",
        }, headers={**headers, "Accept": "*/*"}, impersonate=IMPERSONATE, verify=False)

    if api_resp.status_code == 200:
        data = api_resp.json()
        shipments = data.get("shipments", [])
        if shipments:
            s = shipments[0]
            return {
                "success": True,
                "tracking_number": s["id"],
                "status": s.get("status", {}).get("statusCode"),
                "status_desc": s.get("status", {}).get("description"),
                "origin": s.get("origin", {}).get("address", {}).get("addressLocality"),
                "destination": s.get("destination", {}).get("address", {}).get("addressLocality"),
                "events": len(s.get("events", [])),
                "sensor_generated": sensor_result.get("status") == "ok",
                "fileHash": FILE_HASH,
            }
    return {
        "success": False,
        "error": f"API returned {api_resp.status_code}",
        "sensor_generated": sensor_result.get("status") == "ok",
    }


if __name__ == "__main__":
    tn = sys.argv[1] if len(sys.argv) > 1 else "XUZA59875"
    result = solve_and_track(tn, verbose=True)
    print("\n" + "=" * 50)
    print(json.dumps(result, ensure_ascii=False, indent=2))
