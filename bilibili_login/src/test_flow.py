"""测试不带w参数的极验API流程"""
import requests, time, json, re

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com/',
})

# Step 1: 获取captcha参数
resp = session.get('https://passport.bilibili.com/x/passport-login/captcha',
                   params={'source': 'main-fe-header', 't': str(time.time())})
data = resp.json()
print('captcha code:', data['code'])
gt = data['data']['geetest']['gt']
challenge = data['data']['geetest']['challenge']
token = data['data']['token']
print(f'gt={gt}')
print(f'challenge={challenge}')

# Step 2: gettype
cb = f'geetest_{int(time.time()*1000)}'
resp = session.get('https://api.geetest.com/gettype.php',
                   params={'gt': gt, 'callback': cb})
print(f'gettype status: {resp.status_code}')

# Step 3: get.php (不带w参数)
cb = f'geetest_{int(time.time()*1000)}'
resp = session.get('https://api.geetest.com/get.php', params={
    'gt': gt, 'challenge': challenge, 'lang': 'zh-cn',
    'pt': 0, 'client_type': 'web', 'callback': cb
})
text = resp.text
jm = re.search(r'\((.+)\)', text, re.DOTALL)
c, s = [], ''
if jm:
    d = json.loads(jm.group(1))
    print(f'get.php status: {d.get("status")}')
    inner = d.get('data', {})
    c = inner.get('c', [])
    s = inner.get('s', '')
    print(f'c={c}, s={s}')

# Step 4: get click captcha (不带w)
cb = f'geetest_{int(time.time()*1000)}'
resp = session.get('https://api.geetest.com/get.php', params={
    'is_next': 'true', 'type': 'click', 'gt': gt, 'challenge': challenge,
    'lang': 'zh-cn', 'https': 'false', 'protocol': 'https://',
    'offline': 'false', 'product': 'embed', 'api_server': 'api.geetest.com',
    'isPC': 'true', 'autoReset': 'true', 'width': '100%', 'callback': cb
})
text = resp.text
jm = re.search(r'\((.+)\)', text, re.DOTALL)
if jm:
    d = json.loads(jm.group(1))
    print(f'click status: {d.get("status")}')
    inner = d.get('data', {})
    pic = inner.get('pic', '')
    c = inner.get('c', c)
    s = inner.get('s', s)
    pic_type = inner.get('pic_type', '')
    print(f'pic_type={pic_type}')
    print(f'pic={pic}')
    print(f'c={c}, s={s}')
    
    # 下载图片
    if pic:
        img_url = f'https://static.geetest.com{pic}'
        resp = session.get(img_url)
        print(f'image download: {resp.status_code}, size={len(resp.content)} bytes')
        if resp.status_code == 200:
            import os
            save_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'captcha_test.jpg')
            with open(save_path, 'wb') as f:
                f.write(resp.content)
            print(f'captcha saved to {save_path}')
        else:
            print(f'image download failed: {resp.text[:200]}')
else:
    print(f'click response parse failed: {text[:200]}')
