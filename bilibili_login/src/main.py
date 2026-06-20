"""
B站密码登录 - 纯协议实现

完整流程:
1. GET captcha      → 获取极验参数(gt, challenge, token)
2. GET web/key      → 获取RSA公钥和盐值
3. 极验验证码流程   → 获取validate/seccode
   a. gettype.php
   b. get.php(fullpage)
   c. get.php(type=click) → 获取点选图片
   d. 云码识别坐标
   e. ajax.php(提交w) → validate
4. POST web/login   → 登录提交

作者: Qoder逆向助手
"""

import json
import logging
import os
import sys
import time
from typing import Optional

import requests

# 添加项目路径
sys.path.insert(0, os.path.dirname(__file__))

from rsa_encrypt import encrypt_password
from captcha_solver import BiliClickCaptchaSolver
from geetest_handler import GeetestHandler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("bili_login")

# ============ 配置 ============
YUNMA_TOKEN = "tR5pqscPQ0EI8n7thn38hAIyyakstNb6-DFUuT9pGwI"

# 测试账号(随机)
TEST_USERNAME = "testuser_bl_2026"
TEST_PASSWORD = "testPwd@2026!Abc"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "Referer": "https://www.bilibili.com/",
    "Origin": "https://www.bilibili.com",
    "Accept": "*/*",
    "Content-Type": "application/x-www-form-urlencoded",
}


