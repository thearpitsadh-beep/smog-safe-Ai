import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAir} from '../src/air.mjs';
const clock=Date.UTC(2026,10,20,15,30);
const hourly=()=>({time:Array.from({length:13},(_,i)=>new Date(Date.UTC(2026,10,20,15+i)).toISOString().slice(0,16)),us_aqi:Array.from({length:13},(_,i)=>220-i),pm2_5:Array(13).fill(55)});
const mock=()=>({current:{time:'2026-11-20T15:00',us_aqi:220,pm2_5:55,pm10:100,nitrogen_dioxide:40,ozone:60},hourly:hourly()});
test('Provider UTC AQI is labelled forecast and has a correct timestamp',()=>{
 const air=parseAir(mock(),{now:clock});assert.equal(air.live,true);assert.equal(air.scale,'US AQI');assert.equal(air.hourTimezone,'UTC');
 assert.equal(air.timestamp,'2026-11-20T15:00:00.000Z');assert.equal(air.hours.length,12);assert.equal(air.hours[0].time,'15:00');
});
test('Stale data cannot be served as live forecast',()=>assert.throws(()=>parseAir(mock(),{now:clock+9*3600_000}),/stale/));
test('Far-future timestamps cannot be served as live',()=>assert.throws(()=>parseAir(mock(),{now:clock-9*3600_000}),/future-dated/));
test('Invalid and negative US AQI are rejected',()=>{
 const m=mock();m.current.us_aqi=-10;assert.throws(()=>parseAir(m,{now:clock}),/out-of-range/);
 const n=mock();n.current.us_aqi='220';assert.throws(()=>parseAir(n,{now:clock}),/out-of-range/);
});
test('Negative pollutant values are not presented as valid readings',()=>{
 const m=mock();m.current.pm2_5=-3;m.hourly.pm2_5[0]=-50;
 const air=parseAir(m,{now:clock});assert.equal(air.current.pm25,null);assert.equal(air.hours[0].pm25,null);
});
test('Forecast hourly list must be usable and chronological',()=>{
 const m=mock();m.hourly.time=['2024-01-01T00:00','2024-01-01T01:00'];m.hourly.us_aqi=[30,40];
 assert.throws(()=>parseAir(m,{now:clock}),/hours missing/);
});
