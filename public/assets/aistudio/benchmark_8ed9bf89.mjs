/** Reproducible LOCAL API benchmark. No external providers; not a production SLA. */
import {createAppServer} from '../server.mjs';
import {once} from 'node:events';
import {performance} from 'node:perf_hooks';
const server=createAppServer();server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const durations=[];let errors=0;
try{
 for(let i=0;i<60;i++){
  const t=performance.now();
  const path=i%2?'/api/health':'/api/demo?city=Pune';
  const r=await fetch(base+path);await r.arrayBuffer();
  durations.push(performance.now()-t);if(r.status!==200)errors++;
 }
 const numbers=[...durations].sort((a,b)=>a-b);
 const p95=numbers[Math.ceil(numbers.length*.95)-1];
 const report={requests:durations.length,errors,medianMs:Number(numbers[29].toFixed(2)),p95Ms:Number(p95.toFixed(2)),maxMs:Number(numbers.at(-1).toFixed(2)),scope:'local Node HTTP /api/health and /api/demo; excludes Gemini, forecasts, TLS and real network'};
 console.log(JSON.stringify(report,null,2));
 if(errors)process.exitCode=1;
}finally{server.close();}
