"""
test_full_protocol.py - CRV 极验完整三步协议测试
==================================================
流程：
1. load1（无lot_number）→ captcha_type=ai, lot_number, challenge, pt=10
2. verify1（pt=10, w=RSA+AES加密的collectData）→ 预期 fail（正常）
3. load2（带lot_number）→ captcha_type=slide + 图片路径
4. 下载图片 + 云码识别缺口（type=10110）
5. 生成轨迹 + verify2（滑块验证）
"""
import requests
import uuid
import time
import json
import os
import subprocess
import sys
import base64
import random

# ====== 配置 ======
CAPTCHA_ID = 'a755b69aedd176d3cd4f8a515d07a69f'
API_BASE = 'https://athena.crv.com.cn'
STATIC_BASE = 'https://athenares.crv.com.cn'
YUNMA_TOKEN = "tR5pqscPQ0EI8n7thn38hAIyyakstNb6-DFUuT9pGwI"
YUNMA_API = "http://api.jfbym.com/api/YmServer/customApi"
YUNMA_TYPE_SLIDE = "20111"  # 极验4滑块（正确 type，返回背景缺口最左边缘 x）

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ENCRYPT_W_JS = os.path.join(SCRIPT_DIR, 'encrypt_w_helper.js')
GENERATE_W_JS = os.path.join(SCRIPT_DIR, 'generate_w.js')

COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Referer': 'https://cpcloud.crv.com.cn/',
    'Origin': 'https://cpcloud.crv.com.cn',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
}

IMG_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Referer': 'https://cpcloud.crv.com.cn/',
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site',
}


def parse_jsonp(text):
    start = text.index('(') + 1
    end = text.rindex(')')
    return json.loads(text[start:end])


def gen_callback():
    return f'geetest_{int(time.time() * 1000)}'


# ====== Step 1: load1 ======
def load_step1(session, challenge):
    """第一步 load：获取 lot_number + pt=10"""
    r = session.get(f'{API_BASE}/load', params={
        'captcha_id': CAPTCHA_ID,
        'risk_type': 'slide',
        'challenge': challenge,
        'client_type': 'web',
        'callback': gen_callback(),
    }, headers=COMMON_HEADERS, timeout=15)
    r.raise_for_status()
    data = parse_jsonp(r.text)
    d = data['data']
    print(f'[load1] captcha_type={d.get("captcha_type")} lot={d.get("lot_number","")[:8]}... pt={d.get("pt")}')
    return d


# ====== Step 2: 生成 w 参数（Node.js 辅助脚本）======
def generate_w_for_verify(collect_data: dict) -> str:
    """
    调用 encrypt_w_helper.js 生成 pt=10 的 w 参数
    collect_data: _collectData 内容（captcha 实例配置）
    """
    result = subprocess.run(
        ['node', ENCRYPT_W_JS, 'collect', json.dumps(collect_data)],
        capture_output=True, text=True, timeout=10, cwd=SCRIPT_DIR
    )
    if result.returncode != 0:
        raise RuntimeError(f'encrypt_w_helper.js failed: {result.stderr}')
    output = result.stdout.strip()
    for line in reversed(output.split('\n')):
        line = line.strip()
        if line.startswith('{'):
            data = json.loads(line)
            if data.get('w'):
                return data['w']
    raise RuntimeError(f'No w in output: {output[:200]}')


# ====== Step 3: verify1（pt=10 无感验证）======
def verify_step1(session, lot_number, challenge, pt, w):
    """
    第一次 verify（pt=10 无感验证）
    预期返回 result=fail，但服务端会标记 lot_number 已验证
    """
    params = {
        'lot_number': lot_number,
        'captcha_id': CAPTCHA_ID,
        'client_type': 'web',
        'challenge': challenge,
        'pt': pt,
        'w': w,
    }
    headers = dict(COMMON_HEADERS)
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    r = session.post(f'{API_BASE}/verify', data=params, headers=headers, timeout=15)
    r.raise_for_status()
    data = r.json()
    result = data.get('data', {})
    result_val = result.get('result') if isinstance(result, dict) else result
    print(f'[verify1] status={data.get("status")} result={result_val}')
    return data


