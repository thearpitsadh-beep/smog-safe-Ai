import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LocationMismatchError,
  assertCityCoordinates,
  assertLocationMatchesForecast,
  distanceKm,
  knownLocation,
  validCoordinates,
} from '../src/shared/location.ts';
import {
  clearUpstreamCache,
  fetchLiveAirForecast,
  parseOpenMeteoAir,
} from '../src/server/openMeteo.ts';
import {
  resolveAuthoritativeAir,
  signForecastSnapshot,
  verifyForecastSnapshot,
} from '../src/server/forecastSigning.ts';
import type { AirQualityData } from '../src/shared/types.ts';

function isoHourOffset(baseMs: number, offsetHours: number): string {
  return new Date(baseMs + offsetHours * 3600_000).toISOString().slice(0, 16);
}

test('Geospatial utilities validate coordinates and compute accurate distances', () => {
  assert.equal(validCoordinates(28.6139, 77.209), true);
  assert.equal(validCoordinates(91, 0), false);
  assert.equal(validCoordinates(28, 181), false);
  assert.equal(validCoordinates(NaN, 77), false);

  const delhiToMumbai = distanceKm(
    { latitude: 28.6139, longitude: 77.209 },
    { latitude: 19.076, longitude: 72.8777 },
  );
  assert.ok(delhiToMumbai > 1100 && delhiToMumbai < 1200);
  assert.equal(knownLocation('new delhi')?.name, 'New Delhi');
  assert.equal(knownLocation('Atlantis'), null);
});

test('assertCityCoordinates rejects known city label bound to wrong coordinates', () => {
  assert.equal(
    assertCityCoordinates('New Delhi', { latitude: 28.62, longitude: 77.21 }),
    true,
  );
  assert.throws(
    () => assertCityCoordinates('Mumbai', { latitude: 28.6139, longitude: 77.209 }),
    LocationMismatchError,
  );
});

test('Signed live forecast binds geographic coordinates and rejects cross-city replay', () => {
  const now = Date.now();
  const delhiAir: AirQualityData = {
    live: true,
    source: 'Open-Meteo / Copernicus CAMS modeled forecast',
    scale: 'US AQI',
    scaleNotice: 'US EPA AQI scale (distinct from India NAQI).',
    locationLabel: 'New Delhi',
    coordinates: { latitude: 28.6139, longitude: 77.209 },
    timestamp: new Date(now).toISOString(),
    fetchedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60_000).toISOString(),
    hourTimezone: 'UTC',
    current: { usAqi: 195, pm25: 90, pm10: 150, no2: 34, ozone: 61 },
    hours: [
      { time: '12:00', usAqi: 195, pm25: 90 },
      { time: '13:00', usAqi: 188, pm25: 85 },
    ],
  };
  delhiAir.verificationToken = signForecastSnapshot(delhiAir);

  // Tampering coordinates inside payload breaks signature
  assert.throws(
    () =>
      verifyForecastSnapshot(
        { ...delhiAir, coordinates: { latitude: 19.076, longitude: 72.8777 } },
        now,
      ),
    /signature/i,
  );

  // Using New Delhi snapshot with Mumbai profile triggers LocationMismatchError
  assert.throws(
    () =>
      resolveAuthoritativeAir(
        delhiAir,
        {
          city: 'Mumbai',
          country: 'India',
          latitude: 19.076,
          longitude: 72.8777,
          schedule: 'mixed',
          commute: 'car',
          budget: 'low',
          children: false,
          seniors: false,
          sensitive: false,
          purifier: false,
        },
        now,
      ),
    LocationMismatchError,
  );

  // Unknown city label without explicit coordinates also fails live snapshot binding
  assert.throws(
    () =>
      assertLocationMatchesForecast(
        { city: 'Custom Town' },
        { coordinates: { latitude: 28.6139, longitude: 77.209 } },
      ),
    LocationMismatchError,
  );
});

