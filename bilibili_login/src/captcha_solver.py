"""
B站极验点选验证码 - 云码识别模块

用于识别B站登录时的极验3代文字点选验证码。
云码API文档: http://api.jfbym.com/api/YmServer/customApi
验证码类型: type=30103, extra=click (文字点选)
"""

import base64
import json
import logging
import time
from typing import Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

# 云码 API 错误码
API_ERROR_CODES = {
    10000: "SUCCESS",
    10001: "PARAM_ERROR",
    10002: "INSUFFICIENT_BALANCE",
    10003: "NO_ACCESS_PERMISSION",
    10004: "INVALID_CAPTCHA_TYPE",
    10005: "NETWORK_CONGESTION",
    10006: "DATA_OVERLOAD",
    10007: "SERVICE_BUSY",
    10008: "NETWORK_ERROR",
    10009: "RESULT_PREPARING",
    10010: "REQUEST_ENDED",
}

# 可重试错误码
RETRYABLE_CODES = {10005, 10006, 10007, 10008, 10009}


class BiliClickCaptchaSolver:
    """
    B站极验点选验证码云码识别客户端

    使用流程:
    1. 下载极验验证码图片 (static.geetest.com)
    2. 调用 solve() 发送到云码API识别
    3. 返回按序点击坐标列表
    """

    API_URL = "http://api.jfbym.com/api/YmServer/customApi"
    CAPTCHA_TYPE = "30103"   # 文字点选验证码
    EXTRA = "click"          # 点选类型固定值

    DEFAULT_MAX_RETRIES = 3
    DEFAULT_TIMEOUT = 30

    def __init__(self, token: str, max_retries: int = None, timeout: int = None):
        self.token = token
        self.max_retries = max_retries or self.DEFAULT_MAX_RETRIES
        self.timeout = timeout or self.DEFAULT_TIMEOUT
        self._session = requests.Session()

    def solve(
        self,
        image_bytes: bytes,
        prompt: str = "",
    ) -> Tuple[bool, Optional[List[Dict[str, int]]], str]:
        """
        识别极验文字点选验证码

        Args:
            image_bytes: 验证码图片的原始字节 (JPEG/PNG)
            prompt: 验证码提示文字 (如"请依次点击: 你好世界")

        Returns:
            (success, coordinates, message)
            - success: 是否识别成功
            - coordinates: 按序点击坐标列表 [{"x": 123, "y": 45}, ...]
            - message: 状态说明
        """
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        payload = {
            "image": image_b64,
            "extra": self.EXTRA,
            "token": self.token,
            "type": self.CAPTCHA_TYPE,
        }

        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                resp = self._session.post(
                    self.API_URL,
                    json=payload,
                    timeout=self.timeout,
                )
                resp.raise_for_status()
                result = resp.json()
                return self._parse_result(result)

            except requests.RequestException as e:
                last_error = e
                if attempt < self.max_retries:
                    wait = 1.0 * (2 ** attempt)
                    logger.warning(f"云码请求失败 (attempt {attempt+1}/{self.max_retries}), {wait:.1f}s后重试: {e}")
                    time.sleep(wait)
                else:
                    logger.error(f"云码请求最终失败: {e}")

            except Exception as e:
                last_error = e
                logger.error(f"云码识别异常: {e}")
                break

        return False, None, f"云码请求失败: {last_error}"

    def _parse_result(self, result: dict) -> Tuple[bool, Optional[List[Dict[str, int]]], str]:
        """解析云码API返回结果"""
        code = result.get("code", -1)
        msg = result.get("msg", "")

        if code != 10000:
            err_name = API_ERROR_CODES.get(code, f"UNKNOWN_{code}")
            return False, None, f"云码错误 [{err_name}]: {msg}"

        data_obj = result.get("data", {})
        if isinstance(data_obj, dict):
            # 单条结果
            inner_code = data_obj.get("code", -1)
            inner_data = data_obj.get("data", "")
            api_time = data_obj.get("time", "N/A")

            if not inner_data:
                return False, None, f"云码返回空数据: code={inner_code}"

            coords = self._parse_coordinates(str(inner_data))
            if coords is None:
                return False, None, f"坐标解析失败: {inner_data}"

            logger.info(f"云码识别成功: {len(coords)}个坐标, 耗时={api_time}ms")
            return True, coords, f"识别成功({len(coords)}个点), 耗时={api_time}ms"

        if isinstance(data_obj, list):
            # 多条结果
            all_coords = []
            for item in data_obj:
                inner_data = item.get("data", "")
                coords = self._parse_coordinates(str(inner_data))
                if coords:
                    all_coords.extend(coords)

            if all_coords:
                return True, all_coords, f"识别成功({len(all_coords)}个点)"
            return False, None, "云码返回数据解析为空"

        return False, None, f"未知返回格式: {type(data_obj)}"

    def _parse_coordinates(self, raw_data: str) -> Optional[List[Dict[str, int]]]:
        """
        解析云码返回的坐标字符串

        云码返回格式举例:
        - "123,45"           -> [{"x": 123, "y": 45}]
        - "123,45|234,56"    -> [{"x": 123, "y": 45}, {"x": 234, "y": 56}]
        - "123,45,234,56"    -> [{"x": 123, "y": 45}, {"x": 234, "y": 56}]  (x,y,x,y交替)
        """
        if not raw_data:
            return None

        try:
            # 尝试 JSON 格式: [{"x":1,"y":2},...]
            if raw_data.startswith("["):
                parsed = json.loads(raw_data)
                if isinstance(parsed, list):
                    coords = []
                    for item in parsed:
                        if isinstance(item, dict) and "x" in item and "y" in item:
                            coords.append({"x": int(item["x"]), "y": int(item["y"])})
                        elif isinstance(item, (list, tuple)) and len(item) >= 2:
                            coords.append({"x": int(item[0]), "y": int(item[1])})
                    return coords if coords else None
        except (json.JSONDecodeError, ValueError):
            pass

        try:
            # 尝试 "|" 分隔的 x,y 对: "123,45|234,56"
            if "|" in raw_data:
                coords = []
                for pair in raw_data.split("|"):
                    parts = pair.strip().split(",")
                    if len(parts) >= 2:
                        coords.append({"x": int(parts[0]), "y": int(parts[1])})
                return coords if coords else None

            # 尝试纯逗号分隔的 x,y 交替: "123,45,234,56"
            parts = raw_data.split(",")
            nums = [int(p.strip()) for p in parts]
            if len(nums) >= 2 and len(nums) % 2 == 0:
                coords = []
                for i in range(0, len(nums), 2):
                    coords.append({"x": nums[i], "y": nums[i+1]})
                return coords

            # 只有一对坐标: "123,45"
            if len(parts) == 2:
                return [{"x": int(parts[0].strip()), "y": int(parts[1].strip())}]

        except (ValueError, IndexError):
            pass

        logger.warning(f"无法解析坐标数据: {raw_data}")
        return None

    def solve_from_url(
        self,
        image_url: str,
        cookies: dict = None,
        headers: dict = None,
    ) -> Tuple[bool, Optional[List[Dict[str, int]]], str]:
        """
        从URL下载验证码图片并识别

        Args:
            image_url: 极验验证码图片URL
            cookies: 请求cookie
            headers: 请求头

        Returns:
            同 solve()
        """
        try:
            default_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.bilibili.com/",
            }
            if headers:
                default_headers.update(headers)

            resp = requests.get(image_url, headers=default_headers, cookies=cookies, timeout=15)
            resp.raise_for_status()

            return self.solve(resp.content)

        except Exception as e:
            return False, None, f"下载验证码图片失败: {e}"


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    # 测试
    token = "tR5pqscPQ0EI8n7thn38hAIyyakstNb6-DFUuT9pGwI"
    solver = BiliClickCaptchaSolver(token)

    print("=" * 60)
    print("B站极验点选验证码 - 云码识别模块测试")
    print("=" * 60)
    print(f"API URL: {solver.API_URL}")
    print(f"Type: {solver.CAPTCHA_TYPE}, Extra: {solver.EXTRA}")
    print(f"Token: {token[:10]}...")

    # 坐标解析测试
    test_cases = [
        ("123,45", [{"x": 123, "y": 45}]),
        ("123,45|234,56|345,67", [{"x": 123, "y": 45}, {"x": 234, "y": 56}, {"x": 345, "y": 67}]),
        ("100,200,300,400", [{"x": 100, "y": 200}, {"x": 300, "y": 400}]),
        ('[{"x":1,"y":2}]', [{"x": 1, "y": 2}]),
    ]

    print("\n坐标解析测试:")
    for raw, expected in test_cases:
        result = solver._parse_coordinates(raw)
        status = "PASS" if result == expected else "FAIL"
        print(f"  [{status}] 输入: {raw}")
        print(f"        期望: {expected}")
        print(f"        实际: {result}")

    print("\n模块就绪，等待集成到B站登录流程")
