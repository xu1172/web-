/**
 * JD H5ST Signer — Pure Node.js v8 (Final)
 *
 * Full chain: Canvas stub → _$ram() → _$YJ.post() → XHR → auto-apply token
 * XHR stub intercepts request_algo response and calls _$pam(tk,algo) directly.
 */
const vm = require('vm'); const fs = require('fs'); const path = require('path');
const crypto = require('crypto'); const https = require('https');

class MemStorage {
  constructor() { this._d = new Map(); }
  getItem(k) { return this._d.get(k) ?? null; }
  setItem(k, v) { this._d.set(k, String(v)); }
  removeItem(k) { this._d.delete(k); }
  get length() { return this._d.size; }
  key(n) { return [...this._d.keys()][n] ?? null; }
}

function httpPost(u, b) {
  return new Promise((resolve, reject) => {
    const url = new URL(u); const p = JSON.stringify(b);
    https.request({
      hostname: url.hostname, port: 443, path: url.pathname + url.search, method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json','Origin':'https://www.jd.com','Referer':'https://www.jd.com/','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},
    },res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>resolve({status:res.statusCode,ok:true,text:()=>Promise.resolve(d),json:()=>Promise.resolve(JSON.parse(d))}))}).on('error',reject).end(p)})
}

const FP = {
  'WQ_dy1_vk': JSON.stringify({'5.3':{'73806':{e:31536000,v:'i2i2ij517jjy2yy6',t:1781329304976}}}),
  'WQ_gather_cv1': JSON.stringify({v:'4c9ac651eb66c057ceae86d646d77646',t:1781345481460,e:31536000}),
  'WQ_gather_wgl1': JSON.stringify({v:'1778886bf322692a51200f5661ead016',t:1781345481491,e:31536000}),
};

function buildSandbox(storage, onToken) {
  const sb = {
    console:{log:()=>{},warn:()=>{},error:()=>{}},setTimeout,clearTimeout,setInterval:()=>0,
    Promise,Date,Math,parseInt,parseFloat,isNaN,isFinite,NaN,Infinity,undefined,
    RegExp,Error,TypeError,JSON,Object,Array,String,Number,Boolean,Function,Symbol,
    Map,Set,WeakMap,WeakSet,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,
    Int8Array,Int16Array,Int32Array,Float32Array,Float64Array,DataView,
    TextEncoder,TextDecoder,crypto:crypto.webcrypto,localStorage:storage,sessionStorage:storage,
    fetch:async()=>{throw new Error('no')},
    XMLHttpRequest:function(){
      const xhr = {
        open(m,u){this._method=m;this._url=u},setRequestHeader(){},
        send(body){
          let pb={};try{pb=body?JSON.parse(body):{}}catch(e){}
          const self=this;
          httpPost(this._url,pb).then(async r=>{
            self.responseText=await r.text();self.status=r.status;self.readyState=4;
            try{self.response=JSON.parse(self.responseText)}catch(e){}
            // Auto-apply token on request_algo response
            if(self._url&&self._url.includes('request_algo')&&onToken){
              try{const d=JSON.parse(self.responseText);if(d.status===200&&d.data&&d.data.result)onToken(d.data.result.tk,d.data.result.algo)}catch(e){}
            }
            if(self.onreadystatechange)self.onreadystatechange();if(self.onload)self.onload()
          }).catch(e=>{self.status=0;self.readyState=4;if(self.onerror)self.onerror(e)})
        }
      };return xhr
    },
    window:{},self:{},document:{createElement:()=>({style:{},appendChild:()=>{},getContext:()=>({fillRect(){},fillText(){},getImageData:()=>({data:new Uint8Array(100)})})}),head:{appendChild:()=>{}},body:{appendChild:()=>{}},documentElement:{style:{}}},
    navigator:{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',platform:'Win32',language:'zh-CN',languages:['zh-CN'],webdriver:false,plugins:{length:5},hardwareConcurrency:16,deviceMemory:8},
    location:{href:'https://www.jd.com/'},screen:{width:2560,height:1440},
    performance:{now:()=>Date.now()},Event:function(){},Element:function(){},HTMLElement:function(){},HTMLScriptElement:function(){},Node:function(){},NodeList:function(){return[]},
  };
  sb.window=new Proxy(sb,{get(t,p){return p==='window'?sb.window:t[p]}});sb.window.window=sb.window;sb.self=sb.window;
  return sb;
}

class JdH5stSigner {
  static async create(o){const s=new JdH5stSigner(o);await s._init();return s}
  constructor(o){this._appId=o.appId||'73806';this._debug=o.debug||false;this._signer=null;this._ready=false}

  async _init(){
    const storage=new MemStorage();for(const[k,v]of Object.entries(FP))storage.setItem(k,v);
    const self=this;
    const sb=buildSandbox(storage,(tk,algo)=>{if(self._signer&&!self._signer._isNormal)self._signer['_$pam'](tk,algo)});
    const ctx=vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'..','assets','js','js_security_v3_0.1.4_patched.js'),'utf-8'),ctx,{filename:'jd_sec.js',timeout:10000});
    const PS=sb.ParamsSign;
    this._signer=new PS({appId:this._appId,debug:this._debug});
    if(this._debug)console.log('[JdH5st] Created: fp=%s',this._signer._fingerprint);
    await this._signer['_$rds']();
    if(this._debug)console.log('[JdH5st] After _$rds: fp=%s isNormal=%s',this._signer._fingerprint,this._signer._isNormal);
    for(let i=0;i<8&&!this._signer._isNormal;i++)await new Promise(r=>setTimeout(r,1000));
    this._ready=true;
    if(this._debug)console.log('[JdH5st] Ready: fp=%s isNormal=%s',this._signer._fingerprint,this._signer._isNormal);
  }

  async sign({appid,functionId,body}){
    if(!this._ready)throw new Error('Not initialized');
    const input={appid:appid||'search-pc-java',functionId:functionId||'pc_search_searchWare',client:'pc',clientVersion:'1.0.0',t:Date.now().toString(),body:crypto.createHash('sha256').update(JSON.stringify(body||{})).digest('hex')};
    const r=await this._signer.sign(input);
    return{h5st:r.h5st,_stk:r._stk,_ste:r._ste}
  }
}

module.exports={JdH5stSigner};

if(require.main===module){(async()=>{const s=await JdH5stSigner.create({debug:true});const{h5st}=await s.sign({appid:'search-pc-java',functionId:'pc_search_searchWare',body:{enc:'utf-8',pvid:'test',from:'home',area:'14_1167_1170_19060',page:1,s:1}});console.log('\nh5st:',h5st);h5st.split(';').forEach((seg,i)=>console.log('  ['+(i+1)+'] ('+seg.length+'c) '+seg.substring(0,70)+(seg.length>70?'...':'')))})().catch(e=>{console.error(e.message);process.exit(1)})}
