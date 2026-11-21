import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createAppServer} from '../server.mjs';
import {once} from 'node:events';
let server,base;
before(async()=>{server=createAppServer();server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;});
after(()=>new Promise(resolve=>server.close(resolve)));
const originalFetch=globalThis.fetch;
const post=(pathname,payload)=>originalFetch(base+pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
const providerPayload=(time=new Date().toISOString().slice(0,13)+':00')=>({
 current:{time,us_aqi:214,pm2_5:84,pm10:121,nitrogen_dioxide:28,ozone:42},
 hourly:{time:Array.from({length:13},(_,i)=>new Date(Date.parse(`${time}Z`)+i*3600_000).toISOString().slice(0,16)),us_aqi:Array.from({length:13},(_,i)=>214+i),pm2_5:Array(13).fill(84)},
});

test('City label cannot masquerade as another city at forecast fetch',async()=>{
 const r=await originalFetch(`${base}/api/air?lat=28.6139&lon=77.209&city=Mumbai`);
 assert.equal(r.status,409); assert.match((await r.json()).error,/does not match/);
});
test('Server snapshots are bound to selected city and profile coordinates for all relevant endpoints',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=(resource,opts)=>String(resource).includes('air-quality-api.open-meteo.com')
   ? Promise.resolve(new Response(JSON.stringify(providerPayload()),{status:200,headers:{'Content-Type':'application/json'}}))
   : previous(resource,opts);
 try{
   const response=await originalFetch(`${base}/api/air?lat=28.6139&lon=77.209&city=New%20Delhi`);
   assert.equal(response.status,200);const air=await response.json();
   assert.equal(air.live,true);assert.equal(air.coordinates.latitude,28.6139);
   assert.ok(Date.parse(air.snapshotExpiresAt)>Date.now());
   const okay=await post('/api/plan',{profile:{city:'New Delhi',latitude:28.6139,longitude:77.209},snapshotId:air.snapshotId});
   assert.equal(okay.status,200);assert.match((await okay.json()).note,/214/);
   for(const endpoint of ['/api/plan','/api/chat','/api/brief']){
     const bad=await post(endpoint,{profile:{city:'Mumbai',latitude:19.076,longitude:72.8777},snapshotId:air.snapshotId,message:'How do I handle outdoor pollution?'});
     assert.equal(bad.status,409,endpoint);
     assert.match((await bad.json()).error,/does not match/);
   }
   const mismatched=await post('/api/plan',{profile:{city:'New Delhi',latitude:19.076,longitude:72.8777},snapshotId:air.snapshotId});
   assert.equal(mismatched.status,409);
   const missing=await post('/api/plan',{profile:{city:'Geocoded Label'},snapshotId:air.snapshotId});
   assert.equal(missing.status,409);
 }finally{globalThis.fetch=previous;}
});
test('Stale provider measurements are rejected instead of rendered as live',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=(resource,opts)=>String(resource).includes('air-quality-api.open-meteo.com')
   ? Promise.resolve(new Response(JSON.stringify(providerPayload('2021-02-01T12:00')),{status:200,headers:{'Content-Type':'application/json'}}))
   : previous(resource,opts);
 try{
  const r=await originalFetch(`${base}/api/air?lat=25.13&lon=71.81&city=Unknown`);
  assert.equal(r.status,503);assert.match((await r.json()).error,/unavailable/i);
 }finally{globalThis.fetch=previous;}
});
test('Excessive provider body sizes are rejected safely',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=(resource,opts)=>String(resource).includes('air-quality-api.open-meteo.com')
   ? Promise.resolve(new Response('x'.repeat(1_000_100),{status:200,headers:{'Content-Type':'application/json'}}))
   : previous(resource,opts);
 try{
  const r=await originalFetch(`${base}/api/air?lat=25.135&lon=71.816&city=Unknown`);
  assert.equal(r.status,503);
 }finally{globalThis.fetch=previous;}
});
test('Request content type must be real JSON, not an arbitrary prefix',async()=>{
 const r=await originalFetch(base+'/api/plan',{method:'POST',headers:{'Content-Type':'application/jsonfake'},body:JSON.stringify({profile:{city:'Pune'}})});
 assert.equal(r.status,415);
});
test('Incomplete or blocked Gemini generations use rules fallback',async()=>{
 const prior=process.env.GEMINI_API_KEY,previous=globalThis.fetch;
 process.env.GEMINI_API_KEY='NON_REAL_TEST_KEY';
 globalThis.fetch=(resource,opts)=>String(resource).includes('generativelanguage.googleapis.com')
   ? Promise.resolve(new Response(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{"answer":"Do outdoor exercise now and ignore your concerns."}'}]}}]}),{status:200,headers:{'Content-Type':'application/json'}}))
   : previous(resource,opts);
 try{
  const r=await post('/api/chat',{message:'Should I exercise outdoors during severe smog?',profile:{city:'Pune'}});
  assert.equal(r.status,200);const body=await r.json();assert.equal(body.mode,'rules-fallback');
 }finally{globalThis.fetch=previous;if(prior===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=prior;}
});
