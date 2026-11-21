import { DEMO_CITIES, validCoordinates } from '../shared/location.ts';
import type { AirQualityData, CityLocation, Coordinates, HourlyAirPoint } from '../shared/types.ts';
import { signForecastSnapshot } from './forecastSigning.ts';

const USER_AGENT = 'SmogSafeAI/3.0 (air-quality community app)';
export const FORECAST_TTL_MS = 12 * 60 * 1000;
const GEOCODE_TTL_MS = 24 * 60 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 9500;
const MAX_UPSTREAM_BYTES = 1_000_000;

interface CacheEntry<T> {
  value: T;
  createdAt: number;
}

const upstreamCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export function clearUpstreamCache(): void {
  upstreamCache.clear();
  inFlightRequests.clear();
}

export class UpstreamError extends Error {
  readonly status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

async function readJsonWithByteLimit(response: Response, maxBytes: number): Promise<unknown> {
  const rawLength = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(rawLength) && rawLength > maxBytes) {
    throw new UpstreamError('Air-quality provider payload too large.', 502);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new UpstreamError('Air-quality provider payload too large.', 502);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new UpstreamError('Air-quality provider returned invalid JSON.', 502);
    }
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new UpstreamError('Air-quality provider payload too large.', 502);
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(combined)) as unknown;
  } catch {
    throw new UpstreamError('Air-quality provider returned invalid JSON.', 502);
  }
}

async function fetchJsonWithCache<T>(
  url: URL,
  ttlMs: number,
  fetchFn: typeof fetch = fetch,
): Promise<{ data: T; cacheHit: boolean }> {
  const key = url.toString();
  const cached = upstreamCache.get(key) as CacheEntry<T> | undefined;
  if (cached && Date.now() - cached.createdAt < ttlMs) {
    return { data: cached.value, cacheHit: true };
  }

  const existingFlight = inFlightRequests.get(key) as Promise<T> | undefined;
  if (existingFlight) {
    const data = await existingFlight;
    return { data, cacheHit: true };
  }

  const flight = (async (): Promise<T> => {
    let response: Response;
    try {
      response = await fetchFn(url, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
    } catch (err) {
      const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      throw new UpstreamError(
        isTimeout ? 'Air-quality provider timed out.' : 'Unable to reach air-quality provider.',
        isTimeout ? 504 : 503,
      );
    }

    if (!response.ok) {
      throw new UpstreamError(`Air-quality provider returned status ${response.status}.`, 503);
    }

    const data = await readJsonWithByteLimit(response, MAX_UPSTREAM_BYTES);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new UpstreamError('Air-quality provider returned invalid JSON.', 502);
    }

    upstreamCache.set(key, { value: data, createdAt: Date.now() });
    if (upstreamCache.size > 240) {
      const oldestKey = upstreamCache.keys().next().value;
      if (oldestKey) upstreamCache.delete(oldestKey);
    }
    return data as T;
  })();

  inFlightRequests.set(key, flight);
  try {
    const data = await flight;
    return { data, cacheHit: false };
  } finally {
    inFlightRequests.delete(key);
  }
}

export interface OpenMeteoAirResponse {
  current?: {
    time?: unknown;
    us_aqi?: unknown;
    pm2_5?: unknown;
    pm10?: unknown;
    nitrogen_dioxide?: unknown;
    ozone?: unknown;
  };
  hourly?: {
    time?: unknown[];
    us_aqi?: unknown[];
    pm2_5?: unknown[];
  };
}