# ====== Step 4: load2 ======
def load_step2(session, challenge, lot_number):
    """第二步 load：带 lot_number，应该返回 captcha_type=slide
    注意：服务端会返回新的 challenge 和 lot_number，verify2 必须用这个新 challenge
    """
    r = session.get(f'{API_BASE}/load', params={
        'captcha_id': CAPTCHA_ID,
        'lot_number': lot_number,
        'challenge': challenge,
        'risk_type': 'slide',
        'callback': gen_callback(),
    }, headers=COMMON_HEADERS, timeout=15)
    r.raise_for_status()
    data = parse_jsonp(r.text)
    d = data['data']
    print(f'[load2] captcha_type={d.get("captcha_type")} ypos={d.get("ypos")}')
    print(f'  [load2] new_lot={d.get("lot_number","")[:8]}... new_challenge={d.get("challenge","")[:12]}...')
    if d.get('bg'):
        print(f'  bg={d["bg"][:60]}...')
    return d


# ====== Step 5: 下载图片 ======
def download_image(session, path_or_url, save_as=None):
    url = path_or_url if path_or_url.startswith('http') else f'{STATIC_BASE}/{path_or_url}'
    r = session.get(url, headers=IMG_HEADERS, timeout=15)
    if r.status_code == 200 and len(r.content) > 100:
        if save_as:
            with open(save_as, 'wb') as f:
                f.write(r.content)
        print(f'  [OK] {url[-50:]} size={len(r.content)}')
        return r.content
    print(f'  [FAIL] {url[-50:]} status={r.status_code}')
    return None


# ====== Step 6: 云码识别 ======
def recognize_gap_yunma(bg_bytes, slider_bytes):
    """
    云码 type=20111：
    - slide_image: 滑块原图 base64
    - background_image: 背景原图 base64
    - 返回：背景图上缺口最左边缘的 x 坐标
    """
    try:
        bg_b64 = base64.b64encode(bg_bytes).decode()
        slider_b64 = base64.b64encode(slider_bytes).decode()
        data = {
            'slide_image': slider_b64,       # 滑块原图
            'background_image': bg_b64,       # 背景原图（带缺口的 bg）
            'token': YUNMA_TOKEN,
            'type': YUNMA_TYPE_SLIDE,
        }
        resp = requests.post(YUNMA_API, data=data, timeout=30)
        result = resp.json()
        code = result.get('code')
        print(f'  [yunma] code={code} msg={result.get("msg")}')
        if code in (10000, 0):
            raw_data = result.get('data', {})
            coord = raw_data.get('data', '0') if isinstance(raw_data, dict) else str(raw_data)
            coord = str(coord).strip()
            print(f'  [yunma] raw_coord={repr(coord)}')
            x = int(float(coord))
            print(f'  [yunma] gap_x={x}')
            return x
        else:
            print(f'  [yunma] failed: {result}')
    except Exception as e:
        print(f'  [yunma error] {e}')
    return None


# ====== Step 7: 生成轨迹 ======
def generate_track(distance):
    track = []
    total_time = random.randint(1400, 2200)
    steps = random.randint(20, 30)
    for i in range(1, steps + 1):
        progress = i / steps
        if progress < 0.6:
            x = int(distance * 0.6 * (progress / 0.6) ** 2)
        else:
            x = int(distance * 0.6 + distance * 0.4 * (1 - (1 - (progress - 0.6) / 0.4) ** 3))
        x = min(x, distance)
        y = random.randint(-3, 3)
        t = int(total_time * progress)
        track.append([x, y, t])
    if track[-1][0] != distance:
        track.append([distance, 0, int(total_time) + random.randint(30, 80)])
    return track


