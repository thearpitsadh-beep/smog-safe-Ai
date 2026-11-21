/** Pure, side-effect-free rules for SmogSafe AI. No health diagnosis or inferred exposure dose. */
export const DEMO_CITIES = [
  { name: 'New Delhi', admin1: 'Delhi', country: 'India', latitude: 28.6139, longitude: 77.2090 },
  { name: 'Pune', admin1: 'Maharashtra', country: 'India', latitude: 18.5204, longitude: 73.8567 },
  { name: 'Mumbai', admin1: 'Maharashtra', country: 'India', latitude: 19.0760, longitude: 72.8777 },
  { name: 'Bengaluru', admin1: 'Karnataka', country: 'India', latitude: 12.9716, longitude: 77.5946 },
  { name: 'Lucknow', admin1: 'Uttar Pradesh', country: 'India', latitude: 26.8467, longitude: 80.9462 },
];

// Values are invented EXAMPLES, never measurements. Display an unmissable demo banner.
export const DEMO_AIR = Object.freeze({
  'New Delhi': { usAqi: 184, pm25: 82.6, pm10: 140.4, no2: 33.1, ozone: 65, trend: [178,184,181,177,172,166,171,176,181,190,196,188] },
  'Pune': { usAqi: 112, pm25: 37.4, pm10: 72.1, no2: 18.6, ozone: 42, trend: [105,109,112,114,108,101,95,92,98,105,111,106] },
  'Mumbai': { usAqi: 98, pm25: 32.1, pm10: 60.8, no2: 21.2, ozone: 36, trend: [92,95,98,102,108,104,98,94,89,86,90,92] },
  'Bengaluru': { usAqi: 76, pm25: 22.8, pm10: 41.6, no2: 19.0, ozone: 31, trend: [72,76,71,69,66,63,65,69,72,74,73,70] },
  'Lucknow': { usAqi: 201, pm25: 98.3, pm10: 158.2, no2: 39.5, ozone: 57, trend: [192,201,206,198,195,189,185,182,194,208,215,205] },
});

export function demoAir(city = 'New Delhi') {
  const data = DEMO_AIR[city] || DEMO_AIR['New Delhi'];
  const hours = data.trend.map((usAqi, i) => ({
    time: `${String((8 + i) % 24).padStart(2,'0')}:00`,
    usAqi,
    pm25: Number((data.pm25 * usAqi / data.usAqi).toFixed(1)),
  }));
  return { source: 'DEMO ONLY — invented example, not a real reading', live: false,
    timestamp: null, scale: 'US AQI', current: { usAqi: data.usAqi, pm25: data.pm25, pm10: data.pm10, no2: data.no2, ozone: data.ozone }, hours };
}

export function aqiBand(aqi) {
  if (!Number.isFinite(aqi) || aqi < 0) return { label:'Unavailable', level:'unknown', description:'Air-quality data unavailable', color:'#60737a' };
  if (aqi <= 50) return {label:'Good', level:'good', description:'Air quality is generally satisfactory.', color:'#2a9476'};
  if (aqi <= 100) return {label:'Moderate', level:'moderate', description:'Unusually sensitive people may need extra care.', color:'#bd8b23'};
  if (aqi <= 150) return {label:'Unhealthy for sensitive groups', level:'sensitive', description:'Children, older adults and people with health conditions may be more affected.', color:'#cc7425'};
  if (aqi <= 200) return {label:'Unhealthy', level:'unhealthy', description:'Consider reducing prolonged or strenuous outdoor activity.', color:'#cf5648'};
  if (aqi <= 300) return {label:'Very unhealthy', level:'very-unhealthy', description:'Health alert: reduce outdoor exposure; sensitive people need extra care.', color:'#99498b'};
  return {label:'Hazardous', level:'hazardous', description:'Health warning: avoid outdoor exertion when possible.', color:'#7c3448'};
}

