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

class AliyunSmartCaptcha:
    def __init__(self, appkey=APPKEY, scene=SCENE):
        self.appkey = appkey
        self.scene = scene
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.nvc_pre_res = None
        self.token = None
        self.node_script = os.path.join(os.path.dirname(__file__), 'generate_token.js')
    
    def _generate_token_id(self):
        return '{}:{}'.format(int(time.time() * 1000), random.random())
    
    def call_nvc_prepare(self):
        self.token = self._generate_token_id()
        payload = {'a': self.appkey, 'd': self.scene, 'c': self.token}
        a_param = json.dumps(payload, separators=(',', ':'))
        callback = 'jsonp_{}'.format(random.randint(10000000000000000, 99999999999999999))
        url = '{}?a={}&callback={}'.format(NVC_PREPARE_URL, quote(a_param), callback)
        resp = self.session.get(url, timeout=15)
        json_start = resp.text.index('(') + 1
        json_end = resp.text.rindex(')')
        data = json.loads(resp.text[json_start:json_end])
        self.nvc_pre_res = data['result']['result']
        return data['result']
    
    def generate_nvc_token(self):
        if not self.nvc_pre_res:
            self.call_nvc_prepare()
        nvc_pre_res_c = self.nvc_pre_res.get('c', '')
        cmd = ['node', self.node_script, nvc_pre_res_c, self.token, self.appkey, self.scene, 'code0', '200']
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, cwd=os.path.dirname(self.node_script))
        if result.returncode != 0:
            raise RuntimeError('Node.js token generation failed: {}'.format(result.stderr or result.stdout))
        output = json.loads(result.stdout)
        return output
    
    def get_nvc_token(self):
        return self.generate_nvc_token()['nvc_token']
    
    def get_nvc_data(self):
        return self.generate_nvc_token()['decoded']
    
    def verify(self, nvc_token=None):
        if nvc_token is None:
            nvc_token = self.get_nvc_token()
        callback = 'jsonp_{}'.format(random.randint(10000000000000000, 99999999999999999))
        url = '{}?a={}&callback={}'.format(NVC_ANALYZE_URL, quote(nvc_token), callback)
        resp = self.session.get(url, timeout=15)
        try:
            json_start = resp.text.index('(') + 1
            json_end = resp.text.rindex(')')
            result = json.loads(resp.text[json_start:json_end])
        except:
            result = {'raw': resp.text[:200]}
        return result

def main():
    print('=' * 60)
    print('Aliyun Smart Captcha - Python Protocol')
    print('=' * 60)
    captcha = AliyunSmartCaptcha()
    print('[1] Calling nvcPrepare...')
    captcha.call_nvc_prepare()
    print('[2] Generating NVC Token...')
    token = captcha.get_nvc_token()
    print('    Token length: {}'.format(len(token)))
    print('[3] Verifying...')
    result = captcha.verify(token)
    print('    Result: {}'.format(json.dumps(result, ensure_ascii=False, indent=2)))
    print('=' * 60)

if __name__ == '__main__':
    main()