# ====== Step 8: generate_w.js（滑块验证）======
def generate_w_for_slide(lot_number, captcha_id, challenge, pt, track_or_distance, verify1=False):
    """
    用 generate_w.js 生成 w 参数
    verify1=True: 生成 verify1 的 w（s = {geetest,gct,em,type:'ai',passtime:10}）
    verify1=False: 生成 verify2 的 w（s = {geetest,gct,em,trackOffset,type:'slide',answer,passtime}）
    track_or_distance: int(距离) 或 list(轨迹点)，不为 None 时传入
    """
    args = ['node', GENERATE_W_JS, lot_number, captcha_id, challenge, str(pt)]
    if verify1:
        args.append('verify1')  # 特殊标记
    elif track_or_distance is not None:
        if isinstance(track_or_distance, int):
            # 传入距离数字，generate_w.js 内部生成 3 点轨迹（确保 w=640）
            args.append(str(track_or_distance))
        else:
            # 传入完整轨迹（generate_w.js 会自动压缩为 3 点）
            args.append(json.dumps(track_or_distance))
    result = subprocess.run(
        args,
        capture_output=True, text=True, timeout=15, cwd=SCRIPT_DIR
    )
    stdout = result.stdout.strip()
    stderr = result.stderr.strip()
    if stderr:
        # 解析调试信息
        for line in stderr.split('\n'):
            line = line.strip()
            if line.startswith('{"debug_s"'):
                try:
                    debug = json.loads(line)
                    print(f'  [debug] s={json.dumps(debug.get("debug_s",{}), ensure_ascii=False)[:300]}')
                    print(f'  [debug] json_len={debug.get("debug_json_len")}')
                except:
                    pass
            else:
                print(f'  [generate_w stderr] {line[:200]}')
    for line in reversed(stdout.split('\n')):
        line = line.strip()
        if line.startswith('{'):
            d = json.loads(line)
            if d.get('w'):
                return d['w']
            elif d.get('error'):
                print(f'  [generate_w error] {d["error"]}')
    return None


# ====== Step 9: verify2（滑块验证）======
def verify_step2(session, lot_number, challenge, pt, w):
    """第二次 verify（滑块验证）"""
    params = {
        'lot_number': lot_number,
        'captcha_id': CAPTCHA_ID,
        'client_type': 'web',
        'challenge': challenge,
        'pt': pt,
        'w': w,
    }
    headers = dict(COMMON_HEADERS)
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    r = session.post(f'{API_BASE}/verify', data=params, headers=headers, timeout=15)
    r.raise_for_status()
    data = r.json()
    result = data.get('data', {})
    result_val = result.get('result') if isinstance(result, dict) else result
    print(f'[verify2] status={data.get("status")} result={result_val}')
    print(f'[verify2] full: {json.dumps(data, ensure_ascii=False)[:300]}')
    return data


