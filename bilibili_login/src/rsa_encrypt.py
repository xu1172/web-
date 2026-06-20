"""
B站登录 - RSA密码加密模块

加密方式: RSA PKCS#1 v1.5
流程:
1. GET /x/passport-login/web/key 获取 hash(盐) 和 key(PEM公钥)
2. password = base64(RSA(hash + raw_password))
"""

import base64

from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5


def encrypt_password(raw_password: str, rsa_key_pem: str, hash_salt: str) -> str:
    """
    RSA加密B站登录密码

    Args:
        raw_password: 明文密码
        rsa_key_pem: PEM格式RSA公钥 (从web/key接口获取)
        hash_salt: 密码盐值 (从web/key接口获取, 16字符)

    Returns:
        base64编码的密文字符串
    """
    # 拼接: hash + 明文密码
    plaintext = hash_salt + raw_password

    # 导入PEM公钥
    public_key = RSA.import_key(rsa_key_pem)

    # PKCS1_v1_5 加密
    cipher = PKCS1_v1_5.new(public_key)
    encrypted = cipher.encrypt(plaintext.encode('utf-8'))

    # base64编码
    return base64.b64encode(encrypted).decode('utf-8')


if __name__ == '__main__':
    # 测试RSA加密
    test_pem = """-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDjb4V7EidX/ym28t2ybo0U6t0n
6p4ej8VjqKHg100va6jkNbNTrLQqMCQCAYtXMXXp2Fwkk6WR+12N9zknLjf+C9sx
/+l48mjUU8RqahiFD1XT/u2e0m2EN029OhCgkHx3Fc/KlFSIbak93EH/XlYis0w+
Xl69GV6klzgxW6d2xQIDAQAB
-----END PUBLIC KEY-----"""
    test_hash = "1a1c065a4320b766"
    test_pwd = "testpassword123"

    encrypted = encrypt_password(test_pwd, test_pem, test_hash)
    print(f"明文密码: {test_pwd}")
    print(f"盐值: {test_hash}")
    print(f"加密结果: {encrypted}")
    print(f"结果长度: {len(encrypted)}")
    print(f"RSA加密模块验证通过!")
