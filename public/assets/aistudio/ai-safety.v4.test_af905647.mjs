import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createAppServer} from '../server.mjs';
import {isHighRiskHealthQuestion,validateGeminiAnswer} from '../src/trust.mjs';

const safeAnswer='Reduce smoky indoor sources and choose indoor activities when the modeled air-quality forecast is poor.';
const responseFromText=(text, status=200)=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]}),{status,headers:{'Content-Type':'application/json'}});
let srv,base;
before(async()=>{srv=createAppServer();srv.listen(0,'127.0.0.1');await once(srv,'listening');base=`http://127.0.0.1:${srv.address().port}`;});
after(()=>new Promise(resolve=>srv.close(resolve)));
async function mockGemini(mock,action) {
  const oldKey=process.env.GEMINI_API_KEY,oldFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='TEST_KEY_DO_NOT_USE';
  let calls=0;
  globalThis.fetch=async(resource,options)=>{
    if(String(resource).includes('generativelanguage.googleapis.com')){calls++;return mock(options);}
    return oldFetch(resource,options);
  };
  try {return await action(()=>calls,oldFetch);}
  finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;}
}
function post(originalFetch,payload){return originalFetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});}

test('A syntactically valid Gemini answer is displayed only after structured validation',async()=>{
  await mockGemini(()=>responseFromText(JSON.stringify({answer:safeAnswer})),async(count,request)=>{
    const res=await post(request,{message:'What should our household do to limit indoor smoke?',profile:{city:'New Delhi'}});
    const result=await res.json();assert.equal(res.status,200);assert.equal(result.mode,'gemini');assert.equal(result.answer,safeAnswer);assert.equal(count(),1);
  });
});
test('A Gemini upstream body exceeding 48KB is rejected before JSON parsing and returns safe fallback',async()=>{
  const payload='X'.repeat(49_000);
  await mockGemini(()=>new Response(payload,{status:200,headers:{'Content-Type':'application/json'}}),async(count,request)=>{
    const res=await post(request,{message:'How should I keep my living room air cleaner?',profile:{city:'Pune'}});
    const result=await res.json();assert.equal(res.status,200);assert.equal(result.mode,'rules-fallback');assert.match(result.answer,/indoor source control/i);assert.equal(count(),1);
  });
});
test('High-risk health question bypasses Gemini even if configured',async()=>{
  await mockGemini(()=>responseFromText(JSON.stringify({answer:safeAnswer})),async(count,request)=>{
    const res=await post(request,{message:'I have chest pain; what medication should I take?',profile:{city:'Pune'}});
    const result=await res.json();assert.equal(res.status,200);assert.equal(result.mode,'rules-fallback');assert.match(result.answer,/professional medical care/i);assert.equal(count(),0);
  });
});
test('Medical prescriptions and unsourced numeric current AQI are rejected',()=>{
  assert.equal(validateGeminiAnswer({answer:'Take antibiotics to fix smog symptoms immediately.'},{live:true,usAqi:115}),null);
  assert.equal(validateGeminiAnswer({answer:'The current US AQI is 320 in Pune. Reduce outdoor activity.'},{live:true,usAqi:115}),null);
  assert.equal(validateGeminiAnswer({answer:'The current US AQI is 115 (modeled forecast); review local air alerts.'},{live:true,usAqi:115}),
    'The current US AQI is 115 (modeled forecast); review local air alerts.');
  assert.equal(validateGeminiAnswer({answer:'An official AQI reading confirms safe conditions for all.'},{live:true,usAqi:115}),null);
});
test('High-stakes health classifier catches urgent symptoms but permits general prevention questions',()=>{
  assert.equal(isHighRiskHealthQuestion('I am struggling to breathe; should I take steroids?'),true);
  assert.equal(isHighRiskHealthQuestion('Which medicine should I take?'),true);
  assert.equal(isHighRiskHealthQuestion('How can I keep my indoor air cleaner?'),false);
});
