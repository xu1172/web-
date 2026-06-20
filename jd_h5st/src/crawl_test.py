"""
End-to-end test: use Node.js generated h5st to crawl JD search results (2 pages)
"""
import subprocess
import json
import urllib.request
import urllib.parse
import time
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

def generate_h5st():
    """Generate a fresh h5st via Node.js signer"""
    result = subprocess.run(
        ['node', '-e', '''
const {JdH5stSigner} = require("./jd_h5st_signer.js");
(async()=>{
  const s = await JdH5stSigner.create({debug:false});
  const {h5st} = await s.sign({
    appid:"search-pc-java",
    functionId:"pc_search_searchWare",
    body:{enc:"utf-8",pvid:"crawl_test",from:"home",area:"14_1167_1170_19060",page:1,s:1}
  });
  console.log(h5st);
})().catch(e=>{console.error(e.message);process.exit(1);});
'''],
        capture_output=True, text=True, timeout=30,
        cwd='e:/PythonCodeProject/sites/jd_h5st/src'
    )
    if result.returncode != 0:
        raise RuntimeError(f"h5st generation failed: {result.stderr}")
    return result.stdout.strip()

def search_jd(h5st, keyword="华为", page=1):
    """Search JD with h5st"""
    body = {
        'enc': 'utf-8',
        'pvid': 'crawl_test',
        'from': 'home',
        'area': '14_1167_1170_19060',
        'page': page,
        'mode': '',
        'concise': False,
        'hoverPictures': False,
        'newAdvRepeat': False,
        'mixerParam': False,
        'new_interval': True,
        's': (page - 1) * 22 + 1,
    }
    body_str = json.dumps(body, separators=(',', ':'))
    ts = str(int(time.time() * 1000))

    params = {
        'appid': 'search-pc-java',
        'functionId': 'pc_search_searchWare',
        'client': 'pc',
        'clientVersion': '1.0.0',
        'cthr': '1',
        'uuid': ts,
        'loginType': '3',
        'keyword': keyword,
        'body': body_str,
        'h5st': h5st,
        't': ts,
    }
    url = 'https://api.m.jd.com/api?' + urllib.parse.urlencode(params)

    req = urllib.request.Request(url, method='GET')
    req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36')
    req.add_header('Accept', 'application/json')
    req.add_header('Referer', 'https://www.jd.com/')
    req.add_header('Origin', 'https://www.jd.com')
    req.add_header('sec-ch-ua', '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"')
    req.add_header('sec-ch-ua-mobile', '?0')
    req.add_header('sec-ch-ua-platform', '"Windows"')
    req.add_header('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8')
    # Browser cookies for session/auth — required to get real search results
    COOKIES = '__jdv=76161171|www.google.com|-|referral|-|1781329304475; __jdu=17813293044751887259468; areaId=14; PCSYCityID=CN_340000_341200_0; shshshfpa=59da4516-a867-f295-79b6-10e2a4a217d6-1781329306; shshshfpx=59da4516-a867-f295-79b6-10e2a4a217d6-1781329306; shshshfpb=BApXWpxRSw_tALOsGWiAcIct_eZUfZKYMBsNzlClo9xJ1PdZfQq3cuCvplh3UObF4VEzV-qvnsawxf7w36q4I5o8vNlDr_h6ZrmY; pin=jd_KjJQbzVNjWkG; pinId=p-KzRHazDQjinBCgvR5a5w; unick=jj7h0kz0l79uzu; __jda=181111935.17813293044751887259468.1781329304.1781329304.1781343619.2; __jdb=181111935.3.17813293044751887259468|2.1781343619; __jdc=181111935; ipLoc-djd=14-1167-1170-19060; 3AB9D23F7A4B3CSS=jdd034WNRHOU475F4MBECWRQN23HHWRCRGDAV2NKUJH4VD3EUTIY5EHT62N5C4MEENKU377SHAU6FN2TL4KROF32LVKQQ6YAAAAM6YBNIFUIAAAAACA4F2TWCANMD6MX; TrackID=1csZIH3Ien3b3qU9dSlWi7hww-YsrL6TpOsN-zf4Ib7s-J9vC8RbqgciNTM-44eQRagUwM2v30wkP__e7T1bZ6rEmyHS6PJBrQHRQx5PG20I; thor=65BCC8DFBCE62402AF37210ED04E5A896AA0A423BA77877599DBD8ED1A5262C4B9BA320E14F186F8DE9ADA6FF665E145305D93163E5BDDE2784F5AF0644766C13C5557B4D111195B1E46BBFE26C2C8541E948B675EC4855ED786E4746044F252ADE174404BC2DE9B07BD11C291DA358516CBC90A1F105BCCB3F1E06191BEF2BBE727212052AF9238CFC20834D7F9DA6F01862E113A3ADAEBEFFD3469A4A25026; token=a1c894446438340f0f8fa976044d55ed,3,989635; sdtoken=AAbEsBpEIOVjqTAKCQtvQu17wkjWzTqPXVQglhoDex0_OKdRUNWVtCIGk1-hu0_kTqb7tiLTG3tBmAafupYeinXUO3OQzjp8Lse5d-VcW1lj2jKoHw1M2lER_Kh3f1XPX77RpXRdAPSODhQ1LtVo8152uv_x7j_aznZjHlNsHynyLrmz_GRTFaalMO925nRH4uuWunLCm-9-4ZE; _gia_d=1; cid=9; cn=1'
    req.add_header('Cookie', COOKIES)
    # x-api-eid-token as standalone header (extracted from cookie 3AB9D23F7A4B3CSS)
    req.add_header('x-api-eid-token', 'jdd034WNRHOU475F4MBECWRQN23HHWRCRGDAV2NKUJH4VD3EUTIY5EHT62N5C4MEENKU377SHAU6FN2TL4KROF32LVKQQ6YAAAAM6YBNIFUIAAAAACA4F2TWCANMD6MX')

    resp = urllib.request.urlopen(req, timeout=15)
    return json.loads(resp.read().decode('utf-8'))