# ====== 主流程 ======
def run_full_protocol():
    print('=== CRV 极验完整三步协议测试 ===\n')
    session = requests.Session()

    # 生成 challenge
    challenge = str(uuid.uuid4())
    print(f'Challenge: {challenge}')

    # Step 1: load1
    print('\n--- Step 1: load1 ---')
    data1 = load_step1(session, challenge)
    lot_number = data1['lot_number']
    pt = str(data1.get('pt', '10'))
    # gct 不在 load1 响应中，而是由浏览器内部 gct.js 运行生成的数字字符串
    # 真实浏览器示例: "138800804"，这由 captcha_live_patched.js 配合 gct.js 运行自动生成

    # Step 2: 生成 w1（verify1，明文是 {geetest,gct,em,type:"ai",passtime:N}）
    print('\n--- Step 2: 生成 w1（verify1 pt=10 ai无感验证）---')
    try:
        w1 = generate_w_for_slide(lot_number, CAPTCHA_ID, challenge, pt, None, verify1=True)
        print(f'w1 length: {len(w1)}, first 32: {w1[:32]}...')
    except Exception as e:
        print(f'[ERROR] w1 生成失败: {e}')
        return False

    # Step 3: verify1（pt=10，预期 fail）
    print('\n--- Step 3: verify1（pt=10，预期 fail）---')
    v1_result = verify_step1(session, lot_number, challenge, pt, w1)

    # Step 4: load2（带 lot_number）
    print('\n--- Step 4: load2（期待 captcha_type=slide）---')
    data2 = load_step2(session, challenge, lot_number)

    if data2.get('captcha_type') != 'slide':
        print(f'[ERROR] load2 返回 captcha_type={data2.get("captcha_type")}，协议可能不符')
        return False

    # 关键：load2 返回新的 lot_number 和 challenge，verify2 必须用这些
    lot_number2 = data2.get('lot_number', lot_number)
    challenge2 = data2.get('challenge', challenge)
    pt2 = str(data2.get('pt', pt))
    print(f'  verify2 将使用 lot={lot_number2[:8]}... challenge={challenge2[:12]}...')

    # Step 5: 下载图片
    print('\n--- Step 5: 下载图片 ---')
    bg_bytes = download_image(session, data2.get('bg', ''), 'test_bg.png')
    fullbg_bytes = download_image(session, data2.get('fullbg', ''), 'test_fullbg.png')
    slice_bytes = download_image(session, data2.get('slice', ''), 'test_slice.png')

    if not bg_bytes or not slice_bytes:
        print('[ERROR] 图片下载失败')
        return False

    # Step 6: 云码识别缺口
    print('\n--- Step 6: 云码识别缺口（type=20111）---')
    gap_x = recognize_gap_yunma(bg_bytes, slice_bytes)
    if gap_x is None:
        gap_x = random.randint(100, 200)
        print(f'  [降级] 使用随机距离 {gap_x}')
    else:
        # 关键：图片宽度 300px，Canvas 显示宽度约 282px，缩放比 ≈ 0.94
        # answer = gap_x * 0.94（Geetest 服务端坐标系统）
        gap_x = round(gap_x * 0.94)
        print(f'  缺口位置: {gap_x}px（缩放后）')

    # Step 7: 生成轨迹
    track = generate_track(gap_x)
    print(f'\n--- Step 7: 生成轨迹 ({len(track)} 点, 结束 x={track[-1][0]}) ---')

    # Step 8: 生成 w2（滑块验证）- 使用 load2 返回的 lot_number2 和 challenge2
    # 直接传入距离，generate_w.js 内部生成 3 点轨迹，确保 w=640
    print('\n--- Step 8: 生成 w2（滑块验证）---')
    w2 = generate_w_for_slide(lot_number2, CAPTCHA_ID, challenge2, pt2, gap_x)
    if not w2:
        print('[WARN] generate_w.js 失败，尝试直接用 encrypt_w_helper.js（简化）')
        # 滑块验证 s 对象（简化版）
        slide_s = {
            'geetest': 'captcha',
            'em': {'ph': 0, 'cp': 0, 'ek': '11', 'wd': 1, 'nt': 0, 'si': 0, 'sc': 0},
            'type': 'slide',
            'answer': gap_x,
            'passtime': track[-1][2] if track else 1800,
        }
        try:
            w2 = generate_w_for_verify(slide_s)
        except Exception as e:
            print(f'  [ERROR] {e}')
            w2 = None

    if not w2:
        print('[ERROR] 无法生成 w2')
        return False

    print(f'w2 length: {len(w2)}')

    # Step 9: verify2（滑块验证）- 使用 load2 返回的 lot_number2 和 challenge2
    print('\n--- Step 9: verify2（滑块验证）---')
    v2_result = verify_step2(session, lot_number2, challenge2, pt2, w2)

    status = v2_result.get('status')
    result_data = v2_result.get('data', {})
    result_val = result_data.get('result') if isinstance(result_data, dict) else result_data

    if status == 'success' and result_val == 'success':
        print('\n=== 验证成功! ===')
        return True
    else:
        print(f'\n  验证未通过: status={status} result={result_val}')
        return False


if __name__ == '__main__':
    success = run_full_protocol()
    sys.exit(0 if success else 1)
