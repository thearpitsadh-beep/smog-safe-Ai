import test from 'node:test';
import assert from 'node:assert/strict';
import {createProviderClient} from '../src/provider.mjs';
test('Repeated upstream requests use bounded in-memory cache',async()=>{
 let calls=0;const request=async()=>{calls++;return new Response('{"a":1}',{status:200});};
 const get=createProviderClient({request});const url=new URL('https://example.test/data');
 const a=await get(url,60000),b=await get(url,60000);
 assert.equal(a.cacheHit,false);assert.equal(b.cacheHit,true);assert.equal(calls,1);
});
test('Simultaneous upstream requests are deduplicated',async()=>{
 let calls=0;const request=async()=>{calls++;await new Promise(r=>setTimeout(r,20));return new Response('{"ok":true}',{status:200});};
 const get=createProviderClient({request});const u=new URL('https://example.test/same');
 const [a,b,c]=await Promise.all([get(u,60000),get(u,60000),get(u,60000)]);
 assert.equal(calls,1);assert.equal(a.data.ok,true);assert.equal(b.data.ok,true);assert.equal(c.data.ok,true);
});
test('Oversized upstream response is blocked',async()=>{
 const get=createProviderClient({maxBytes:100,request:async()=>new Response('x'.repeat(101),{status:200})});
 await assert.rejects(get(new URL('https://example.test/large'),60000),/too large/);
});
test('Malformed upstream JSON cannot populate the cache',async()=>{
 let calls=0;const get=createProviderClient({request:async()=>{calls++;return new Response('INVALID',{status:200});}});
 await assert.rejects(get(new URL('https://example.test/bad'),60000),/malformed/);
 await assert.rejects(get(new URL('https://example.test/bad'),60000),/malformed/);
 assert.equal(calls,2);
});
