/** Pure geospatial invariants. Never trust a city label to prove the forecast's coordinates. */
import { DEMO_CITIES } from './logic.mjs';

const normalize = value => typeof value === 'string'
  ? value.trim().toLocaleLowerCase('en').replace(/[^a-z0-9]/g,'') : '';

export const validCoordinates = (latitude, longitude) => Number.isFinite(latitude) && Number.isFinite(longitude)
  && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;

/** Approximate great-circle distance between two points, in kilometres. */
export function distanceKm(a,b) {
  if(!a || !b || !validCoordinates(a.latitude,a.longitude) || !validCoordinates(b.latitude,b.longitude)) return Infinity;
  const d=Math.PI/180;
  const aLat=a.latitude*d,bLat=b.latitude*d;
  const latDelta=(b.latitude-a.latitude)*d;
  const lonDelta=(b.longitude-a.longitude)*d;
  const h=Math.sin(latDelta/2)**2+Math.cos(aLat)*Math.cos(bLat)*Math.sin(lonDelta/2)**2;
  return 6371.009*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}

export function knownLocation(name) {
  const needle=normalize(name);
  if(!needle) return null;
  return DEMO_CITIES.find(city=>normalize(city.name)===needle) || null;
}

/**
 * A known city label and user coordinates may be close (within 35 km), but cannot describe
 * different metropolitan areas. This only protects the known built-in cities: geocoded labels
 * are user-provided display text and MUST NOT be treated as independently authenticated.
 */
export function assertLocationMatchesForecast(profile,record,{snapshotRadiusKm=5,cityRadiusKm=35}={}) {
  const forecastPoint=record?.coordinates;
  if(!validCoordinates(forecastPoint?.latitude,forecastPoint?.longitude)) throw new Error('Forecast provenance is missing coordinates');
  const city=knownLocation(profile?.city);
  const explicit=validCoordinates(profile?.latitude,profile?.longitude)
    ? {latitude:profile.latitude,longitude:profile.longitude} : null;
  if(city && distanceKm(city,forecastPoint)>cityRadiusKm) throw new Error('Selected city does not match the forecast location');
  if(city && explicit && distanceKm(city,explicit)>cityRadiusKm) throw new Error('Selected city does not match household coordinates');
  const intended=explicit||city;
  if(!intended) throw new Error('Choose a location with coordinates before using a live forecast');
  if(distanceKm(intended,forecastPoint)>snapshotRadiusKm) throw new Error('Household location does not match the forecast snapshot');
  return true;
}

export function assertCityCoordinates(cityName,coordinates,{cityRadiusKm=35}={}) {
  const known=knownLocation(cityName);
  if(known && distanceKm(known,coordinates)>cityRadiusKm) throw new Error('City label does not match coordinates');
  return true;
}
