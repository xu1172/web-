"""
PDD H5 Hub Feed collector (first 5 pages).

- Spawns a long-running Node subprocess (src/runner.js) that exposes an
  anti_content generator via line-delimited JSON over stdin/stdout.
- For each of 5 offsets (10, 30, 50, 70, 90 with count=20) we:
    1. Ask Node for a fresh anti_content.
    2. GET https://mobile.yangkeduo.com/proxy/api/api/alexa/cells/hub/v3
       with the anti_content placed BOTH in the query string and in the
       `anti-content` request header (matches the observed browser behaviour).
    3. Parse response data.goods_list[].data and stream records to
       src/output/goods.jsonl.

The script writes a summary to stdout and finishes; the Node subprocess is
terminated cleanly. No long-running daemon, no browser, no Selenium.
"""

from __future__ import annotations

import json
import os
import random
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import requests


# ---------------------------------------------------------------------------
# paths
# ---------------------------------------------------------------------------
HERE = Path(__file__).resolve().parent           # sites/yangkeduo/src
SITE = HERE.parent                                # sites/yangkeduo
RUNNER_JS = HERE / "runner.js"
OUTPUT_DIR = HERE / "output"
OUTPUT_FILE = OUTPUT_DIR / "goods.jsonl"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# protocol constants
# ---------------------------------------------------------------------------
HUB_URL = "https://mobile.yangkeduo.com/proxy/api/api/alexa/cells/hub/v3"

# Chrome/Safari on iPhone UA; matches the mobile H5 surface.
UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 "
    "Mobile/15E148 Safari/604.1"
)

# Fixed list_id captured from the real session (stable per visit).
# If we observe list_id drift, we rotate it.
DEFAULT_LIST_ID = "wgxptmt48f"

# The 5 pages we collect (count=20 each). These offsets are what the real
# browser emits after the initial landing request.
OFFSETS = [10, 30, 50, 70, 90]
COUNT = 20

# Request pacing (seconds). Human-ish jitter.
BASE_DELAY = 1.2
JITTER = 0.8


# ---------------------------------------------------------------------------
# Node subprocess wrapper
# ---------------------------------------------------------------------------
class AntiContentService:
    """Long-running Node process generating anti_content on demand."""

    def __init__(self, node_bin: str = "node") -> None:
        if not RUNNER_JS.is_file():
            raise FileNotFoundError(f"runner.js not found: {RUNNER_JS}")
        # stderr is forwarded so we can see env errors; stdout stays JSON-only.
        self.proc = subprocess.Popen(
            [node_bin, str(RUNNER_JS)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=sys.stderr,
            bufsize=1,
            text=True,
            encoding="utf-8",
        )
        ready = self._read()
        if not ready.get("ok") or not ready.get("ready"):
            raise RuntimeError(f"runner failed to start: {ready!r}")

    def _read(self) -> dict:
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError("runner closed stdout unexpectedly")
        return json.loads(line.strip())

    def _send(self, obj: dict) -> dict:
        self.proc.stdin.write(json.dumps(obj) + "\n")
        self.proc.stdin.flush()
        return self._read()

    def gen(self, server_time: Optional[int] = None) -> str:
        payload: dict = {"cmd": "gen"}
        if server_time is not None:
            payload["serverTime"] = server_time
        resp = self._send(payload)
        if not resp.get("ok"):
            raise RuntimeError(f"gen failed: {resp.get('err')}")
        anti = resp.get("anti_content")
        if not isinstance(anti, str) or not anti.startswith("0as"):
            raise RuntimeError(f"unexpected anti_content: {anti!r}")
        return anti

    def close(self) -> None:
        try:
            self._send({"cmd": "exit"})
        except Exception:
            pass
        try:
            self.proc.wait(timeout=3)
        except Exception:
            self.proc.kill()


# ---------------------------------------------------------------------------
# HTTP session + request
# ---------------------------------------------------------------------------
def build_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://mobile.yangkeduo.com/",
        "Origin": "https://mobile.yangkeduo.com",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
    })
    return s


def fetch_page(
    session: requests.Session,
    anti: str,
    offset: int,
    list_id: str,
) -> dict:
    params = {
        "pdduid": "0",
        "platform": "H5",
        "page_sn": "10002",
        "page_id": "index_list.html",
        "engine_version": "3.0",
        "offset": str(offset),
        "count": str(COUNT),
        "list_id": list_id,
        "anti_content": anti,
    }
    headers = {"anti-content": anti}
    resp = session.get(HUB_URL, params=params, headers=headers, timeout=15)
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Record extraction
# ---------------------------------------------------------------------------
WANT_FIELDS = (
    "goods_id",
    "goods_name",
    "market_price",
    "normal_price",
    "short_name",
    "sales_tip",
    "thumb_url",
    "link_url",
    "mall_id",
)


def extract_items(payload: dict) -> list[dict]:
    data = payload.get("data") or {}
    goods_list = data.get("goods_list") or []
    out: list[dict] = []
    for entry in goods_list:
        inner = entry.get("data") if isinstance(entry, dict) else None
        if not isinstance(inner, dict):
            continue
        rec = {k: inner.get(k) for k in WANT_FIELDS if k in inner}
        if rec.get("goods_id"):
            out.append(rec)
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> int:
    node_bin = os.environ.get("NODE_BIN", "node")
    print(f"[main] spawning node runner via {node_bin} ...", flush=True)
    svc = AntiContentService(node_bin=node_bin)
    sess = build_session()

    total = 0
    seen_ids: set[str] = set()
    list_id = DEFAULT_LIST_ID

    with OUTPUT_FILE.open("w", encoding="utf-8") as fout:
        for page, offset in enumerate(OFFSETS, start=1):
            try:
                anti = svc.gen(server_time=int(time.time() * 1000))
            except Exception as e:
                print(f"[page {page}] anti_content gen error: {e}", flush=True)
                break

            print(
                f"[page {page}] offset={offset} anti_content="
                f"{anti[:20]}... (len={len(anti)})",
                flush=True,
            )
            try:
                payload = fetch_page(sess, anti, offset, list_id)
            except Exception as e:
                print(f"[page {page}] http error: {e}", flush=True)
                break

            # pick up a fresh list_id from the first response if present
            new_lid = (payload.get("data") or {}).get("list_id")
            if isinstance(new_lid, str) and new_lid:
                list_id = new_lid

            items = extract_items(payload)
            new_items = [it for it in items if str(it["goods_id"]) not in seen_ids]
            for it in new_items:
                seen_ids.add(str(it["goods_id"]))
                fout.write(json.dumps(it, ensure_ascii=False) + "\n")
            total += len(new_items)
            print(
                f"[page {page}] got {len(items)} goods, "
                f"new={len(new_items)}, list_id={list_id}",
                flush=True,
            )
            fout.flush()

            time.sleep(BASE_DELAY + random.random() * JITTER)

    svc.close()
    print(
        f"[done] total_unique={total} pages={len(OFFSETS)} "
        f"output={OUTPUT_FILE}",
        flush=True,
    )
    return 0 if total > 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