test('parseOpenMeteoAir normalizes UTC timestamps and rejects stale, future, negative, or chaotic hours', () => {
  const now = Date.parse('2026-11-20T12:15:00Z');
  const validRaw = {
    current: {
      time: '2026-11-20T12:00',
      us_aqi: 145,
      pm2_5: 55.2,
      pm10: 95.1,
      nitrogen_dioxide: 21.4,
      ozone: 41.2,
    },
    hourly: {
      time: [
        '2026-11-20T11:00', // past hour relative to current.time -> skipped
        '2026-11-20T12:00',
        '2026-11-20T13:00',
        '2026-11-20T12:30', // non-chronological duplicate/earlier -> skipped
        '2026-11-20T14:00',
      ],
      us_aqi: [160, 145, 140, 999, 132],
      pm2_5: [60, 55.2, 51.0, 10, -5],
    },
  };

  const parsed = parseOpenMeteoAir(validRaw, 'Pune', { latitude: 18.5204, longitude: 73.8567 }, now);
  assert.equal(parsed.hourTimezone, 'UTC');
  assert.equal(parsed.timestamp, '2026-11-20T12:00:00.000Z');
  assert.deepEqual(parsed.coordinates, { latitude: 18.5204, longitude: 73.8567 });
  assert.equal(parsed.hours.length, 3);
  assert.deepEqual(
    parsed.hours.map((h) => h.time),
    ['12:00', '13:00', '14:00'],
  );
  assert.equal(parsed.hours[2].pm25, null); // negative pm2_5 sanitized to null

  // Stale timestamp (> 6h old) rejected
  assert.throws(
    () =>
      parseOpenMeteoAir(
        {
          current: { time: isoHourOffset(now, -8), us_aqi: 120 },
          hourly: {
            time: [isoHourOffset(now, -8), isoHourOffset(now, -7)],
            us_aqi: [120, 118],
          },
        },
        'Pune',
        { latitude: 18.5204, longitude: 73.8567 },
        now,
      ),
    /stale|future/i,
  );

  // Far-future timestamp (> 3h ahead) rejected
  assert.throws(
    () =>
      parseOpenMeteoAir(
        {
          current: { time: isoHourOffset(now, 5), us_aqi: 120 },
          hourly: {
            time: [isoHourOffset(now, 5), isoHourOffset(now, 6)],
            us_aqi: [120, 118],
          },
        },
        'Pune',
        { latitude: 18.5204, longitude: 73.8567 },
        now,
      ),
    /stale|future/i,
  );

  // Negative or > 1000 US AQI rejected
  assert.throws(
    () =>
      parseOpenMeteoAir(
        {
          current: { time: '2026-11-20T12:00', us_aqi: -12 },
          hourly: {
            time: ['2026-11-20T12:00', '2026-11-20T13:00'],
            us_aqi: [120, 118],
          },
        },
        'Pune',
        { latitude: 18.5204, longitude: 73.8567 },
        now,
      ),
    /AQI/i,
  );
});

test('fetchLiveAirForecast deduplicates concurrent identical requests and enforces 1 MB payload cap', async () => {
  clearUpstreamCache();
  let calls = 0;
  const nowIso = new Date().toISOString().slice(0, 16);
  const nextIso = new Date(Date.now() + 3600_000).toISOString().slice(0, 16);

  const slowMockFetch: typeof fetch = async (url) => {
    calls += 1;
    assert.match(String(url), /timezone=UTC/);
    await new Promise((r) => setTimeout(r, 25));
    return new Response(
      JSON.stringify({
        current: { time: nowIso, us_aqi: 132, pm2_5: 44 },
        hourly: { time: [nowIso, nextIso], us_aqi: [132, 125], pm2_5: [44, 40] },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const [a, b] = await Promise.all([
    fetchLiveAirForecast(18.5204, 73.8567, 'Pune', { fetchFn: slowMockFetch }),
    fetchLiveAirForecast(18.5204, 73.8567, 'Pune', { fetchFn: slowMockFetch }),
  ]);
  assert.equal(calls, 1);
  assert.equal(a.current.usAqi, 132);
  assert.equal(b.current.usAqi, 132);

  // Oversized response (> 1 MB) rejected cleanly
  clearUpstreamCache();
  const hugeMockFetch: typeof fetch = async () =>
    new Response(JSON.stringify({ pad: 'x'.repeat(1_050_000) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  await assert.rejects(
    () => fetchLiveAirForecast(19.076, 72.8777, 'Mumbai', { fetchFn: hugeMockFetch }),
    /too large|502/i,
  );
  clearUpstreamCache();
});
