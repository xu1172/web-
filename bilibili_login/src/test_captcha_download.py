"""下载当前浏览器中的极验验证码图片并用云码识别"""
import requests
import base64
import json
import os
import sys
import re

sys.path.insert(0, os.path.dirname(__file__))
from captcha_solver import BiliClickCaptchaSolver

# 验证码图片URL (从浏览器中截取的)
IMAGE_URL = "https://static.geetest.com/captcha_v3/batch/v3/141603/2026-05-14T16/word/e71c136819e246f5b1e441196bab0ece.jpg?challenge=47a1599a7de7dd40e8ba709dbe1a99e2"

YUNMA_TOKEN = "tR5pqscPQ0EI8n7thn38hAIyyakstNb6-DFUuT9pGwI"

# 下载图片
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com/',
})

print(f"下载验证码图片: {IMAGE_URL[:80]}...")
resp = session.get(IMAGE_URL, timeout=15)
print(f"HTTP状态: {resp.status_code}, 大小: {len(resp.content)} bytes")

if resp.status_code == 200:
    # 保存图片
    save_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'captcha_current.jpg')
    with open(save_path, 'wb') as f:
        f.write(resp.content)
    print(f"图片已保存: {save_path}")

    # 云码识别
    solver = BiliClickCaptchaSolver(YUNMA_TOKEN)
    ok, coords, msg = solver.solve(resp.content)
    print(f"\n识别结果: ok={ok}, msg={msg}")
    if coords:
        print(f"坐标: {json.dumps(coords, ensure_ascii=False)}")
else:
    print(f"下载失败: {resp.text[:200]}")
