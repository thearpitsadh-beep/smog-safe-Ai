import type { AirQualityData, CityLocation, Coordinates, HouseholdProfile } from './types.ts';

export const DEMO_CITIES: readonly CityLocation[] = [
  { name: 'New Delhi', admin1: 'Delhi', country: 'India', latitude: 28.6139, longitude: 77.209 },
  { name: 'Pune', admin1: 'Maharashtra', country: 'India', latitude: 18.5204, longitude: 73.8567 },
  { name: 'Mumbai', admin1: 'Maharashtra', country: 'India', latitude: 19.076, longitude: 72.8777 },
  { name: 'Bengaluru', admin1: 'Karnataka', country: 'India', latitude: 12.9716, longitude: 77.5946 },
  { name: 'Lucknow', admin1: 'Uttar Pradesh', country: 'India', latitude: 26.8467, longitude: 80.9462 },
];

export class LocationMismatchError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = 'LocationMismatchError';
  }
}

function normalizeCityKey(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLocaleLowerCase('en').replace(/[^a-z0-9]/g, '')
    : '';
}

export function validCoordinates(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/** Approximate great-circle distance between two WGS84 points, in kilometres. */
export function distanceKm(
  a: Partial<Coordinates> | null | undefined,
  b: Partial<Coordinates> | null | undefined,
): number {
  if (!a || !b || !validCoordinates(a.latitude, a.longitude) || !validCoordinates(b.latitude, b.longitude)) {
    return Infinity;
  }
  const rad = Math.PI / 180;
  const aLat = (a.latitude as number) * rad;
  const bLat = (b.latitude as number) * rad;
  const latDelta = ((b.latitude as number) - (a.latitude as number)) * rad;
  const lonDelta = ((b.longitude as number) - (a.longitude as number)) * rad;
  const h =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(aLat) * Math.cos(bLat) * Math.sin(lonDelta / 2) ** 2;
  return 6371.009 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function knownLocation(name: unknown): CityLocation | null {
  const needle = normalizeCityKey(name);
  if (!needle) return null;
  return DEMO_CITIES.find((c) => normalizeCityKey(c.name) === needle) ?? null;
}

export function assertCityCoordinates(
  cityName: unknown,
  coordinates: Partial<Coordinates> | null | undefined,
  { cityRadiusKm = 35 }: { cityRadiusKm?: number } = {},
): boolean {
  if (!validCoordinates(coordinates?.latitude, coordinates?.longitude)) {
    throw new LocationMismatchError('Coordinates are missing or invalid.');
  }
  const known = knownLocation(cityName);
  if (known && distanceKm(known, coordinates) > cityRadiusKm) {
    throw new LocationMismatchError('City label does not match requested coordinates.');
  }
  return true;
}

/**
 * Ensures a live server-signed forecast snapshot geographically matches both the
 * user's selected city label (when known) and household coordinates.
 */
export function assertLocationMatchesForecast(
  profile: Partial<HouseholdProfile> | null | undefined,
  record: Pick<AirQualityData, 'coordinates'> | null | undefined,
  {
    snapshotRadiusKm = 5,
    cityRadiusKm = 35,
  }: { snapshotRadiusKm?: number; cityRadiusKm?: number } = {},
): boolean {
  const forecastPoint = record?.coordinates;
  if (!validCoordinates(forecastPoint?.latitude, forecastPoint?.longitude)) {
    throw new LocationMismatchError('Forecast provenance is missing coordinates.');
  }

  const knownCity = knownLocation(profile?.city);
  const explicitCoords = validCoordinates(profile?.latitude, profile?.longitude)
    ? { latitude: profile!.latitude as number, longitude: profile!.longitude as number }
    : null;

  if (knownCity && distanceKm(knownCity, forecastPoint) > cityRadiusKm) {
    throw new LocationMismatchError('Selected city does not match the live forecast location.');
  }
  if (knownCity && explicitCoords && distanceKm(knownCity, explicitCoords) > cityRadiusKm) {
    throw new LocationMismatchError('Selected city does not match household coordinates.');
  }

  const intended = explicitCoords ?? knownCity;
  if (!intended) {
    throw new LocationMismatchError('Select a location with coordinates before using a live forecast.');
  }
  if (distanceKm(intended, forecastPoint) > snapshotRadiusKm) {
    throw new LocationMismatchError('Household location does not match the live forecast snapshot.');
  }
  return true;
}