class BilibiliLogin:
    """B站密码登录 - 纯协议实现"""

    PASSPORT_BASE = "https://passport.bilibili.com"

    def __init__(self, yunma_token: str = YUNMA_TOKEN):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        self.captcha_solver = BiliClickCaptchaSolver(yunma_token)

        # 极验参数
        self.gt = ""
        self.challenge = ""
        self.token = ""

        # RSA参数
        self.rsa_key = ""
        self.hash_salt = ""

    def step1_get_captcha(self) -> bool:
        """
        Step 1: 获取验证码参数
        GET /x/passport-login/captcha
        """
        url = f"{self.PASSPORT_BASE}/x/passport-login/captcha"
        params = {
            "source": "main-fe-header",
            "t": str(time.time()),
        }

        try:
            resp = self.session.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()

            if data.get("code") != 0:
                logger.error(f"[Step1] captcha接口错误: {data}")
                return False

            captcha_data = data["data"]
            captcha_type = captcha_data.get("type", "")
            self.token = captcha_data.get("token", "")

            logger.info(f"[Step1] 验证码类型: {captcha_type}, token: {self.token[:8]}...")

            if captcha_type == "geetest":
                geetest = captcha_data.get("geetest", {})
                self.gt = geetest.get("gt", "")
                self.challenge = geetest.get("challenge", "")
                logger.info(f"[Step1] gt={self.gt[:8]}..., challenge={self.challenge[:8]}...")
                return True
            else:
                logger.error(f"[Step1] 未知验证码类型: {captcha_type}")
                return False

        except Exception as e:
            logger.error(f"[Step1] 获取验证码参数失败: {e}")
            return False

    def step2_get_rsa_key(self) -> bool:
        """
        Step 2: 获取RSA公钥和盐值
        GET /x/passport-login/web/key
        """
        url = f"{self.PASSPORT_BASE}/x/passport-login/web/key"
        params = {"_": str(int(time.time() * 1000))}

        try:
            resp = self.session.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()

            if data.get("code") != 0:
                logger.error(f"[Step2] key接口错误: {data}")
                return False

            key_data = data["data"]
            self.hash_salt = key_data.get("hash", "")
            self.rsa_key = key_data.get("key", "")

            logger.info(f"[Step2] RSA公钥获取成功, hash={self.hash_salt}")
            return True

        except Exception as e:
            logger.error(f"[Step2] 获取RSA公钥失败: {e}")
            return False

    def step3_geetest_validate(self) -> Optional[tuple]:
        """
        Step 3: 完成极验验证码
        返回 (validate, seccode) 或 None
        """
        handler = GeetestHandler(self.gt, self.challenge)

        # 3a. gettype
        if not handler.step1_gettype():
            logger.warning("[Step3a] gettype失败,继续执行")

        # 3b. fullpage get
        if not handler.step2_get_fullpage():
            logger.warning("[Step3b] fullpage get失败,继续执行")

        # 3c. 获取点选验证码图片
        success, image_url = handler.step3_get_click_captcha()
        if not success:
            logger.error("[Step3c] 获取点选验证码失败")
            return None

        # 3d. 下载验证码图片
        image_bytes = handler.get_captcha_image(image_url)
        if not image_bytes:
            logger.error("[Step3d] 下载验证码图片失败")
            return None

        # 保存调试图片
        debug_path = os.path.join(os.path.dirname(__file__), "..", "assets", "captcha_debug.jpg")
        with open(debug_path, "wb") as f:
            f.write(image_bytes)
        logger.info(f"[Step3d] 验证码图片已保存: {debug_path} ({len(image_bytes)} bytes)")

        # 3e. 云码识别坐标
        ok, coords, msg = self.captcha_solver.solve(image_bytes)
        if not ok:
            logger.error(f"[Step3e] 云码识别失败: {msg}")
            return None

        logger.info(f"[Step3e] 云码识别成功: {coords}, {msg}")

        # 3f. 构建w参数并提交验证
        w_param = handler.build_click_w_param(coords)
        success, validate, msg = handler.step4_validate_click(coords, w=w_param)

        if not success:
            logger.error(f"[Step3f] 极验验证失败: {msg}")
            return None

        seccode = f"{validate}|jordan"
        logger.info(f"[Step3f] 极验验证通过: validate={validate[:8]}...")
        return validate, seccode

    def step4_login(self, username: str, password: str, validate: str, seccode: str) -> dict:
        """
        Step 4: 提交登录
        POST /x/passport-login/web/login
        """
        # RSA加密密码
        encrypted_pwd = encrypt_password(password, self.rsa_key, self.hash_salt)
        logger.info(f"[Step4] 密码加密完成, 密文长度: {len(encrypted_pwd)}")

        url = f"{self.PASSPORT_BASE}/x/passport-login/web/login"
        data = {
            "source": "main-fe-header",
            "username": username,
            "password": encrypted_pwd,
            "keep": "0",
            "token": self.token,
            "challenge": self.challenge,
            "validate": validate,
            "seccode": seccode,
            "go_url": "https://www.bilibili.com",
        }

        try:
            resp = self.session.post(url, data=data, timeout=15)
            resp.raise_for_status()
            result = resp.json()

            logger.info(f"[Step4] 登录响应: code={result.get('code')}, message={result.get('message')}")

            if result.get("code") == 0:
                login_data = result.get("data", {})
                logger.info(f"[Step4] 登录成功!")
                logger.info(f"  timestamp: {login_data.get('timestamp')}")
                logger.info(f"  url: {login_data.get('url', '')[:80]}...")

                # 提取cookie
                cookies = self.session.cookies.get_dict()
                important = {k: v[:10] + "..." for k, v in cookies.items()
                             if k in ("SESSDATA", "bili_jct", "DedeUserID")}
                logger.info(f"  关键cookie: {important}")

            return result

        except Exception as e:
            logger.error(f"[Step4] 登录请求失败: {e}")
            return {"code": -1, "message": str(e)}

    def login(self, username: str, password: str) -> dict:
        """
        执行完整登录流程

        Args:
            username: 登录账号(手机号或邮箱)
            password: 明文密码

        Returns:
            登录接口响应dict
        """
        logger.info("=" * 60)
        logger.info("B站密码登录 - 纯协议实现")
        logger.info(f"账号: {username}")
        logger.info("=" * 60)

        # Step 1: 获取验证码参数
        if not self.step1_get_captcha():
            return {"code": -1, "message": "获取验证码参数失败"}

        # Step 2: 获取RSA公钥
        if not self.step2_get_rsa_key():
            return {"code": -1, "message": "获取RSA公钥失败"}

        # Step 3: 极验验证码
        result = self.step3_geetest_validate()
        if not result:
            return {"code": -1, "message": "极验验证码未通过"}
        validate, seccode = result

        # Step 4: 登录提交
        return self.step4_login(username, password, validate, seccode)


def main():
    print("=" * 60)
    print("B站密码登录 - 纯协议实现")
    print("=" * 60)

    # 使用命令行参数或默认测试账号
    username = sys.argv[1] if len(sys.argv) > 1 else TEST_USERNAME
    password = sys.argv[2] if len(sys.argv) > 2 else TEST_PASSWORD

    print(f"账号: {username}")
    print(f"云码Token: {YUNMA_TOKEN[:10]}...")
    print()

    login = BilibiliLogin(yunma_token=YUNMA_TOKEN)
    result = login.login(username, password)

    print()
    print("=" * 60)
    print(f"最终结果: code={result.get('code')}, message={result.get('message')}")
    if result.get("data"):
        print(f"data: {json.dumps(result['data'], ensure_ascii=False, indent=2)[:200]}")
    print("=" * 60)


if __name__ == "__main__":
    main()
