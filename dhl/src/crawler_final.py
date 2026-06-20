"""
DHL 快递追踪 — 生产级爬虫
使用 curl_cffi Chrome 149 TLS 指纹 + 自动 SSL 回退

用法:
  python crawler_final.py XUZA59875
  python crawler_final.py XUZA59875 --json
  python crawler_final.py XUZA59875 --json --no-ssl
"""
import sys
import json
import ssl
import argparse
from typing import Optional

from curl_cffi import requests as cffi_requests
import urllib3

urllib3.disable_warnings()

IMPERSONATE = "chrome110"  # curl_cffi Chrome fingerprint
BASE_URL = "https://www.dhl.com"
UTAPI_URL = f"{BASE_URL}/utapi"
REFERER = f"{BASE_URL}/cn-zh/home/tracking.html"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": REFERER,
    "Sec-Ch-Ua": '"Google Chrome";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
}


def track(tracking_number: str, language: str = "zh",
          country_code: str = "CN", verify: bool = True,
          timeout: int = 15) -> dict:
    """查询 DHL 运单追踪信息

    Returns:
        {
            "success": bool,
            "tracking_number": str,
            "status": str,
            "origin": str,
            "destination": str,
            "weight": str,
            "pieces": int,
            "product": str,
            "carrier": str,
            "events": [{"time": str, "location": str, "status": str, "description": str}],
            "routes": [{"vessel": str, "voyage": str, "from": str, "to": str}],
            "references": [{"number": str, "type": str}],
            "raw": dict,
        }
    """
    params = {
        "trackingNumber": tracking_number,
        "language": language,
        "requesterCountryCode": country_code,
        "source": "tt",
        "inputsource": "marketingstage",
    }

    try:
        resp = cffi_requests.get(
            UTAPI_URL,
            params=params,
            headers=HEADERS,
            impersonate=IMPERSONATE,
            verify=verify,
            timeout=timeout,
        )
    except Exception as e:
        if verify:
            # Retry without SSL verification
            try:
                resp = cffi_requests.get(
                    UTAPI_URL, params=params, headers=HEADERS,
                    impersonate=IMPERSONATE, verify=False, timeout=timeout,
                )
            except Exception as e2:
                return {"success": False, "error": str(e2)}
        else:
            return {"success": False, "error": str(e)}

    if resp.status_code != 200:
        return {"success": False, "error": f"HTTP {resp.status_code}", "raw": resp.text[:500]}

    try:
        data = resp.json()
    except json.JSONDecodeError:
        return {"success": False, "error": "Invalid JSON response", "raw": resp.text[:500]}

    shipments = data.get("shipments", [])
    if not shipments:
        return {"success": False, "error": "No shipment data found"}

    s = shipments[0]
    details = s.get("details", {})
    status = s.get("status", {})
    origin = s.get("origin", {}).get("address", {})
    dest = s.get("destination", {}).get("address", {})

    return {
        "success": True,
        "tracking_number": s.get("id", ""),
        "service": s.get("service", ""),
        "origin": f"{origin.get('addressLocality', '')}, {origin.get('countryCode', '')}",
        "destination": f"{dest.get('addressLocality', '')}, {dest.get('countryCode', '')}",
        "status": status.get("statusCode", ""),
        "status_description": status.get("description", ""),
        "status_time": status.get("timestamp", ""),
        "weight": f"{details.get('weight', {}).get('value', '')} {details.get('weight', {}).get('unitText', '')}",
        "volume": f"{details.get('volume', {}).get('value', '')} {details.get('volume', {}).get('unitText', '')}",
        "pieces": details.get("totalNumberOfPieces", 0),
        "product": details.get("product", {}).get("productName", ""),
        "carrier": details.get("carrier", {}).get("organizationName", ""),
        "events": [
            {
                "time": e.get("timestamp", ""),
                "location": e.get("location", {}).get("address", {}).get("addressLocality", ""),
                "status": e.get("statusCode", ""),
                "description": e.get("description", ""),
            }
            for e in s.get("events", [])
        ],
        "routes": [
            {
                "vessel": r.get("dgf:vesselName", ""),
                "voyage": r.get("dgf:voyageFlightNumber", ""),
                "from": r.get("dgf:portOfLoading", {}).get("dgf:locationName", ""),
                "to": r.get("dgf:portOfUnloading", {}).get("dgf:locationName", ""),
                "etd": r.get("dgf:estimatedDepartureDate", ""),
                "eta": r.get("dgf:estimatedArrivalDate", ""),
            }
            for r in details.get("dgf:routes", [])
        ],
        "references": [
            {"number": ref.get("number", ""), "type": ref.get("type", "")}
            for ref in details.get("references", [])
        ],
        "raw": data,
    }


def format_text(result: dict) -> str:
    """格式化文本输出"""
    if not result.get("success"):
        return f"ERROR: {result.get('error', 'Unknown error')}"

    lines = [
        "=" * 60,
        f"  DHL 运单追踪: {result['tracking_number']}",
        "=" * 60,
        f"  服务类型: {result.get('service', 'N/A')}",
        f"  产品:     {result.get('product', 'N/A')}",
        f"  承运人:   {result.get('carrier', 'N/A')}",
        f"  始发地:   {result.get('origin', 'N/A')}",
        f"  目的地:   {result.get('destination', 'N/A')}",
        f"  件数:     {result.get('pieces', 0)}",
        f"  重量:     {result.get('weight', 'N/A')}",
        f"  体积:     {result.get('volume', 'N/A')}",
        "-" * 60,
        f"  状态:     {result.get('status_description', 'N/A')}",
        f"  状态时间: {result.get('status_time', 'N/A')}",
        "-" * 60,
    ]

    routes = result.get("routes", [])
    if routes:
        lines.append("  [ROUTES]")
        for r in routes:
            lines.append(f"    {r['from']} -> {r['to']}")
            lines.append(f"    Vessel: {r['vessel']} / {r['voyage']}")
            lines.append(f"    ETD: {r['etd']}  ETA: {r['eta']}")
        lines.append("-" * 60)

    refs = result.get("references", [])
    if refs:
        lines.append("  [REFERENCES]")
        for ref in refs:
            lines.append(f"    [{ref['type']}] {ref['number']}")
        lines.append("-" * 60)

    events = result.get("events", [])
    if events:
        lines.append("  [TRACKING EVENTS]")
        icons = {"delivered": "[OK]", "transit": "[>>]", "pre-transit": "[--]", "unknown": "[??]"}
        for ev in events:
            icon = icons.get(ev.get("status", ""), "[..]")
            loc = ev.get("location", "") or ""
            lines.append(f"    {icon} {ev['time']} | {loc:15s} | {ev['description']}")
        lines.append("-" * 60)

    lines.append("=" * 60)
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="DHL Express Tracking")
    parser.add_argument("tracking_number", nargs="?", default="XUZA59875",
                        help="Tracking number (default: XUZA59875)")
    parser.add_argument("--json", action="store_true", help="JSON output")
    parser.add_argument("--no-ssl", action="store_true",
                        help="Disable SSL verification (corporate proxy)")
    parser.add_argument("--lang", default="zh", help="Language (default: zh)")

    args = parser.parse_args()

    result = track(
        args.tracking_number,
        language=args.lang,
        verify=not args.no_ssl,
    )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(format_text(result))

    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()