export function safeProfile(input={}) {
  if(!input || typeof input!=='object' || Array.isArray(input)) input={};
  const allowed={commute:['car','bus','metro','walk','cycle','remote'], budget:['low','medium','flexible'],
    schedule:['school','office','home','mixed']};
  const str=(val, fallback, n=80)=>{
    if(typeof val!=='string')return fallback;
    const clean=val.normalize('NFKC').replace(/[\x00-\x1f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,n);
    // Treat attempts to disguise imperative instructions as city names as invalid location input.
    return clean&&!/\b(?:ignore (?:all )?(?:previous|system)|reveal (?:the )?(?:system prompt|api key))\b/i.test(clean)?clean:fallback;
  };
  return {
    city: str(input.city,'New Delhi',80),
    latitude:Number.isFinite(input.latitude)&&input.latitude>=-90&&input.latitude<=90?input.latitude:null,
    longitude:Number.isFinite(input.longitude)&&input.longitude>=-180&&input.longitude<=180?input.longitude:null,
    schedule:allowed.schedule.includes(input.schedule)?input.schedule:'mixed',
    commute:allowed.commute.includes(input.commute)?input.commute:'car',
    budget:allowed.budget.includes(input.budget)?input.budget:'low',
    children:input.children===true, seniors:input.seniors===true,
    sensitive:input.sensitive===true, purifier:input.purifier===true,
  };
}

function action(period, title, detail, why, tag) { return {period,title,detail,why,tag}; }

/** Deterministic recommendation engine; AI chat is supplementary and not authoritative. */
export function makePlan(inputProfile, inputAir) {
  const p=safeProfile(inputProfile);
  const current=inputAir?.current || {};
  const aqi=Number.isFinite(current.usAqi) ? current.usAqi : null;
  const band=aqiBand(aqi);
  const poor=aqi!==null && aqi>100;
  const severe=aqi!==null && aqi>150;
  const sensitive=p.children||p.seniors||p.sensitive;
  const vulnerable=sensitive?' especially for children, older adults and sensitive household members':'';
  const action1 = severe
    ? action('MORNING','Choose lower-exposure morning activities', 'Keep strenuous exercise indoors where practical. If school or work travel is essential, limit time near busy roads and monitor official local alerts.','Pollution can be higher during severe smog. Avoiding unnecessary exposure may reduce time spent in polluted outdoor air.','Exposure')
    : poor ? action('MORNING','Make outdoor time more intentional','Consider quieter streets and shorter outdoor exertion for sensitive family members. Check the next hours before planning exercise.','Conditions may pose more risk to sensitive groups; there is no universally safe outdoor hour.','Exposure')
    : action('MORNING','Plan outdoor time with the forecast','Normal activity may be reasonable; sensitive household members should still monitor conditions.','Current modeled US AQI is not in the high-risk bands.','Routine');
  const scheduleAdvice={
    school:'For school days, check school notices and choose a safe, shorter waiting spot instead of prolonged roadside queues.',
    office:'For office days, consider staggered departure or remote meetings where feasible, without assuming this removes all exposure.',
    home:'When mostly at home, prioritize avoiding smoke from indoor activities and check outdoor conditions before ventilation.',
    mixed:'Coordinate school, work and errands to reduce unnecessary travel, while keeping essential trips practical.'
  };
  const morning={...action1,detail:`${action1.detail} ${scheduleAdvice[p.schedule]}`};
  const commuteActions = {
    car: ['Combine essential journeys','Group errands and avoid idling where safe. Consider shared trips or remote work when feasible.','Fewer vehicle kilometres can reduce direct transport emissions.'],
    bus: ['Use public transit intentionally','Choose less busy stops away from traffic when practical; track route and time spent outdoors.','Shared transit generally spreads emissions across more passengers; personal exposure still depends on route and vehicle.'],
    metro: ['Make the most of metro travel','Prefer metro for suitable routes and choose less congested walking connections where feasible.','Electric rail can reduce car kilometres; actual emissions depend on electricity supply and ridership.'],
    walk: ['Choose a cleaner walking route','Use lower-traffic streets when safe, and reduce strenuous outdoor travel during poor-air episodes.','Walking avoids tailpipe emissions, but high outdoor pollution can change the exposure trade-off.'],
    cycle: ['Balance low-emission cycling with exposure','Cycle on protected low-traffic routes when air conditions allow; avoid intense exertion in severe smog.','Cycling avoids tailpipe emissions but increases breathing rate during exercise.'],
    remote: ['Keep your remote-work advantage','Use remote work to avoid unnecessary car journeys and make indoor air quality a priority.','Avoiding a commute can reduce the associated transport emissions.'],
  };
  const [ct,cd,cw]=commuteActions[p.commute];
  const action2=action('AFTERNOON',ct,cd,cw,'Lower emissions');
  const action3 = p.schedule==='school'||p.children
    ? action('EVENING','Reset the home after the school day', 'Keep shoes and dusty outerwear near the entrance, damp-dust surfaces, and choose indoor play when outdoor air is poor.','Source control and surface cleaning help reduce resuspended dust; they are not substitutes for filtration.','Home care')
    : action('EVENING','Create a cleaner home routine', 'Avoid burning incense or candles; use kitchen exhaust when appropriate and check outdoor conditions before opening windows.','Reducing indoor sources can lower indoor particle generation.','Home care');
  const indoor=[
    { title:'Stop pollution at the source', detail:'Skip incense, indoor smoking, unnecessary candles and smoky cooking. Prefer cleaner cooking methods.', icon:'source', category:'Free or low cost' },
    { title:'Keep indoor dust controlled', detail:'Damp-dust rather than dry sweeping. Use a vacuum with appropriate particle filtration if available.', icon:'spark', category:'Low cost' },
    { title:'Ventilate with context', detail:'Ventilation can help indoor-generated pollutants, but opening windows during severe outdoor smog can also bring pollution inside. Check conditions first.', icon:'wind', category:'Situation dependent' },
    ...(p.purifier || p.budget!=='low' ? [{ title:'Use effective particle filtration', detail:p.purifier?'Run your appropriately sized HEPA purifier in the most-used room; follow filter instructions.':'If budget permits, compare appropriately sized HEPA purifiers with clear replacement-filter costs. Avoid ozone-generating devices.', icon:'filter', category:'Optional purchase' }] :
      [{ title:'Start with free source controls', detail:'Focus on avoiding smoke sources and reducing dust before buying anything. Do not assume plants alone solve indoor particulate pollution.', icon:'leaf', category:'No equipment required' }]),
  ];
  const swaps=[
    { title:'Combine errands', effect:'Fewer car kilometres', description:'Coordinate shopping and appointments into fewer vehicle trips.', icon:'car' },
    { title:'Choose shared or electric transport', effect:'Potential transport emissions reduction', description:'Compare practical transit options for your route; personal exposure may differ.', icon:'train' },
    { title:'Avoid smoke-producing activities', effect:'Less indoor particle generation', description:'Skip incense, burning waste and unnecessary open flames.', icon:'home' },
  ];
  const note=aqi===null?'No reliable AQI available: recommendations are general, not based on live air conditions.':
    `Based on ${inputAir?.live?'modeled forecast data':'illustrative example data'}: US AQI ${Math.round(aqi)} (${band.label.toLowerCase()}).`;
  return {
    status:band, note, profile:p, intensity:severe?'Take extra care today':poor?'Plan thoughtfully today':'Make the most of your day',
    intro:severe?`Pollution conditions suggest limiting unnecessary outdoor exertion${vulnerable}.`:
      poor?`A more cautious routine can help${vulnerable}.`:'Build a practical, lower-emission routine around your family.',
    actions:[morning,action2,action3],indoor,swaps,
    disclaimer:'General environmental information, not medical advice. Official local alerts and a clinician’s advice take priority for health concerns.',
  };
}

/**
 * Historical benchmark used by WRI for non-US (including India) employee commuting,
 * Table 27, 2018–2021. These are NOT certified current India emission factors.
 * kg CO2e per distance km under the referenced commute assumptions. Electricity,
 * occupancy and actual vehicle fleet can differ; zero for walking/remote denotes
 * avoided *transport operating* emissions only, not all life-cycle impacts.
 * Source: https://www.wri.org/sustainability-wri/dashboard/methodology
 */
export const REFERENCE_KG_PER_KM=Object.freeze({car:0.18368,bus:0.10097,metro:0.0376,walk:0,cycle:0,remote:0});
// Keep the public name stable for the existing frontend; these are now cited historical benchmarks.
export const ILLUSTRATIVE_KG_PER_KM=REFERENCE_KG_PER_KM;
export const TRANSPORT_SOURCE=Object.freeze({
  name:'World Resources Institute, Sustainability Dashboard Methodology, Table 27',
  years:'2018–2021',
  url:'https://www.wri.org/sustainability-wri/dashboard/methodology',
  scope:'Non-US commuting reference factors (includes India), not a verified 2026 city-specific inventory',
});
export function travelImpact({distanceKm=12, daysPerWeek=5, option='metro', carFactor=REFERENCE_KG_PER_KM.car, optionFactor=null}={}) {
  const km=Number(distanceKm),days=Number(daysPerWeek);
  if(!Number.isFinite(km)||km<0||km>300||!Number.isInteger(days)||days<0||days>7) throw new RangeError('Distance must be 0–300 km and days 0–7');
  if(!Object.hasOwn(REFERENCE_KG_PER_KM,option)) throw new RangeError('Unsupported transport mode');
  const solo=Number(carFactor);
  const alternative=optionFactor===null?REFERENCE_KG_PER_KM[option]:Number(optionFactor);
  if(!Number.isFinite(solo)||solo<0||solo>2||!Number.isFinite(alternative)||alternative<0||alternative>2) throw new RangeError('Emission factors must be between 0 and 2 kg CO2e/km');
  const weeklyKm=km*2*days;
  const baseline=weeklyKm*solo;
  const choice=weeklyKm*alternative;
  const isReference=solo===REFERENCE_KG_PER_KM.car && alternative===REFERENCE_KG_PER_KM[option];
  const basis=isReference?'historical-WRI-reference':'user-edited-scenario';
  return {weeklyKm, baselineKg:round(baseline), optionKg:round(choice), savedKg:round(baseline-choice), option,
    factors:{carKgPerKm:solo,optionKgPerKm:alternative},basis,
    methodologyUrl:TRANSPORT_SOURCE.url,methodology:TRANSPORT_SOURCE.name,factorVintage:TRANSPORT_SOURCE.years,
    factorStatus:isReference?'WRI published historical commuting factors (2018–2021); not verified Indian city-specific/current values':'User-edited scenario; not verified Indian city-specific/current values',
    note:'Historical reference or editable scenario estimate only. One-way distance × 2 × travel days × kg CO2e/km. NOT a measurement, NOT personal inhaled-pollution exposure, total vehicle life cycle, or health benefit.'};
}
const round=n=>Math.round(n*10)/10;

export function fallbackAnswer(query, profile={}, air={}) {
  const q=String(query||'').toLowerCase();
  const band=aqiBand(air?.current?.usAqi);
  if (/api key|secret|system prompt|developer message|ignore previous|password|token/i.test(q))
    return 'I can help with cleaner-air choices, but I cannot disclose private settings or credentials. Ask me about commuting, indoor air or daily routines.';
  if (/asthma|pregnan|baby|infant|chest pain|breath|medical|hospital|medicine|symptom|cough/i.test(q))
    return 'Air pollution can affect sensitive people differently. Consider reducing outdoor exertion during high-pollution periods and follow official local alerts. I cannot diagnose symptoms or recommend treatment. For concerning or urgent symptoms, seek professional medical care.';
  if (/indoor|room|home|window|purif|filter|plant|incense|ventilat/i.test(q))
    return 'Begin with indoor source control: avoid smoke from incense, cigarettes and candles; damp-dust surfaces; use kitchen exhaust when appropriate. An appropriately sized HEPA purifier can reduce airborne particles when used correctly. Opening windows depends on outdoor conditions—during severe smog they can bring more pollution inside. Plants alone are not a reliable substitute for filtration.';
  if (/commut|bus|metro|cycle|walk|travel|car|emission|carbon/i.test(q))
    return 'First ask whether the trip is necessary. If it is, compare metro, shared transport and grouped errands with your current journey. The Impact Lab gives a historical-reference emissions comparison, not a guarantee of lower personal pollution exposure. For walking or cycling, choose safer, lower-traffic routes and reconsider strenuous activity when pollution is high.';
  if (/school|child|parent|senior|elder|kid|outdoor|run|exercise/i.test(q))
    return `For ${safeProfile(profile).city}, the current ${air?.live?'modeled forecast':'demo scenario'} is ${band.label.toLowerCase()}. Adjust prolonged outdoor exercise according to local official advisories, especially for children and older adults. Favor lower-traffic routes, shorter unavoidable outdoor stops and indoor activities when conditions are poor.`;
  if (/what|aqi|pollut|smog|pm2/i.test(q))
    return `US AQI expresses outdoor air-quality conditions on a health-related index. The currently selected ${air?.live?'modeled forecast':'illustrative scenario'} is ${air?.current?.usAqi??'unavailable'} (${band.label}). PM2.5 refers to fine particles measured in micrograms per cubic metre. See the hourly outlook and source label, and check official local air-quality warnings.`;
  return `For your ${safeProfile(profile).city} household, start with three steps: (1) check the forecast and local alerts before outdoor exertion; (2) reduce indoor smoke and dust sources; (3) combine car journeys or use suitable shared transit when practical. This is general guidance${air?.live?' using modeled forecasts':' from a demo scenario'}; ask about commuting, indoor air or family routines for details.`;
}
