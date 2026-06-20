# -*- coding: utf-8 -*-
import requests, json, time, random, subprocess, os
from urllib.parse import quote

APPKEY = 'CF_APP_1'
SCENE = 'nvc_register'
NVC_PREPARE_URL = 'https://cf.aliyun.com/nvc/nvcPrepare.jsonp'
NVC_ANALYZE_URL = 'https://cf.aliyun.com/nvc/nvcAnalyze.jsonp'

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Referer': 'https://promotion.aliyun.com/ntms/act/captchaIntroAndDemo.html',
}

session = requests.Session()
session.headers.update(HEADERS)

# Step 1: nvcPrepare
token_id = '{}:{}'.format(int(time.time() * 1000), random.random())
payload = {'a': APPKEY, 'd': SCENE, 'c': token_id}
a_param = json.dumps(payload, separators=(',', ':'))
callback = 'jsonp_{}'.format(random.randint(10000000000000000, 99999999999999999))
url = '{}?a={}&callback={}'.format(NVC_PREPARE_URL, quote(a_param), callback)
resp = session.get(url, timeout=15)
json_start = resp.text.index('(') + 1
json_end = resp.text.rindex(')')
data = json.loads(resp.text[json_start:json_end])
nvc_pre_res = data['result']['result']
print('[1] nvcPrepare: code={}, preRes.c={}...'.format(data['result']['code'], nvc_pre_res['c'][:40]))

# Step 2: call Node.js to generate Token
NODE_SCRIPT = r'e:\PythonCodeObject1\catpHelp\aliyun_captcha\src\generate_token.js'
cmd = ['node', NODE_SCRIPT, nvc_pre_res['c'], token_id, APPKEY, SCENE, 'code0', '200']
print('[2] Calling Node.js...')
result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, cwd=os.path.dirname(NODE_SCRIPT))
output = json.loads(result.stdout)
nvc_token = output['nvc_token']
print('     Token length: {}'.format(len(nvc_token)))
print('     UAB (b): {}...'.format(output['decoded']['b'][:50]))
print('     UMID: {}...'.format(output['decoded']['h']['umidToken'][:40]))

# Step 3: analyze request
callback = 'jsonp_{}'.format(random.randint(10000000000000000, 99999999999999999))
url = '{}?a={}&callback={}'.format(NVC_ANALYZE_URL, quote(nvc_token), callback)
resp = session.get(url, timeout=15)
try:
    json_start = resp.text.index('(') + 1
    json_end = resp.text.rindex(')')
    result = json.loads(resp.text[json_start:json_end])
except:
    result = {'raw': resp.text[:200]}
print('[3] Analyze result: {}'.format(json.dumps(result, ensure_ascii=False)))
