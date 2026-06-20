const vm = require('vm'); const fs = require('fs'); const crypto = require('crypto');
const https = require('https');
class MS{constructor(){this._d=new Map()} getItem(k){return this._d.get(k)??null} setItem(k,v){this._d.set(k,String(v))}}
function httpPost(u,b){return new Promise((resolve,reject)=>{const url=new URL(u);const p=JSON.stringify(b);https.request({hostname:url.hostname,port:443,path:url.pathname+url.search,method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Origin':'https://www.jd.com','Referer':'https://www.jd.com/','User-Agent':'Mozilla/5.0'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>resolve({status:res.statusCode,ok:true,text:()=>Promise.resolve(d),json:()=>Promise.resolve(JSON.parse(d))}))}).on('error',reject).end(p)})}

async function main(){
const st=new MS();
st.setItem('WQ_dy1_vk',JSON.stringify({'5.3':{'73806':{e:31536000,v:'jj2jije51bbezz26',t:1781330882734}}}));
const src=fs.readFileSync('e:/PythonCodeProject/sites/jd_h5st/assets/js/js_security_v3_0.1.4_patched.js','utf-8');
const sb={console:{log:()=>{},warn:()=>{},error:()=>{}},setTimeout,clearTimeout,setInterval:()=>0,Promise,Date,Math,parseInt,parseFloat,isNaN,isFinite,NaN,Infinity,undefined,RegExp,Error,TypeError,JSON,Object,Array,String,Number,Boolean,Function,Symbol,Map,Set,WeakMap,WeakSet,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Int8Array,Int16Array,Int32Array,Float32Array,Float64Array,DataView,TextEncoder,TextDecoder,crypto:crypto.webcrypto,localStorage:st,sessionStorage:st,fetch:async()=>{throw new Error('no')},XMLHttpRequest:function(){const xhr={open(m,u){this._method=m;this._url=u},setRequestHeader(){},send(body){let pb={};try{pb=body?JSON.parse(body):{}}catch(e){}const self=this;httpPost(this._url,pb).then(async r=>{self.responseText=await r.text();self.status=r.status;self.readyState=4;if(self.onreadystatechange)self.onreadystatechange()}).catch(e=>{self.status=0;self.readyState=4})}};return xhr},window:{},self:{},document:{createElement:()=>({style:{},appendChild:()=>{},getContext:()=>({fillRect(){},fillText(){},getImageData:()=>({data:new Uint8Array(100)})})}),head:{appendChild:()=>{}},body:{appendChild:()=>{}},documentElement:{style:{}}},navigator:{userAgent:'Moz',platform:'Win32',languages:['zh-CN'],webdriver:false,plugins:{length:5},hardwareConcurrency:16},location:{href:'https://www.jd.com/'},screen:{width:2560,height:1440},performance:{now:()=>Date.now()},Event:function(){},Element:function(){},HTMLElement:function(){},HTMLScriptElement:function(){},Node:function(){},NodeList:function(){return[]}};
sb.window=new Proxy(sb,{get(t,p){return p==='window'?sb.window:t[p]}});sb.window.window=sb.window;sb.self=sb.window;
const ctx=vm.createContext(sb);
vm.runInContext(src,ctx,{filename:'sec.js',timeout:10000});
const PS=sb.ParamsSign;
const s=new PS({appId:'73806'});

// Check _defaultAlgorithm WITHOUT JSON.stringify
console.log('BEFORE _$rds:');
const da = s._defaultAlgorithm;
console.log('  _defaultAlgorithm keys:', Object.keys(da||{}));
for(const k of Object.keys(da||{})) {
  console.log('    '+k+':', typeof da[k], da[k]?.name || 'N/A');
}
console.log('  _algos keys:', Object.keys(s._algos||{}));
for(const k of Object.keys(s._algos||{})) {
  console.log('    '+k+':', typeof s._algos[k]);
}

await s['_$rds']();

console.log('\nAFTER _$rds:');
const da2 = s._defaultAlgorithm;
console.log('  _defaultAlgorithm keys:', Object.keys(da2||{}));

// Now fetch a token and check _$pam
const resp=await httpPost('https://cactus.jd.com/request_algo',{version:'5.3',fp:s._fingerprint||'jj2jije51bbezz26',appId:'73806',timestamp:Date.now(),platform:'web',expandParams:'',fv:'h5_file_v5.3.4',localTk:''});
const data=await resp.json();
if(data.data&&data.data.result){
  const tk=data.data.result.tk;
  const algoStr=data.data.result.algo;
  s['_$pam'](tk, algoStr);

  console.log('\nAFTER _$pam:');
  const da3 = s._defaultAlgorithm;
  console.log('  _defaultAlgorithm keys:', Object.keys(da3||{}));
  console.log('  _algos keys:', Object.keys(s._algos||{}));
  console.log('  _isNormal:', s._isNormal);

  // Also check if hashes work
  if(Object.keys(da3||{}).length > 0) {
    const fn = da3[Object.keys(da3)[0]];
    console.log('  First algo fn type:', typeof fn);
  }
}
}
main().catch(e=>console.error(e&&e.message));
