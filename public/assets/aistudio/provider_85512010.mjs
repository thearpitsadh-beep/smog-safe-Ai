/** Bounded, deduplicated server-side JSON client for fixed upstream providers. */
export function createProviderClient({maxEntries=240,maxBytes=1_000_000,request=(...args)=>fetch(...args)}={}) {
  const cache=new Map();
  const inFlight=new Map();
  return async function remoteJSON(url,ttlMs,timeoutMs=9500){
    const key=url.toString(), cached=cache.get(key);
    if(cached && Date.now()-cached.created<ttlMs) return {...cached.value,cacheHit:true};
    if(inFlight.has(key)) return {...await inFlight.get(key),cacheHit:true};
    const pending=(async()=>{
      const response=await request(url,{signal:AbortSignal.timeout(timeoutMs),headers:{'User-Agent':'SmogSafeAI/3.0','Accept':'application/json'}});
      if(!response.ok) throw new Error(`Provider status ${response.status}`);
      if(Number(response.headers.get('content-length'))>maxBytes) throw new Error('Provider payload too large');
      const raw=await response.text();
      if(Buffer.byteLength(raw)>maxBytes) throw new Error('Provider payload too large');
      let data;
      try{data=JSON.parse(raw);}catch{throw new Error('Provider returned malformed JSON');}
      if(!data||typeof data!=='object'||Array.isArray(data)) throw new Error('Provider returned invalid JSON');
      const value={data,cacheHit:false};
      cache.set(key,{value,created:Date.now()});
      if(cache.size>maxEntries) cache.delete(cache.keys().next().value);
      return value;
    })();
    inFlight.set(key,pending);
    try{return await pending;}finally{inFlight.delete(key);}
  };
}
