"""
抖音 a_bogus 纯算实现（本地优化版）
基于 GitHub 开源实现优化，添加更多功能和文档

核心算法：
1. SM3 哈希（国密算法）
2. RC4 加密
3. 自定义 Base64 编码
"""

from random import randint, random
from re import compile
from time import time
from urllib.parse import quote
from typing import List, Union
import base64

# 尝试导入 gmssl，如果失败则使用备用实现
try:
    from gmssl import sm3, func
    HAS_GMSSL = True
except ImportError:
    HAS_GMSSL = False
    print("Warning: gmssl not installed, using fallback SM3 implementation")


class SM3Hash:
    """SM3 哈希算法实现（备用）"""
    
    IV = [
        0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600,
        0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e
    ]
    
    T_j = []
    for i in range(16):
        T_j.append(0x79cc4519)
    for i in range(16, 64):
        T_j.append(0x7a879d8a)
    
    @staticmethod
    def rotate_left(x, n):
        return ((x << n) & 0xFFFFFFFF) | (x >> (32 - n))
    
    @staticmethod
    def ff(x, y, z, j):
        if 0 <= j < 16:
            return x ^ y ^ z
        else:
            return (x & y) | (x & z) | (y & z)
    
    @staticmethod
    def gg(x, y, z, j):
        if 0 <= j < 16:
            return x ^ y ^ z
        else:
            return (x & y) | (~x & z)
    
    @staticmethod
    def p0(x):
        return x ^ SM3Hash.rotate_left(x, 9) ^ SM3Hash.rotate_left(x, 17)
    
    @staticmethod
    def p1(x):
        return x ^ SM3Hash.rotate_left(x, 15) ^ SM3Hash.rotate_left(x, 23)
    
    @classmethod
    def hash(cls, message: bytes) -> bytes:
        """计算 SM3 哈希值"""
        # 消息填充
        msg = bytearray(message)
        msg.append(0x80)
        while (len(msg) % 64) != 56:
            msg.append(0)
        msg.extend((len(message) * 8).to_bytes(8, 'big'))
        
        # 初始化
        v = cls.IV[:]
        
        # 分组处理
        for i in range(0, len(msg), 64):
            block = msg[i:i+64]
            w = [0] * 68
            w_ = [0] * 64
            
            # 消息扩展
            for j in range(16):
                w[j] = int.from_bytes(block[j*4:(j+1)*4], 'big')
            for j in range(16, 68):
                w[j] = cls.p1(w[j-16] ^ w[j-9] ^ cls.rotate_left(w[j-3], 15)) ^ \
                       cls.rotate_left(w[j-13], 7) ^ w[j-6]
            for j in range(64):
                w_[j] = w[j] ^ w[j+4]
            
            # 压缩函数
            a, b, c, d, e, f, g, h = v
            for j in range(64):
                ss1 = cls.rotate_left((cls.rotate_left(a, 12) + e + cls.T_j[j]) & 0xFFFFFFFF, 7)
                ss2 = ss1 ^ cls.rotate_left(a, 12)
                tt1 = (cls.ff(a, b, c, j) + d + ss2 + w_[j]) & 0xFFFFFFFF
                tt2 = (cls.gg(e, f, g, j) + h + ss1 + w[j]) & 0xFFFFFFFF
                d = c
                c = cls.rotate_left(b, 9)
                b = a
                a = tt1
                h = g
                g = cls.rotate_left(f, 19)
                f = e
                e = cls.p0(tt2)
            
            v[0] = (v[0] + a) & 0xFFFFFFFF
            v[1] = (v[1] + b) & 0xFFFFFFFF
            v[2] = (v[2] + c) & 0xFFFFFFFF
            v[3] = (v[3] + d) & 0xFFFFFFFF
            v[4] = (v[4] + e) & 0xFFFFFFFF
            v[5] = (v[5] + f) & 0xFFFFFFFF
            v[6] = (v[6] + g) & 0xFFFFFFFF
            v[7] = (v[7] + h) & 0xFFFFFFFF
        
        # 输出
        result = b''
        for i in range(8):
            result += v[i].to_bytes(4, 'big')
        return result


