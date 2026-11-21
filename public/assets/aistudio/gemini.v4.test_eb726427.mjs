import test from 'node:test';
import assert from 'node:assert/strict';
import {geminiResponse} from '../src/gemini.mjs';
import {safeProfile,demoAir} from '../src/logic.mjs';
const profile=safeProfile({city:'Pune',schedule:'school',commute:'bus',children:true});
const air=demoAir('Pune');
const good='Consider lower-traffic school routes and reduce smoky indoor sources. Review local advisories before outdoor exertion.';
const reply=(text,finishReason='STOP')=>new Response(JSON.stringify({candidates:[{finishReason,content:{parts:[{text}]}}]}),{status:200});
const asModel=v=>reply(JSON.stringify(v));

test('When no key is configured the Gemini module does not call upstream',async()=>{
  const result=await geminiResponse('Any pollution updates?',profile,air,{key:'',fetcher:()=>{throw new Error('Unexpected network call');}});
  assert.equal(result,null);
});
test('Gemini module keeps key in headers, not URL or returned answer',async()=>{
  let called=0;
  const answer=await geminiResponse('What about school travel?',profile,air,{
    key:'TEST_PRIVATE_KEY',fetcher:async(url,opts)=>{
      called++;assert.match(url,/generativelanguage\.googleapis\.com/);
      assert.doesNotMatch(url,/TEST_PRIVATE_KEY/);
      assert.equal(opts.headers['x-goog-api-key'],'TEST_PRIVATE_KEY');
      const req=JSON.parse(opts.body);
      assert.equal(req.generationConfig.responseMimeType,'application/json');
      assert.ok(req.systemInstruction.parts[0].text.includes('US AQI'));
      assert.ok(req.contents[0].parts[0].text.includes('Pune'));
      return asModel({answer:good});
    }
  });
  assert.equal(called,1);assert.equal(answer,good);assert.doesNotMatch(answer,/TEST_PRIVATE_KEY/);
});
test('Upstream error, refusal, missing candidate and incomplete generation do not become user-visible advice',async()=>{
  const cases=[
    new Response('{"error":"over quota"}',{status:429}),
    new Response(JSON.stringify({promptFeedback:{blockReason:'SAFETY'},candidates:[]})),
    new Response(JSON.stringify({candidates:[]})),
    reply(JSON.stringify({answer:good}),'MAX_TOKENS'),
  ];
  for(const output of cases){
    await assert.rejects(geminiResponse('What should I do?',profile,air,{key:'FAKE',fetcher:async()=>output}));
  }
});
test('Wrong JSON, unexpected schema, too-short text and excessive text are blocked',async()=>{
  const payloads=[
    reply('{not-json'),asModel({text:good}),asModel({answer:'okay'}),asModel({answer:'x'.repeat(1500)}),
    asModel({answer:'Take antibiotics to clear the smog.'}),
    asModel({answer:'The live AQI is 200, a government measurement.'}),
  ];
  for(const output of payloads){
    await assert.rejects(geminiResponse('General guidance?',profile,air,{key:'FAKE',fetcher:async()=>output}));
  }
});
test('Invalid server-selected Gemini model cannot be passed into the URL',async()=>{
  const previous=process.env.GEMINI_MODEL;process.env.GEMINI_MODEL='../evil?x=y';
  try{await assert.rejects(geminiResponse('Help',profile,air,{key:'FAKE',fetcher:async()=>{throw new Error('should not call');}}),/Invalid configured model/);}
  finally{if(previous===undefined)delete process.env.GEMINI_MODEL;else process.env.GEMINI_MODEL=previous;}
});
