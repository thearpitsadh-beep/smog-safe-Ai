import { DEMO_CITIES, demoAir, aqiBand, safeProfile, makePlan, travelImpact, ILLUSTRATIVE_KG_PER_KM, fallbackAnswer } from '/logic.mjs';

const $ = id => document.getElementById(id);
const navLabels={overview:'Overview',plan:'My daily plan',indoor:'Indoor air guide',impact:'Impact lab',copilot:'Ask SmogSafe AI'};
const standalone=Boolean(window.__SMOGSAFE_STANDALONE__);
let city={...DEMO_CITIES[0]};
let air=demoAir(city.name);
let profile=safeProfile({city:city.name,children:true,schedule:'mixed',commute:'car',budget:'low'});
let plan=makePlan(profile,air);
let chatBusy=false;
let forecastWarning='';
let forecastRequestVersion=0;
let toastTimer;

function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','icon');svg.setAttribute('aria-hidden','true');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href',`#i-${name}`);svg.append(use);return svg;}
function clear(node){node.replaceChildren();}
function el(tag, cls, text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;}
function niceNumber(v,digits=1){return Number.isFinite(v)?Number(v).toFixed(digits):'—';}
function toast(message){const n=$('toast');n.textContent=message;n.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('show'),3700);}
function api(path,options){if(standalone)throw new Error('Standalone demo: no connected server.');return fetch(path,{signal:AbortSignal.timeout(16000),...options}).then(async r=>{let body;try{body=await r.json()}catch{throw new Error('Service returned an invalid response.')}if(!r.ok){const error=new Error(body.error||'Service unavailable.');error.status=r.status;throw error;}return body;});}
function show(view){
  for(const [key,label] of Object.entries(navLabels)){
    const section=$(`view-${key}`);section.hidden=key!==view;
    for(const n of document.querySelectorAll(`.nav-item[data-view="${key}"]`)){
      n.classList.toggle('active',key===view);
      if(key===view)n.setAttribute('aria-current','page');else n.removeAttribute('aria-current');
    }
  }
  $('crumb').textContent=navLabels[view]||'Overview';
  $('sidebar').classList.remove('open');$('menu-toggle').setAttribute('aria-expanded','false');
  window.scrollTo({top:0,behavior:'smooth'});
}
function syncProfile(){const f=$('profile-form');profile=safeProfile({city:city.name,schedule:f.elements.schedule.value,commute:f.elements.commute.value,budget:f.elements.budget.value,
  children:$('children').checked,seniors:$('seniors').checked,sensitive:$('sensitive').checked,purifier:$('purifier').checked,
  latitude:city.latitude,longitude:city.longitude});}