class ABogus:
    """
    抖音 a_bogus 参数生成器
    
    使用方法：
        bogus = ABogus()
        a_bogus = bogus.get_value(url_params, user_agent)
    """
    
    # 配置常量
    __filter = compile(r'%([0-9A-F]{2})')
    __ua_key = "\x00\x01\x0e"
    __end_string = "cus"
    __version = [1, 0, 1, 5]
    
    # 浏览器信息（可根据需要修改）
    __browser = "1536|742|1536|864|0|0|0|0|1536|864|1536|864|1536|742|24|24|MacIntel"
    
    # SM3 初始寄存器值
    __reg = [
        1937774191, 1226093241, 388252375, 3666478592,
        2842636476, 372324522, 3817729613, 2969243214,
    ]
    
    # Base64 字符表
    __str = {
        "s0": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
        "s1": "Dkdpgh4ZKsQB80/Mfvw36XI1R25+WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=",
        "s2": "Dkdpgh4ZKsQB80/Mfvw36XI1R25-WUAlEi7NLboqYTOPuzmFjJnryx9HVGcaStCe=",
        "s3": "ckdp1h4ZKsUB80/Mfvw36XIgR25+WQAlEi7NLboqYTOPuzmFjJnryx9HVGDaStCe",
        "s4": "Dkdpgh2ZmsQB80/MfvV36XI1R45-WUAlEixNLwoqYTOPuzKFjJnry79HbGcaStCe",
    }
    
    def __init__(self, platform: str = None):
        """
        初始化 ABogus 生成器
        
        Args:
            platform: 平台信息，如 'MacIntel'
        """
        self.chunk = []
        self.size = 0
        self.reg = self.__reg[:]
        
        # 默认 UA code（对应 Chrome 90）
        self.ua_code = [
            76, 98, 15, 131, 97, 245, 224, 133, 122, 199,
            241, 166, 79, 34, 90, 191, 128, 126, 122, 98,
            66, 11, 14, 40, 49, 110, 110, 173, 67, 96,
            138, 252
        ]
        
        self.browser = self.generate_browser_info(platform) if platform else self.__browser
        self.browser_len = len(self.browser)
        self.browser_code = self.char_code_at(self.browser)
    
    def generate_browser_info(self, platform: str = None) -> str:
        """生成浏览器信息字符串"""
        if platform == "MacIntel":
            return "1536|742|1536|864|0|0|0|0|1536|864|1536|864|1536|742|24|24|MacIntel"
        elif platform == "Win32":
            return "1536|742|1536|864|0|0|0|0|1536|864|1536|864|1536|742|24|24|Win32"
        return self.__browser
    
    @classmethod
    def list_1(cls, random_num: float = None, a: int = 170, b: int = 85, c: int = 45) -> List[int]:
        """生成随机列表 1"""
        return cls.random_list(random_num, a, b, 1, 2, 5, c & a)
    
    @classmethod
    def list_2(cls, random_num: float = None, a: int = 170, b: int = 85) -> List[int]:
        """生成随机列表 2"""
        return cls.random_list(random_num, a, b, 1, 0, 0, 0)
    
    @classmethod
    def list_3(cls, random_num: float = None, a: int = 170, b: int = 85) -> List[int]:
        """生成随机列表 3"""
        return cls.random_list(random_num, a, b, 1, 0, 5, 0)
    
    @staticmethod
    def random_list(
        a: float = None,
        b: int = 170,
        c: int = 85,
        d: int = 0,
        e: int = 0,
        f: int = 0,
        g: int = 0,
    ) -> List[int]:
        """生成随机列表"""
        r = a or (random() * 10000)
        v = [r, int(r) & 255, int(r) >> 8]
        s = v[1] & b | d
        v.append(s)
        s = v[1] & c | e
        v.append(s)
        s = v[2] & b | f
        v.append(s)
        s = v[2] & c | g
        v.append(s)
        return v[-4:]
    
    @staticmethod
    def from_char_code(*args: int) -> str:
        """将字符码转换为字符串"""
        return "".join(chr(code) for code in args)
    
    @classmethod
    def generate_string_1(
        cls,
        random_num_1: float = None,
        random_num_2: float = None,
        random_num_3: float = None,
    ) -> str:
        """生成字符串 1（随机前缀）"""
        return (
            cls.from_char_code(*cls.list_1(random_num_1)) +
            cls.from_char_code(*cls.list_2(random_num_2)) +
            cls.from_char_code(*cls.list_3(random_num_3))
        )
    
    def generate_string_2(
        self,
        url_params: str,
        method: str = "GET",
        start_time: int = 0,
        end_time: int = 0,
    ) -> str:
        """生成字符串 2（核心签名数据）"""
        a = self.generate_string_2_list(url_params, method, start_time, end_time)
        e = self.end_check_num(a)
        a.extend(self.browser_code)
        a.append(e)
        return self.rc4_encrypt(self.from_char_code(*a), "y")
    
    def generate_string_2_list(
        self,
        url_params: str,
        method: str = "GET",
        start_time: int = 0,
        end_time: int = 0,
    ) -> List[int]:
        """生成字符串 2 的数据列表"""
        start_time = start_time or int(time() * 1000)
        end_time = end_time or (start_time + randint(4, 8))
        
        params_array = self.generate_params_code(url_params)
        method_array = self.generate_method_code(method)
        
        return self.list_4(
            (end_time >> 24) & 255,
            params_array[21],
            self.ua_code[23],
            (end_time >> 16) & 255,
            params_array[22],
            self.ua_code[24],
            (end_time >> 8) & 255,
            (end_time >> 0) & 255,
            (start_time >> 24) & 255,
            (start_time >> 16) & 255,
            (start_time >> 8) & 255,
            (start_time >> 0) & 255,
            method_array[21],
            method_array[22],
            int(end_time / 256 / 256 / 256 / 256) >> 0,
            int(start_time / 256 / 256 / 256 / 256) >> 0,
            self.browser_len,
        )
    
    @staticmethod
    def list_4(
        a: int, b: int, c: int, d: int, e: int, f: int,
        g: int, h: int, i: int, j: int, k: int, m: int,
        n: int, o: int, p: int, q: int, r: int,
    ) -> List[int]:
        """生成固定格式的数据列表"""
        return [
            44, a, 0, 0, 0, 0, 24, b, n, 0, c, d, 0, 0, 0, 1,
            0, 239, e, o, f, g, 0, 0, 0, 0, h, 0, 0, 14, i, j,
            0, k, m, 3, p, 1, q, 1, r, 0, 0, 0
        ]
    
    def generate_params_code(self, params: str) -> List[int]:
        """生成 URL 参数的编码"""
        return self.sum(self.decode_string(params))
    
    def generate_method_code(self, method: str) -> List[int]:
        """生成 HTTP 方法的编码"""
        return self.sum(method)
    
    @staticmethod
    def end_check_num(a: List[int]) -> int:
        """计算校验和"""
        r = 0
        for i in a:
            r ^= i
        return r
    
    @classmethod
    def decode_string(cls, url_string: str) -> str:
        """解码 URL 编码的字符串"""
        return cls.__filter.sub(cls.replace_func, url_string)
    
    @staticmethod
    def replace_func(match) -> str:
        """替换 URL 编码字符"""
        return chr(int(match.group(1), 16))
    
    @staticmethod
    def char_code_at(s: str) -> List[int]:
        """将字符串转换为字符码列表"""
        return [ord(char) for char in s]
    
    # ==================== SM3 哈希相关 ====================
    
    def compress(self, a: List[int]):
        """SM3 压缩函数"""
        f = self.generate_f(a)
        i = self.reg[:]
        
        for o in range(64):
            c = self.de(i[0], 12) + i[4] + self.de(self.pe(o), o)
            c = c & 0xFFFFFFFF
            c = self.de(c, 7)
            s = (c ^ self.de(i[0], 12)) & 0xFFFFFFFF
            
            u = self.he(o, i[0], i[1], i[2])
            u = (u + i[3] + s + f[o + 68]) & 0xFFFFFFFF
            
            b = self.ve(o, i[4], i[5], i[6])
            b = (b + i[7] + c + f[o]) & 0xFFFFFFFF
            
            i[3] = i[2]
            i[2] = self.de(i[1], 9)
            i[1] = i[0]
            i[0] = u
            
            i[7] = i[6]
            i[6] = self.de(i[5], 19)
            i[5] = i[4]
            i[4] = (b ^ self.de(b, 9) ^ self.de(b, 17)) & 0xFFFFFFFF
        
        for l in range(8):
            self.reg[l] = (self.reg[l] ^ i[l]) & 0xFFFFFFFF
    
    @classmethod
    def generate_f(cls, e: List[int]) -> List[int]:
        """生成 SM3 的扩展消息"""
        r = [0] * 132
        
        for t in range(16):
            r[t] = (e[4 * t] << 24) | (e[4 * t + 1] << 16) | (e[4 * t + 2] << 8) | e[4 * t + 3]
            r[t] &= 0xFFFFFFFF
        
        for n in range(16, 68):
            a = r[n - 16] ^ r[n - 9] ^ cls.de(r[n - 3], 15)
            a = a ^ cls.de(a, 15) ^ cls.de(a, 23)
            r[n] = (a ^ cls.de(r[n - 13], 7) ^ r[n - 6]) & 0xFFFFFFFF
        
        for n in range(68, 132):
            r[n] = (r[n - 68] ^ r[n - 64]) & 0xFFFFFFFF
        
        return r
    
    @staticmethod
    def de(e: int, r: int) -> int:
        """循环左移"""
        r %= 32
        return ((e << r) & 0xFFFFFFFF) | (e >> (32 - r))
    
    @staticmethod
    def pe(e: int) -> int:
        """SM3 常量选择"""
        return 2043430169 if 0 <= e < 16 else 2055708042
    
    @staticmethod
    def he(e: int, r: int, t: int, n: int) -> int:
        """SM3 布尔函数 FF"""
        if 0 <= e < 16:
            return (r ^ t ^ n) & 0xFFFFFFFF
        elif 16 <= e < 64:
            return (r & t | r & n | t & n) & 0xFFFFFFFF
        raise ValueError(f"Invalid index: {e}")
    
    @staticmethod
    def ve(e: int, r: int, t: int, n: int) -> int:
        """SM3 布尔函数 GG"""
        if 0 <= e < 16:
            return (r ^ t ^ n) & 0xFFFFFFFF
        elif 16 <= e < 64:
            return (r & t | ~r & n) & 0xFFFFFFFF
        raise ValueError(f"Invalid index: {e}")
    
    @staticmethod
    def pad_array(arr: List[int], length: int = 60) -> List[int]:
        """填充数组"""
        while len(arr) < length:
            arr.append(0)
        return arr
    
    def fill(self, length: int = 60):
        """填充消息"""
        size = 8 * self.size
        self.chunk.append(128)
        self.chunk = self.pad_array(self.chunk, length)
        for i in range(4):
            self.chunk.append((size >> 8 * (3 - i)) & 255)
    
    def write(self, e: Union[str, bytes]):
        """写入数据"""
        if isinstance(e, str):
            e = self.decode_string(e)
            e = self.char_code_at(e)
        elif isinstance(e, bytes):
            e = list(e)
        
        self.size = len(e)
        
        if len(e) <= 64:
            self.chunk = e
        else:
            chunks = [e[i:i+64] for i in range(0, len(e), 64)]
            for chunk in chunks[:-1]:
                self.compress(chunk)
            self.chunk = chunks[-1]
    
    def reset(self):
        """重置状态"""
        self.chunk = []
        self.size = 0
        self.reg = self.__reg[:]
    
    def sum(self, e: Union[str, bytes], length: int = 60) -> List[int]:
        """计算 SM3 哈希"""
        self.reset()
        self.write(e)
        self.fill(length)
        self.compress(self.chunk)
        return self.reg_to_array(self.reg)
    
    @staticmethod
    def reg_to_array(a: List[int]) -> List[int]:
        """将寄存器转换为字节数组"""
        o = [0] * 32
        for i in range(8):
            c = a[i]
            o[4 * i + 3] = 255 & c
            c >>= 8
            o[4 * i + 2] = 255 & c
            c >>= 8
            o[4 * i + 1] = 255 & c
            c >>= 8
            o[4 * i] = 255 & c
        return o
    
    # ==================== RC4 加密 ====================
    
    @staticmethod
    def rc4_encrypt(plaintext: str, key: str) -> str:
        """RC4 加密"""
        # 初始化 S 盒
        s = list(range(256))
        j = 0
        
        for i in range(256):
            j = (j + s[i] + ord(key[i % len(key)])) % 256
            s[i], s[j] = s[j], s[i]
        
        # 生成密钥流并加密
        result = []
        i = j = 0
        for k in range(len(plaintext)):
            i = (i + 1) % 256
            j = (j + s[i]) % 256
            s[i], s[j] = s[j], s[i]
            t = (s[i] + s[j]) % 256
            result.append(chr(s[t] ^ ord(plaintext[k])))
        
        return ''.join(result)
    
    # ==================== 主要接口 ====================
    
    def get_value(self, url_params: str, user_agent: str) -> str:
        """
        生成 a_bogus 值
        
        Args:
            url_params: URL 参数字符串（不含 a_bogus）
            user_agent: User-Agent 字符串
            
        Returns:
            a_bogus 签名字符串
        """
        # 生成随机前缀
        string1 = self.generate_string_1()
        
        # 生成核心签名数据
        string2 = self.generate_string_2(url_params)
        
        # 组合并编码
        result = string1 + string2
        return self.encode(result, self.__str["s2"])
    
    @staticmethod
    def encode(input_str: str, char_map: str) -> str:
        """
        使用自定义字符表进行 Base64 编码
        
        Args:
            input_str: 输入字符串
            char_map: 自定义字符表
            
        Returns:
            编码后的字符串
        """
        # 先进行标准 Base64 编码
        # 注意：这里使用 latin-1 编码是因为 RC4 加密后的字符可能超出 ASCII 范围
        standard_b64 = base64.b64encode(input_str.encode('latin-1', errors='replace')).decode('ascii')
        
        # 转换为自定义字符表
        result = []
        for char in standard_b64:
            if char == '+':
                result.append(char_map[62])
            elif char == '/':
                result.append(char_map[63])
            elif char == '=':
                result.append(char_map[64])
            else:
                idx = ABogus.__str["s0"].index(char)
                result.append(char_map[idx])
        
        return ''.join(result)


# ==================== 便捷函数 ====================

def generate_a_bogus(url_params: str, user_agent: str) -> str:
    """
    便捷函数：生成 a_bogus
    
    Args:
        url_params: URL 参数字符串
        user_agent: User-Agent 字符串
        
    Returns:
        a_bogus 签名字符串
    """
    bogus = ABogus()
    return bogus.get_value(url_params, user_agent)


if __name__ == "__main__":
    # 测试
    print("=" * 80)
    print("抖音 a_bogus 纯算实现测试")
    print("=" * 80)
    
    bogus = ABogus()
    
    test_cases = [
        {
            "url": "source_type=force&request_from=&promotion_ids=3676740194222110808",
            "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        }
    ]
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n测试用例 {i}:")
        print(f"URL: {test['url'][:60]}...")
        result = bogus.get_value(test["url"], test["ua"])
        print(f"a_bogus: {result}")
        print(f"长度: {len(result)}")
    
    print("\n" + "=" * 80)
