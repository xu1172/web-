/**
 * Full E2E: generate h5st + call JD API (all in Node.js)
 */
const { JdH5stSigner } = require('./jd_h5st_signer');
const https = require('https');
const crypto = require('crypto');

const COOKIES = '__jdv=76161171|www.google.com|-|referral|-|1781329304475; __jdu=17813293044751887259468; areaId=14; PCSYCityID=CN_340000_341200_0; shshshfpa=59da4516-a867-f295-79b6-10e2a4a217d6-1781329306; shshshfpx=59da4516-a867-f295-79b6-10e2a4a217d6-1781329306; shshshfpb=BApXW2i59w_tALOsGWiAcIct_eZUfZKYMBsNzlClo9xJ1PdZfQq3cuCvplh3UObF4VEzV-qvnsawxf7w36q4I5o8vNlDr_kwcmnY; pin=jd_KjJQbzVNjWkG; pinId=p-KzRHazDQjinBCgvR5a5w; unick=jj7h0kz0l79uzu; __jda=143920055.17813293044751887259468.1781329304.1781329304.1781343619.2; __jdb=143920055.6.17813293044751887259468|2.1781343619; __jdc=143920055; ipLoc-djd=14-1167-1170-19060; 3AB9D23F7A4B3CSS=jdd034WNRHOU475F4MBECWRQN23HHWRCRGDAV2NKUJH4VD3EUTIY5EHT62N5C4MEENKU377SHAU6FN2TL4KROF32LVKQQ6YAAAAM6YB23OUAAAAAADKTIW2CVRNKRHYX; TrackID=1csZIH3Ien3b3qU9dSlWi7hww-YsrL6TpOsN-zf4Ib7s-J9vC8RbqgciNTM-44eQRagUwM2v30wkP__e7T1bZ6rEmyHS6PJBrQHRQx5PG20I; thor=65BCC8DFBCE62402AF37210ED04E5A896AA0A423BA77877599DBD8ED1A5262C4B9BA320E14F186F8DE9ADA6FF665E145305D93163E5BDDE2784F5AF0644766C13C5557B4D111195B1E46BBFE26C2C8541E948B675EC4855ED786E4746044F252ADE174404BC2DE9B07BD11C291DA358516CBC90A1F105BCCB3F1E06191BEF2BBE727212052AF9238CFC20834D7F9DA6F01862E113A3ADAEBEFFD3469A4A25026; token=a1c894446438340f0f8fa976044d55ed,3,989635; cid=9; cn=1; _gia_d=1; mt_xid=V2_52007VwMUW11aUVIdSBxZA2MDG1tbW1ZSGk4QbFAyAxIFWwhXRk8ZEVkZYgMaAEFRUA1KVUoOVmQLRlEOD1YNSnkaXQZgHxNVQVhQSx9PElgEbAAXYl9oUmoZShtbDWYGEVVeWGJcF0kYXQ%3D%3D; sdtoken=AAbEsBpEIOVjqTAKCQtvQu17LnLIFWmA4KKvSTiLXqLgVOF7obqOYdPiHH2HPBkteYoRCvc1nFNtI5Xe6WWYntnLja-uL5WFHiVgRGrXNeqxzVLDpdaXr5YvVo2qnzTDhmzqio_J7GQR6aWNyIdFLjKuMffttw52JGel-9KpIiPwpOUILS9wlvUN1tfYMzi8EamITowCIg4G';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.jd.com/',
        'Origin': 'https://www.jd.com',
        'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'x-api-eid-token': 'jdd034WNRHOU475F4MBECWRQN23HHWRCRGDAV2NKUJH4VD3EUTIY5EHT62N5C4MEENKU377SHAU6FN2TL4KROF32LVKQQ6YAAAAM6YB23OUAAAAAADKTIW2CVRNKRHYX',
        'Cookie': COOKIES,
      },
    };
    https.get(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}

async function searchJD(keyword, page) {
  const signer = await JdH5stSigner.create({ debug: false });
  const body = {
    enc: 'utf-8', pvid: 'crawl_test', from: 'home',
    area: '14_1167_1170_19060', page, mode: '',
    concise: false, hoverPictures: false, newAdvRepeat: false,
    mixerParam: false, new_interval: true, s: (page - 1) * 22 + 1,
  };
  const { h5st } = await signer.sign({
    appid: 'search-pc-java',
    functionId: 'pc_search_searchWare',
    body,
  });

  const ts = Date.now().toString();
  const uuid = '1781329304475' + ts.slice(-10);
  const params = new URLSearchParams({
    appid: 'search-pc-java', functionId: 'pc_search_searchWare',
    client: 'pc', clientVersion: '1.0.0', cthr: '1',
    uuid, loginType: '3', keyword,
    body: JSON.stringify(body), h5st, t: ts,
  });
  const url = 'https://api.m.jd.com/api?' + params.toString();

  const resp = await httpGet(url);
  return { status: resp.status, body: resp.body, h5st };
}

(async () => {
  console.log('='.repeat(60));
  console.log('JD Search Crawl — Node.js E2E');
  console.log('='.repeat(60));

  for (const page of [1, 2]) {
    console.log('\n[Page ' + page + '] Searching...');
    try {
      const result = await searchJD('华为', page);
      console.log('  Status:', result.status);
      console.log('  h5st:', result.h5st.substring(0, 70) + '...');
      console.log('  Body:', result.body.substring(0, 500));
      try {
        const data = JSON.parse(result.body);
        console.log('  Code:', data.code || 'N/A');
        console.log('  Echo:', (data.echo || '').substring(0, 80));
      } catch (e) {
        console.log('  (not JSON)');
      }
    } catch (e) {
      console.log('  Error:', e.message);
    }
  }
  console.log('\n' + '='.repeat(60));
  console.log('Done');
})().catch(e => console.error(e.message));
