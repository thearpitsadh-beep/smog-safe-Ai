import test from 'node:test';
import assert from 'node:assert/strict';
import { readBoundedJSON, createProviderClient } from '../src/provider.mjs';
const encoder=new TextEncoder();

function chunkedResponse(parts, extra={}) {
  let readCount=0,cancelled=false;
  const stream=new ReadableStream({
    pull(controller){
      const part=parts[readCount++];
      if(part===undefined) controller.close();
      else controller.enqueue(typeof part==='string'?encoder.encode(part):part);
    },
    cancel(){cancelled=true;}
  });
  return {response:new Response(stream,{status:200,headers:extra}),getState:()=>({readCount,cancelled})};
}

test('Stream reader accepts multiple UTF-8 chunks within the declared cap',async()=>{
  const {response}=chunkedResponse(['{"location":"Pu','ne","aqi":82}']);
  assert.deepEqual(await readBoundedJSON(response,{maxBytes:128}),{location:'Pune',aqi:82});
});
test('Stream reader stops at the first oversized cumulative byte count and cancels stream',async()=>{
  const {response,getState}=chunkedResponse([' '.repeat(70),' '.repeat(70),' '.repeat(20000)]);
  await assert.rejects(readBoundedJSON(response,{maxBytes:100}),/too large/);
  assert.equal(getState().cancelled,true);
  assert.ok(getState().readCount<3,'must not buffer remaining unbounded data');
});
test('Declared oversized content-length is rejected without consuming response body',async()=>{
  const {response,getState}=chunkedResponse(['{"ok":true}'],{'Content-Length':'900'});
  await assert.rejects(readBoundedJSON(response,{maxBytes:100}),/too large/);
  assert.ok(getState().readCount<=1);
});
test('Invalid UTF-8 and malformed JSON are safely rejected',async()=>{
  const invalid=chunkedResponse([new Uint8Array([0xc3,0x28])]);
  await assert.rejects(readBoundedJSON(invalid.response,{maxBytes:100}),/malformed/);
  const broken=chunkedResponse(['{broken']);
  await assert.rejects(readBoundedJSON(broken.response,{maxBytes:100}),/malformed/);
});
test('JSON arrays are rejected when an object is required',async()=>{
  await assert.rejects(readBoundedJSON(new Response('[1,2]'),{maxBytes:100}),/invalid JSON/);
});
test('Provider cache is protected from mutation of returned objects',async()=>{
  let count=0;
  const get=createProviderClient({request:async()=>{count++;return new Response('{"nested":{"secret":1}}');}});
  const url='https://example.test/immutable';
  const first=await get(url,60000);first.data.nested.secret=999;
  const second=await get(url,60000);
  assert.equal(count,1);assert.equal(second.data.nested.secret,1);
});
test('Failed provider requests never create cached responses',async()=>{
  let count=0;
  const get=createProviderClient({request:async()=>{count++;return new Response('bad JSON');}});
  const u='https://example.test/broken';
  await assert.rejects(get(u,60000),/malformed/);
  await assert.rejects(get(u,60000),/malformed/);
  assert.equal(count,2);
});
test('Simultaneous consumers get separate response objects',async()=>{
  let count=0;
  const get=createProviderClient({request:async()=>{count++;return new Response('{"a":{"n":1}}');}});
  const [a,b]=await Promise.all([get('https://example.test/shared',60000),get('https://example.test/shared',60000)]);
  a.data.a.n=333;
  assert.equal(b.data.a.n,1);assert.equal(count,1);
});
