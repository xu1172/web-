"""
抖音 a_bogus 本地纯算实现测试脚本
对比本地实现与参考实现的结果
"""

from urllib.parse import quote
from abogus_local import ABogus, generate_a_bogus

# 尝试导入参考实现进行对比
try:
    from abogus_reference import ABogus as ABogusRef
    HAS_REFERENCE = True
except ImportError:
    HAS_REFERENCE = False
    print("参考实现未找到，仅测试本地实现")


def test_basic():
    """基本功能测试"""
    print("=" * 80)
    print("测试 1: 基本功能测试")
    print("=" * 80)
    
    bogus = ABogus()
    
    url_params = "source_type=force&request_from=&promotion_ids=3676740194222110808"
    user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    
    result = bogus.get_value(url_params, user_agent)
    
    print(f"URL 参数: {url_params[:50]}...")
    print(f"User-Agent: {user_agent[:50]}...")
    print(f"生成的 a_bogus: {result}")
    print(f"长度: {len(result)}")
    print(f"URL 编码后: {quote(result, safe='')}")
    
    return result


def test_with_urlencode():
    """测试 URL 编码参数"""
    print("\n" + "=" * 80)
    print("测试 2: URL 编码参数测试")
    print("=" * 80)
    
    bogus = ABogus()
    
    # 模拟真实抖音 URL 参数
    url_params = (
        "device_platform=webapp&aid=6383&channel=channel_pc_web&pc_client_type=1"
        "&version_code=190500&version_name=19.5.0&cookie_enabled=true"
        "&browser_language=zh-CN&browser_platform=Win32&browser_name=Firefox"
        "&browser_online=true&engine_name=Gecko&os_name=Windows&os_version=10"
        "&platform=PC&screen_width=1920&screen_height=1080"
    )
    
    result = bogus.get_value(url_params, "Mozilla/5.0")
    
    print(f"URL 参数长度: {len(url_params)}")
    print(f"生成的 a_bogus: {result[:80]}...")
    print(f"长度: {len(result)}")
    
    return result


def test_comparison():
    """对比本地实现与参考实现"""
    if not HAS_REFERENCE:
        print("\n跳过对比测试（参考实现未找到）")
        return
    
    print("\n" + "=" * 80)
    print("测试 3: 本地实现 vs 参考实现对比")
    print("=" * 80)
    
    bogus_local = ABogus()
    bogus_ref = ABogusRef()
    
    url_params = "test=123&foo=bar"
    
    result_local = bogus_local.get_value(url_params, "Mozilla/5.0")
    result_ref = bogus_ref.get_value(url_params)
    
    print(f"本地实现: {result_local}")
    print(f"参考实现: {result_ref}")
    print(f"长度对比: {len(result_local)} vs {len(result_ref)}")
    
    # 注意：由于随机数不同，结果不会完全相同，但格式应该一致
    print("\n✓ 两者都成功生成了 a_bogus")


def test_multiple_calls():
    """测试多次调用生成不同结果"""
    print("\n" + "=" * 80)
    print("测试 4: 多次调用测试（验证随机性）")
    print("=" * 80)
    
    bogus = ABogus()
    url_params = "test=123"
    
    results = []
    for i in range(3):
        result = bogus.get_value(url_params, "Mozilla/5.0")
        results.append(result)
        print(f"调用 {i+1}: {result[:60]}...")
    
    # 验证结果不同（因为使用了随机数）
    unique_results = set(results)
    if len(unique_results) > 1:
        print(f"\n✓ 随机性正常，{len(unique_results)} 个不同结果")
    else:
        print("\n⚠ 警告：结果相同，随机性可能有问题")


def test_edge_cases():
    """边界情况测试"""
    print("\n" + "=" * 80)
    print("测试 5: 边界情况测试")
    print("=" * 80)
    
    bogus = ABogus()
    
    test_cases = [
        ("空参数", "", "Mozilla/5.0"),
        ("短参数", "a=1", "Mozilla/5.0"),
        ("长参数", "x=" + "a" * 1000, "Mozilla/5.0"),
        ("特殊字符", "key=%20%2F%3D", "Mozilla/5.0"),
    ]
    
    for name, params, ua in test_cases:
        try:
            result = bogus.get_value(params, ua)
            print(f"✓ {name}: 长度={len(result)}")
        except Exception as e:
            print(f"✗ {name}: 错误={e}")


def test_convenience_function():
    """测试便捷函数"""
    print("\n" + "=" * 80)
    print("测试 6: 便捷函数测试")
    print("=" * 80)
    
    result = generate_a_bogus("test=123", "Mozilla/5.0")
    print(f"便捷函数结果: {result[:60]}...")
    print(f"长度: {len(result)}")
    print("✓ 便捷函数正常工作")


def main():
    """主测试函数"""
    print("\n" + "=" * 80)
    print("抖音 a_bogus 本地纯算实现测试套件")
    print("=" * 80)
    
    try:
        test_basic()
        test_with_urlencode()
        test_comparison()
        test_multiple_calls()
        test_edge_cases()
        test_convenience_function()
        
        print("\n" + "=" * 80)
        print("所有测试完成！")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
