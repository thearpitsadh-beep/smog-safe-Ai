import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { demoAir } from '../shared/airQuality.ts';
import {
  assertLocationMatchesForecast,
  validCoordinates,
} from '../shared/location.ts';
import type { AirQualityData, Coordinates, HouseholdProfile } from '../shared/types.ts';

const PROCESS_FALLBACK_SECRET = randomBytes(32).toString('hex');

function getSigningSecret(): string {
  const configured = process.env.FORECAST_SIGNING_SECRET?.trim();
  return configured && configured.length >= 16 ? configured : PROCESS_FALLBACK_SECRET;
}

export class ForecastVerificationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ForecastVerificationError';
  }
}

type SignableAir = Pick<
  AirQualityData,
  'live' | 'source' | 'scale' | 'locationLabel' | 'coordinates' | 'timestamp' | 'fetchedAt' | 'expiresAt' | 'current'
>;

function canonicalPayload(air: SignableAir): string {
  const coords = validCoordinates(air.coordinates?.latitude, air.coordinates?.longitude)
    ? {
        latitude: air.coordinates!.latitude,
        longitude: air.coordinates!.longitude,
      }
    : null;

  return JSON.stringify({
    live: air.live === true,
    source: air.source,
    scale: air.scale,
    locationLabel: air.locationLabel ?? '',
    coordinates: coords,
    timestamp: air.timestamp ?? null,
    fetchedAt: air.fetchedAt ?? null,
    expiresAt: air.expiresAt ?? null,
    current: {
      usAqi: air.current.usAqi,
      pm25: air.current.pm25 ?? null,
      pm10: air.current.pm10 ?? null,
      no2: air.current.no2 ?? null,
      ozone: air.current.ozone ?? null,
    },
  });
}

export function signForecastSnapshot(air: SignableAir): string {
  const hmac = createHmac('sha256', getSigningSecret());
  hmac.update(canonicalPayload(air));
  return hmac.digest('base64url');
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function cleanMetric(value: unknown, min = 0, max = 10000): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : null;
}

export function verifyForecastSnapshot(inputAir: unknown, nowMs = Date.now()): AirQualityData {
  if (!isPlainObject(inputAir)) {
    throw new ForecastVerificationError('Invalid air quality payload.');
  }
  if (inputAir.live !== true) {
    throw new ForecastVerificationError('Snapshot is not marked live.');
  }

  const token = typeof inputAir.verificationToken === 'string' ? inputAir.verificationToken.trim() : '';
  if (!token) {
    throw new ForecastVerificationError(
      'Forged or unverified live air data rejected: missing server forecast verification token.',
    );
  }

  const fetchedAt = typeof inputAir.fetchedAt === 'string' ? inputAir.fetchedAt : '';
  const expiresAt = typeof inputAir.expiresAt === 'string' ? inputAir.expiresAt : '';
  const expiresMs = Date.parse(expiresAt);
  if (!fetchedAt || !expiresAt || !Number.isFinite(expiresMs)) {
    throw new ForecastVerificationError(
      'Unverified live air data rejected: missing forecast issuance or expiry metadata.',
    );
  }
  if (nowMs > expiresMs) {
    throw new ForecastVerificationError(
      'Live forecast snapshot has expired. Please load a fresh live forecast.',
    );
  }

  if (!isPlainObject(inputAir.coordinates) || !validCoordinates(inputAir.coordinates.latitude, inputAir.coordinates.longitude)) {
    throw new ForecastVerificationError(
      'Unverified live air data rejected: missing forecast coordinates.',
    );
  }
  const coordinates: Coordinates = {
    latitude: inputAir.coordinates.latitude as number,
    longitude: inputAir.coordinates.longitude as number,
  };

  if (!isPlainObject(inputAir.current)) {
    throw new ForecastVerificationError('Unverified live air data rejected: missing measurements.');
  }
  const usAqi = cleanMetric(inputAir.current.usAqi, 0, 1000);
  if (usAqi === null) {
    throw new ForecastVerificationError('Unverified live air data rejected: invalid US AQI value.');
  }

  const candidate: AirQualityData = {
    live: true,
    source: typeof inputAir.source === 'string' ? inputAir.source : '',
    scale: inputAir.scale === 'US AQI' ? 'US AQI' : 'US AQI',
    scaleNotice:
      typeof inputAir.scaleNotice === 'string'
        ? inputAir.scaleNotice
        : 'US EPA AQI scale (distinct from India NAQI).',
    locationLabel: typeof inputAir.locationLabel === 'string' ? inputAir.locationLabel : '',
    coordinates,
    hourTimezone: inputAir.hourTimezone === 'UTC' ? 'UTC' : undefined,
    timestamp: typeof inputAir.timestamp === 'string' ? inputAir.timestamp : null,
    fetchedAt,
    expiresAt,
    verificationToken: token,
    current: {
      usAqi,
      pm25: cleanMetric(inputAir.current.pm25),
      pm10: cleanMetric(inputAir.current.pm10),
      no2: cleanMetric(inputAir.current.no2),
      ozone: cleanMetric(inputAir.current.ozone),
    },
    hours: Array.isArray(inputAir.hours)
      ? inputAir.hours
          .filter(
            (h): h is { time: string; usAqi: number; pm25: number | null } =>
              isPlainObject(h) &&
              typeof h.time === 'string' &&
              typeof h.usAqi === 'number' &&
              Number.isFinite(h.usAqi),
          )
          .slice(0, 12)
      : [],
  };

  const expected = signForecastSnapshot(candidate);
  const actualBuf = Buffer.from(token, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    throw new ForecastVerificationError(
      'Tampered or unverified live air data rejected: forecast signature mismatch.',
    );
  }

  return candidate;
}

/**
 * Resolves authoritative AirQualityData for planning, brief, and AI chat endpoints.
 * - If client claims `live: true`, strictly requires an unexpired HMAC-signed snapshot
 *   geographically bound to the household's selected city/coordinates.
 * - Otherwise, returns the canonical illustrative demo scenario for the selected city.
 */
export function resolveAuthoritativeAir(
  inputAir: unknown,
  profileOrCity: string | Partial<HouseholdProfile>,
  nowMs = Date.now(),
): AirQualityData {
  const profileObj: Partial<HouseholdProfile> =
    typeof profileOrCity === 'string' ? { city: profileOrCity } : profileOrCity;
  const cityName = profileObj.city || 'New Delhi';

  if (isPlainObject(inputAir) && inputAir.live === true) {
    const verified = verifyForecastSnapshot(inputAir, nowMs);
    assertLocationMatchesForecast(profileObj, verified);
    return verified;
  }
  return demoAir(cityName);
}
