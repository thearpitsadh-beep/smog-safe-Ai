/**
 * Convert Open-Meteo/CAMS modeled, UTC forecasts into a limited US-AQI view.
 * The result is NOT an official ground-monitor observation or Indian AQI.
 */
const numberWithin=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max?value:null;
const parseUtc=value=>{
  if(typeof value!=='string'||!/\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value)) return NaN;
  return Date.parse(/[Zz]|[+-]\d\d:\d\d$/.test(value)?value:`${value}Z`);
};

export function parseAir(data,{now=Date.now()}={}) {
  const current=data?.current;
  const hourly=data?.hourly;
  if(!current||!hourly||!Array.isArray(hourly.time)||!Array.isArray(hourly.us_aqi)){
    throw new Error('Missing forecast fields from provider');
  }
  const aqi=numberWithin(current.us_aqi,0,1000);
  if(aqi===null) throw new Error('Missing or out-of-range US AQI from provider');
  const currentTime=String(current.time||'');
  const timeMs=parseUtc(currentTime);
  const age=now-timeMs;
  if(!Number.isFinite(timeMs)||age>6*3600_000||age<-(3*3600_000)) throw new Error('Provider forecast is stale or future-dated');

  const hours=[];
  let previous=-Infinity;
  for(let i=0;i<hourly.time.length&&hours.length<12;i++){
    const hourMs=parseUtc(hourly.time[i]);
    if(!Number.isFinite(hourMs)||hourMs<timeMs||hourMs<=previous)continue;
    const value=numberWithin(hourly.us_aqi[i],0,1000);
    if(value===null)continue;
    hours.push({time:new Date(hourMs).toISOString().slice(11,16),usAqi:value,
      pm25:numberWithin(hourly.pm2_5?.[i],0,100000)});
    previous=hourMs;
  }
  if(hours.length<2)throw new Error('Forecast hours missing or invalid');
  return {
    live:true,
    source:'Open-Meteo / Copernicus CAMS modeled forecast',
    scale:'US AQI',
    timestamp:new Date(timeMs).toISOString(),
    fetchedAt:new Date(now).toISOString(),
    current:{usAqi:aqi,pm25:numberWithin(current.pm2_5,0,100000),
      pm10:numberWithin(current.pm10,0,100000),no2:numberWithin(current.nitrogen_dioxide,0,100000),
      ozone:numberWithin(current.ozone,0,100000)},
    hours,
    hourTimezone:'UTC',
    providerLink:'https://open-meteo.com/en/docs/air-quality-api',
    disclaimer:'Modeled forecast, not a ground-monitor reading or India national AQI. Follow official local alerts.',
  };
}