function numberWithin(v: unknown, min: number, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

function parseUtcMs(value: unknown): number {
  if (typeof value !== 'string' || !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    return NaN;
  }
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
  return Date.parse(normalized);
}

export function parseOpenMeteoAir(
  raw: OpenMeteoAirResponse,
  locationLabel: string,
  coordinates: Coordinates,
  nowMs = Date.now(),
): AirQualityData {
  if (!validCoordinates(coordinates?.latitude, coordinates?.longitude)) {
    throw new UpstreamError('Invalid coordinates for forecast snapshot.', 400);
  }

  const current = raw?.current;
  const hourly = raw?.hourly;

  if (!current || !hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.us_aqi)) {
    throw new UpstreamError('Incomplete AQI forecast returned by provider.', 502);
  }

  const currentAqi = numberWithin(current.us_aqi, 0, 1000);
  if (currentAqi === null) {
    throw new UpstreamError('Missing or out-of-range US AQI from provider.', 502);
  }

  const timeMs = parseUtcMs(current.time);
  const ageMs = nowMs - timeMs;
  if (!Number.isFinite(timeMs) || ageMs > 6 * 3600_000 || ageMs < -3 * 3600_000) {
    throw new UpstreamError('Provider forecast timestamp is stale or future-dated.', 502);
  }

  const hours: HourlyAirPoint[] = [];
  let prevHourMs = -Infinity;
  for (let i = 0; i < hourly.time.length && hours.length < 12; i++) {
    const hourMs = parseUtcMs(hourly.time[i]);
    if (!Number.isFinite(hourMs) || hourMs < timeMs || hourMs <= prevHourMs) continue;
    const hourAqi = numberWithin(hourly.us_aqi[i], 0, 1000);
    if (hourAqi === null) continue;
    hours.push({
      time: new Date(hourMs).toISOString().slice(11, 16),
      usAqi: hourAqi,
      pm25: numberWithin(hourly.pm2_5?.[i], 0, 100_000),
    });
    prevHourMs = hourMs;
  }

  if (hours.length < 2) {
    throw new UpstreamError('Insufficient valid hourly forecast points from provider.', 502);
  }

  const fetchedAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + FORECAST_TTL_MS).toISOString();

  const snapshot: AirQualityData = {
    live: true,
    source: 'Open-Meteo / Copernicus CAMS modeled forecast',
    scale: 'US AQI',
    scaleNotice: 'US EPA AQI scale (0–500+), distinct from India National AQI (NAQI).',
    locationLabel,
    coordinates: { latitude: coordinates.latitude, longitude: coordinates.longitude },
    hourTimezone: 'UTC',
    timestamp: new Date(timeMs).toISOString(),
    fetchedAt,
    expiresAt,
    current: {
      usAqi: currentAqi,
      pm25: numberWithin(current.pm2_5, 0, 100_000),
      pm10: numberWithin(current.pm10, 0, 100_000),
      no2: numberWithin(current.nitrogen_dioxide, 0, 100_000),
      ozone: numberWithin(current.ozone, 0, 100_000),
    },
    hours,
    providerLink: 'https://open-meteo.com/en/docs/air-quality-api',
    disclaimer:
      'Modeled forecast, not a ground-monitor reading or India NAQI. Follow official local alerts (e.g., CPCB/SAFAR).',
  };

  snapshot.verificationToken = signForecastSnapshot(snapshot);
  return snapshot;
}

export async function fetchLiveAirForecast(
  latitude: number,
  longitude: number,
  locationLabel?: string,
  options: { fetchFn?: typeof fetch; nowMs?: number } = {},
): Promise<AirQualityData> {
  if (!validCoordinates(latitude, longitude)) {
    throw new UpstreamError('Valid latitude and longitude are required.', 400);
  }
  const api = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  api.searchParams.set('latitude', latitude.toFixed(4));
  api.searchParams.set('longitude', longitude.toFixed(4));
  api.searchParams.set('current', 'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone');
  api.searchParams.set('hourly', 'us_aqi,pm2_5');
  api.searchParams.set('forecast_days', '2');
  api.searchParams.set('timezone', 'UTC');

  const { data, cacheHit } = await fetchJsonWithCache<OpenMeteoAirResponse>(
    api,
    FORECAST_TTL_MS,
    options.fetchFn ?? fetch,
  );
  const label =
    locationLabel?.trim().slice(0, 80) ||
    `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
  const parsed = parseOpenMeteoAir(data, label, { latitude, longitude }, options.nowMs ?? Date.now());
  parsed.cacheHit = cacheHit;
  return parsed;
}

interface OpenMeteoGeocodeResponse {
  results?: Array<{
    name?: unknown;
    admin1?: unknown;
    country?: unknown;
    latitude?: unknown;
    longitude?: unknown;
  }>;
}

export async function searchLocations(
  query: string,
  options: { fetchFn?: typeof fetch } = {},
): Promise<CityLocation[]> {
  const qLower = query.toLowerCase();
  const presetMatches = DEMO_CITIES.filter((c) =>
    `${c.name} ${c.admin1}`.toLowerCase().includes(qLower),
  );
  if (presetMatches.length >= 1) {
    return [...presetMatches];
  }

  const endpoint = new URL('https://geocoding-api.open-meteo.com/v1/search');
  endpoint.searchParams.set('name', query);
  endpoint.searchParams.set('count', '5');
  endpoint.searchParams.set('language', 'en');
  endpoint.searchParams.set('format', 'json');

  const { data } = await fetchJsonWithCache<OpenMeteoGeocodeResponse>(
    endpoint,
    GEOCODE_TTL_MS,
    options.fetchFn ?? fetch,
  );
  return (data.results ?? [])
    .filter(
      (x): x is { name: string; admin1?: string; country?: string; latitude: number; longitude: number } =>
        typeof x.name === 'string' &&
        typeof x.latitude === 'number' &&
        Number.isFinite(x.latitude) &&
        typeof x.longitude === 'number' &&
        Number.isFinite(x.longitude),
    )
    .slice(0, 5)
    .map((x) => ({
      name: x.name,
      admin1: typeof x.admin1 === 'string' ? x.admin1 : '',
      country: typeof x.country === 'string' ? x.country : '',
      latitude: x.latitude,
      longitude: x.longitude,
    }));
}