function renderSource(){
  const live=air.live===true;
  $('source-notice').classList.toggle('live-notice',live);
  $('source-title').textContent=live?'MODELED FORECAST ACTIVE':(forecastWarning?'FORECAST UNAVAILABLE · DEMO':'ILLUSTRATIVE DEMO');
  $('source-subtitle').textContent=live?`Open-Meteo/CAMS • ${air.timestamp||'time unavailable'} • expires ${new Date(air.snapshotExpiresAt).toLocaleTimeString()} • not a ground monitor`:(forecastWarning?`${forecastWarning} All displayed AQI values are invented examples, not current conditions.`:'Values are invented examples—not measured pollution or current conditions.');
  $('source-pill').textContent=live?'US AQI · FORECAST':'DEMO DATA';
  $('footer-data').textContent=live?'Open-Meteo forecast':(forecastWarning?'Forecast unavailable • invented example':'Invented demo data');
  $('plan-source-badge').textContent=live?'MODELED OPEN-METEO FORECAST':'DEMO SCENARIO';
  $('forecast-detail').textContent=live?'Hourly labels are UTC. Modeled forecast only; check official local alerts.':'Illustrative example, not a real observation or forecast.';
}
function renderMetrics(){
  const c=air.current,band=aqiBand(c.usAqi);
  $('selected-location').textContent=[city.name,city.admin1,city.country].filter(Boolean).join(', ');
  $('current-aqi').textContent=Number.isFinite(c.usAqi)?Math.round(c.usAqi):'—';
  $('current-band').textContent=band.label;
  $('current-pm25').textContent=niceNumber(c.pm25);
  $('current-pm10').textContent=niceNumber(c.pm10);
  $('aqi-description').textContent=band.description;
  $('insight-title').textContent=plan.intensity;
  $('insight-text').textContent=plan.intro;
  renderSource();renderChart();
}
const SVG='http://www.w3.org/2000/svg';
function svgNode(tag,attrs={},text){const n=document.createElementNS(SVG,tag);for(const [key,v] of Object.entries(attrs))n.setAttribute(key,String(v));if(text!==undefined)n.textContent=String(text);return n;}
function renderChart(){
  const graph=$('forecast-chart');clear(graph);
  const points=(air.hours||[]).filter(x=>Number.isFinite(x.usAqi)).slice(0,12);
  if(!points.length){graph.setAttribute('aria-label','No hourly data available');return;}
  const width=720,height=190,left=37,right=20,top=15,bottom=43;
  const all=points.map(p=>p.usAqi);
  const max=Math.max(200,Math.ceil(Math.max(...all)*1.12/50)*50),y=v=>top+(height-top-bottom)*(1-v/max);
  graph.setAttribute('aria-label',`${air.live?'Modeled UTC':'Invented example'} hourly US AQI: ${points.map(x=>`${x.time}: ${Math.round(x.usAqi)}`).join(', ')}`);
  for(const val of [0,Math.round(max/2),max]){
    const yy=y(val);
    graph.append(svgNode('line',{x1:left,y1:yy,x2:width-right,y2:yy,stroke:'#e7efea','stroke-width':1,'stroke-dasharray':'4,5'}));
    graph.append(svgNode('text',{x:left-8,y:yy+4,'text-anchor':'end',fill:'#52636b','font-size':11,'font-family':'Arial'},val));
  }
  const sectionWidth=(width-left-right)/points.length,barWidth=Math.min(35,sectionWidth*.56);
  const table=$('forecast-rows');clear(table);
  points.forEach((p,i)=>{
    const row=el('tr');row.append(el('th','',p.time),el('td','',Math.round(p.usAqi)),el('td','',Number.isFinite(p.pm25)?niceNumber(p.pm25):'Not provided'));table.append(row);
    const xx=left+i*sectionWidth+(sectionWidth-barWidth)/2,yy=y(p.usAqi);
    const fill=p.usAqi<=50?'#6abca0':p.usAqi<=100?'#88bd9b':p.usAqi<=150?'#e3af72':p.usAqi<=200?'#e18d76':'#b57997';
    graph.append(svgNode('rect',{x:xx,y:yy,width:barWidth,height:height-bottom-yy,rx:6,fill}));
    graph.append(svgNode('text',{x:xx+barWidth/2,y:yy-6,'text-anchor':'middle',fill:'#395b50','font-size':10,'font-weight':700,'font-family':'Arial'},Math.round(p.usAqi)));
    if(i%2===0||points.length<=7)graph.append(svgNode('text',{x:xx+barWidth/2,y:height-19,'text-anchor':'middle',fill:'#52636b','font-size':10,'font-family':'Arial'},p.time));
  });
}
function actionIcon(i){return ['sun','cloud','moon'][i]||'leaf';}
function renderPlan(){
  plan=makePlan(profile,air);
  $('plan-intensity').textContent=plan.intensity;
  $('plan-intro').textContent=plan.intro;
  const target=$('plan-action-list');clear(target);
  plan.actions.forEach((a,i)=>{
    const card=el('article','card plan-card');const head=el('div','plan-period');head.append(el('span','',a.period),icon(actionIcon(i)));
    card.append(head,el('h3','',a.title),el('p','',a.detail));
    const why=el('div','why-box');why.append(el('strong','','WHY THIS MATTERS'),el('span','',a.why));
    card.append(why);const tag=el('div','plan-tag',a.tag);tag.style.marginTop='17px';card.append(tag);target.append(card);
  });
  const quick=$('overview-actions');clear(quick);
  plan.actions.forEach((a,i)=>{
    const card=el('article','card overview-action');const bubble=el('span','action-small-icon');bubble.append(icon(actionIcon(i)));
    const body=el('div');body.append(el('div','action-time',a.period),el('h3','',a.title),el('p','',a.detail));card.append(bubble,body);quick.append(card);
  });
  const indoor=$('indoor-grid');clear(indoor);
  plan.indoor.forEach((tip,i)=>{
    const card=el('article','card indoor-guide-card'),ico=el('span','guide-icon');ico.append(icon(['shield','home','wind','spark'][i]||'leaf'));
    const body=el('div');body.append(el('span','indoor-category',tip.category.toUpperCase()),el('h3','',tip.title),el('p','',tip.detail));card.append(ico,body);indoor.append(card);
  });
}
function renderAll(){renderPlan();renderMetrics();}
async function generateBrief(){
  enforceForecastFreshness();
  const button=$('generate-ai-brief');button.disabled=true;
  $('ai-brief-content').textContent='Creating a careful family-specific summary…';
  $('ai-brief-mode').textContent='GENERATING';
  try {
    let brief,mode;
    if(standalone){
      brief=`${plan.intro} Morning: ${plan.actions[0].title}. Afternoon: ${plan.actions[1].title}. Evening: ${plan.actions[2].title}. See the action cards for the reasons.`;
      mode='rules-fallback';
    }else{
      const data=await api('/api/brief',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile,snapshotId:air.snapshotId||undefined})});
      brief=data.brief;mode=data.mode;
    }
    $('ai-brief-content').textContent=brief;
    $('ai-brief-mode').textContent=mode==='gemini'?'GEMINI SUMMARY · REVIEW ADVICE':'RULE-BASED SUMMARY · NO AI GENERATION';
  }catch(e){
    if(air.live && [400,409].includes(e.status)){air=demoAir(city.name);forecastWarning='Forecast token rejected; showing example data until you refresh.';renderAll();}
    $('ai-brief-content').textContent=`AI brief unavailable. ${plan.intro}`;
    $('ai-brief-mode').textContent='SAFE FALLBACK';
  }finally{button.disabled=false;}
}
function enforceForecastFreshness(){
  if(!air.live)return;
  const expiresAt=Date.parse(air.snapshotExpiresAt||'');
  if(!Number.isFinite(expiresAt)||Date.now()>=expiresAt){
    forecastRequestVersion++;
    air=demoAir(city.name);
    forecastWarning='The previous forecast has expired. Reload it before using live recommendations.';
    renderAll();
    return;
  }
}
async function chooseCity(chosen){
  forecastRequestVersion++;
  if(!Number.isFinite(chosen.latitude)||!Number.isFinite(chosen.longitude)){toast('Could not use this location.');return;}
  city={name:chosen.name||'Current location',admin1:chosen.admin1||'',country:chosen.country||'',latitude:chosen.latitude,longitude:chosen.longitude};
  air=demoAir(city.name);forecastWarning='';syncProfile();renderAll();$('city-input').value='';$('search-results').hidden=true;
  toast(`Selected ${city.name}. Showing illustrative data until you load a live forecast.`);
}
async function findCity(event){
  event.preventDefault();const q=$('city-input').value.trim();
  if(q.length<2)return toast('Please type at least two letters.');
  let choices=DEMO_CITIES.filter(x=>[x.name,x.admin1].join(' ').toLowerCase().includes(q.toLowerCase()));
  if(!choices.length&&!standalone){try{const data=await api(`/api/locations?q=${encodeURIComponent(q)}`);choices=data.results||[];}
    catch(e){toast(e.message);}}
  const box=$('search-results');clear(box);box.hidden=false;
  if(!choices.length){box.append(el('p','', 'No cities found. Try New Delhi, Pune, Mumbai, Bengaluru or Lucknow.'));return;}
  choices.slice(0,5).forEach(item=>{
    const btn=el('button');btn.type='button';btn.append(icon('pin'),el('span','',[item.name,item.admin1,item.country].filter(Boolean).join(', ')));
    btn.addEventListener('click',()=>chooseCity(item));box.append(btn);
  });
}
async function loadLive(){
  if(standalone){toast('This standalone preview uses demo data. Run the full Node app for modeled forecasts.');return;}
  const btn=$('try-live');btn.disabled=true;btn.setAttribute('aria-busy','true');btn.textContent='Loading forecast…';
  const requestVersion=++forecastRequestVersion;
  const selected={...city};
  try{
    const r=await api(`/api/air?lat=${encodeURIComponent(selected.latitude)}&lon=${encodeURIComponent(selected.longitude)}&city=${encodeURIComponent(selected.name)}`);
    if(requestVersion!==forecastRequestVersion)return; // Ignore an old request after a city change.
    if(!r.live || !r.snapshotId || !Number.isFinite(Date.parse(r.snapshotExpiresAt)))throw new Error('Provider response did not include a valid expiring forecast.');
    air=r;forecastWarning='';renderAll();toast('Modeled US AQI forecast loaded. Source and timestamp are visible.');
  }catch(e){
    if(requestVersion===forecastRequestVersion){
      // Never leave a previously trusted forecast visible after a failed refresh.
      air=demoAir(city.name);forecastWarning='Live forecast could not be refreshed.';renderAll();
      toast(`${e.message} Showing labeled example data instead.`);
    }
  }finally{btn.disabled=false;btn.removeAttribute('aria-busy');clear(btn);btn.append(icon('refresh'),document.createTextNode(' Load live forecast'));}
}
async function useGeo(){
  if(!navigator.geolocation){toast('Geolocation unavailable; please search by city.');return;}
  navigator.geolocation.getCurrentPosition(async pos=>{
    await chooseCity({name:'Your coordinates',admin1:'Manual location',country:'',latitude:pos.coords.latitude,longitude:pos.coords.longitude});
    await loadLive();
  },()=>toast('Location unavailable or permission denied. Use city search instead.'),{enableHighAccuracy:false,timeout:8500,maximumAge:10*60*1000});
}
function calculateImpact(event){
  event?.preventDefault();
  const km=Number($('distance').value),days=Number($('days').value),option=$('impact-option').value;
  const carFactor=$('car-factor').value, optionFactor=$('alternative-factor').value;
  try {
    const r=travelImpact({distanceKm:km,daysPerWeek:days,option,carFactor,optionFactor});
    $('saved-emissions').textContent=niceNumber(r.savedKg);
    $('baseline-value').textContent=`${niceNumber(r.baselineKg)} kg`;
    $('option-value').textContent=`${niceNumber(r.optionKg)} kg`;
    $('option-label').textContent=$('impact-option').selectedOptions[0]?.textContent||option;
    $('days-output').textContent=`${days} day${days===1?'':'s'} / week`;
    $('baseline-bar').style.width='100%';
    $('option-bar').style.width=`${Math.max(0,Math.min(100,r.baselineKg?100*r.optionKg/r.baselineKg:0))}%`;
    const direction=r.savedKg>=0?'lower':'higher';
    $('impact-explain').textContent=`Historical reference estimate: ${niceNumber(Math.abs(r.savedKg))} kg CO₂e ${direction} than a solo-car trip over ${niceNumber(r.weeklyKm,0)} km per week. No personal exposure change is implied.`;
    $('factor-assumptions').textContent=`Assumptions: solo car ${r.factors.carKgPerKm} kg/km; ${option} ${r.factors.optionKgPerKm} kg/km. Both editable; WRI Table 27 reference, 2018–2021. Not verified current city-specific factors.`;
  }catch(e){toast(e.message);}
}
function exportPlan(){
  enforceForecastFreshness();
  const lines=[`SMOGSAFE AI — DAILY PLAN`, `Location: ${city.name}`, `Data: ${air.live?`MODELED FORECAST • ${air.timestamp}`:'DEMO EXAMPLE (NOT LIVE)'}`,
    `US AQI: ${air.current.usAqi} (${aqiBand(air.current.usAqi).label})`,`Household: ${JSON.stringify(profile)}`,'',plan.intensity,plan.intro,''];
  for(const item of plan.actions)lines.push(`${item.period} — ${item.title}`,item.detail,`Why: ${item.why}`,'');
  lines.push('INDOOR AIR GUIDE');
  for(const tip of plan.indoor)lines.push(`• ${tip.title}: ${tip.detail}`);
  lines.push('',plan.disclaimer,'Data source when live: Open-Meteo / Copernicus CAMS (modeled US AQI, not India AQI).');
  const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='SmogSafe_AI_Family_Plan.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  toast('Your current plan has been downloaded.');
}
function addMessage(message,role){
  const box=$('chat-messages'),item=el('div',`message ${role}`);item.append(el('div','message-identity',role==='assistant'?'SmogSafe AI':'You'),el('p','',message));box.append(item);box.scrollTop=box.scrollHeight;
  return item;
}
async function sendChat(message){
  enforceForecastFreshness();
  if(chatBusy)return;const q=message.trim();if(q.length<3){toast('Ask at least three characters.');return;}
  chatBusy=true;$('send-chat').disabled=true;addMessage(q,'user');$('chat-input').value='';
  const pending=addMessage('Thinking through a practical answer…','assistant');
  try {
    let answer,mode;
    if(standalone){answer=fallbackAnswer(q,profile,air);mode='rules-fallback';}
    else{const r=await api('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,profile,snapshotId:air.snapshotId||undefined})});answer=r.answer;mode=r.mode;}
    pending.querySelector('p').textContent=answer;
    $('chat-mode').replaceChildren(el('span','chat-mode-dot'),document.createTextNode(mode==='gemini'?' Gemini-powered answer':' Transparent rule-based guidance'));
  }catch(e){
    if(air.live && [400,409].includes(e.status)){air=demoAir(city.name);forecastWarning='Forecast token rejected; showing example data until you refresh.';renderAll();}
    pending.querySelector('p').textContent=`The AI service is unavailable. ${fallbackAnswer(q,profile,air)}`;
    $('chat-mode').replaceChildren(el('span','chat-mode-dot'),document.createTextNode(' Safe fallback guidance'));
  }finally{chatBusy=false;$('send-chat').disabled=false;}
}
function updateClock(){const now=new Date();$('clock-date').textContent=now.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}
function start(){
  updateClock();renderAll();calculateImpact();
  for(const n of document.querySelectorAll('[data-view]'))n.addEventListener('click',()=>show(n.dataset.view));
  $('nav-to-plan').addEventListener('click',()=>show('plan'));
  $('profile-form').addEventListener('submit',e=>{e.preventDefault();syncProfile();renderAll();toast('Your household plan has been personalized.');});
  $('city-form').addEventListener('submit',findCity);
  $('use-location').addEventListener('click',useGeo);
  $('try-live').addEventListener('click',loadLive);
  $('menu-toggle').addEventListener('click',()=>{const open=$('sidebar').classList.toggle('open');$('menu-toggle').setAttribute('aria-expanded',String(open));});
  $('generate-ai-brief').addEventListener('click',generateBrief);
  $('overview-share').addEventListener('click',exportPlan);$('download-plan').addEventListener('click',exportPlan);
  $('impact-form').addEventListener('submit',calculateImpact);$('days').addEventListener('input',calculateImpact);
  $('impact-option').addEventListener('change',()=>{$('alternative-factor').value=String(ILLUSTRATIVE_KG_PER_KM[$('impact-option').value]);calculateImpact();});
  $('car-factor').addEventListener('change',calculateImpact);$('alternative-factor').addEventListener('change',calculateImpact);
  $('chat-form').addEventListener('submit',e=>{e.preventDefault();sendChat($('chat-input').value);});
  for(const btn of document.querySelectorAll('[data-question]'))btn.addEventListener('click',()=>{show('copilot');sendChat(btn.dataset.question);});
  if(!standalone)api('/api/health').then(x=>{$('chat-mode').replaceChildren(el('span','chat-mode-dot'),document.createTextNode(x.geminiConfigured?' Gemini is configured':' Rule-based guidance · add Gemini API key for GenAI'));}).catch(()=>{});
  if(standalone){$('try-live').title='Standalone preview: use the runnable app for modeled forecasts.';}
  setInterval(enforceForecastFreshness,30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)enforceForecastFreshness();});
}
start();