def extract_products(data):
    """Extract product list from search response"""
    products = []
    try:
        # JD search response structure varies
        if isinstance(data, dict):
            # Try common paths
            for key in ['wareInfo', 'goods', 'products', 'data']:
                items = data.get(key, [])
                if isinstance(items, list) and len(items) > 0:
                    for item in items:
                        name = item.get('wname') or item.get('warename') or item.get('name') or item.get('title') or 'N/A'
                        price = item.get('jdPrice') or item.get('price') or 'N/A'
                        product_id = item.get('wareid') or item.get('wareId') or item.get('skuId') or 'N/A'
                        products.append({'name': str(name)[:60], 'price': str(price), 'id': str(product_id)})
                    if products:
                        break
            # Deep search in nested structures
            if not products:
                for key, val in data.items():
                    if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
                        for item in val[:5]:
                            name = str(item.get('wname', item.get('warename', item.get('name', 'N/A'))))[:60]
                            price = str(item.get('jdPrice', item.get('price', 'N/A')))
                            products.append({'name': name, 'price': price, 'id': str(item.get('wareid', 'N/A'))})
                        if products:
                            break
    except Exception as e:
        print(f"  Parse error: {e}")
    return products

# ============ Main ============
print("=" * 60)
print("JD Search Crawl Test — 华为, 2 pages")
print("=" * 60)

# Step 1: Generate h5st
print("\n[1] Generating h5st...")
try:
    h5st = generate_h5st()
    print(f"    h5st: {h5st[:80]}...")
except Exception as e:
    print(f"    FAILED: {e}")
    exit(1)

# Step 2: Crawl page 1
print("\n[2] Searching page 1...")
try:
    data_p1 = search_jd(h5st, "华为", page=1)
    code = data_p1.get('code', 'N/A')
    echo = data_p1.get('echo', '')[:80]
    print(f"    Status code: {code}")
    print(f"    Echo: {echo}")

    products = extract_products(data_p1)
    if products:
        print(f"    Found {len(products)} products:")
        for i, p in enumerate(products[:5]):
            print(f"      {i+1}. [{p['id']}] {p['name']} — ¥{p['price']}")
        if len(products) > 5:
            print(f"      ... and {len(products) - 5} more")
    else:
        print(f"    No products parsed. Raw keys: {list(data_p1.keys())[:10]}")
        # Show a bit of raw data for debugging
        raw = json.dumps(data_p1, ensure_ascii=False)
        print(f"    Raw (first 500 chars): {raw[:500]}")
except Exception as e:
    print(f"    FAILED: {e}")
    if hasattr(e, 'read'):
        try:
            body = e.read().decode('utf-8', errors='ignore')
            print(f"    Error body: {body[:300]}")
        except:
            pass

# Step 3: Crawl page 2
print("\n[3] Searching page 2...")
try:
    data_p2 = search_jd(h5st, "华为", page=2)
    code = data_p2.get('code', 'N/A')
    echo = data_p2.get('echo', '')[:80]
    print(f"    Status code: {code}")
    print(f"    Echo: {echo}")

    products = extract_products(data_p2)
    if products:
        print(f"    Found {len(products)} products:")
        for i, p in enumerate(products[:5]):
            print(f"      {i+1}. [{p['id']}] {p['name']} — ¥{p['price']}")
    else:
        print(f"    No products parsed. Raw keys: {list(data_p2.keys())[:10]}")
except Exception as e:
    print(f"    FAILED: {e}")
    if hasattr(e, 'read'):
        try:
            body = e.read().decode('utf-8', errors='ignore')
            print(f"    Error body: {body[:300]}")
        except:
            pass

print("\n" + "=" * 60)
print("Done")
