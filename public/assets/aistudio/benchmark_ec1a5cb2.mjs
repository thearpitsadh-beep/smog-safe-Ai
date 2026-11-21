/** Reproducible local HTTP smoke benchmark. NOT a public-host or Gemini/forecast SLA. */
import {createAppServer} from '../server.mjs';
import {once} from 'node:events';
import {performance} from 'node:perf_hooks';
const server=createAppServer();server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const suites=[
 {name:'health',path:'/api/health'},
 {name:'demo',path:'/api/demo?city=Pune'},
 {name:'planning',path:'/api/plan',body:{profile:{city:'Pune',schedule:'school',commute:'bus',children:true,budget:'low'}}},
 {name:'impact',path:'/api/impact',body:{distanceKm:12,daysPerWeek:5,option:'metro'}},
];
const report={};let failures=0;
try{
 for(const test of suites){
  const times=[];
  for(let i=0;i<25;i++){
   const t=performance.now();
   const options=test.body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(test.body)}:undefined;
   const response=await fetch(base+test.path,options);await response.arrayBuffer();
   times.push(performance.now()-t);if(response.status!==200)failures++;
  }
  times.sort((a,b)=>a-b);
  report[test.name]={requests:25,medianMs:+times[12].toFixed(2),p95Ms:+times[23].toFixed(2),maxMs:+times.at(-1).toFixed(2)};
 }
 console.log(JSON.stringify({scope:'100 requests to localhost only; excludes Gemini, Open-Meteo, TLS, hosting and high concurrency',failures,results:report},null,2));
 if(failures)process.exitCode=1;
}finally{await new Promise(resolve=>server.close(resolve));}
