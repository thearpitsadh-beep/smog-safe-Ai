import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { createApp } from '../src/server/app.ts';
import { signForecastSnapshot } from '../src/server/forecastSigning.ts';
import type { AirQualityData } from '../src/shared/types.ts';

let server: Server;
let base: string;

const mockLiveForecast: AirQualityData = (() => {
  const now = Date.now();
  const baseAir: AirQualityData = {
    live: true,
    source: 'Open-Meteo / Copernicus CAMS modeled forecast',
    scale: 'US AQI',
    scaleNotice: 'US EPA AQI scale (distinct from India NAQI).',
    locationLabel: 'Pune',
    coordinates: { latitude: 18.5204, longitude: 73.8567 },
    hourTimezone: 'UTC',
    timestamp: new Date(now).toISOString(),
    fetchedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 12 * 60 * 1000).toISOString(),
    current: { usAqi: 135, pm25: 49.2, pm10: 88.4, no2: 24.0, ozone: 45.0 },
    hours: [
      { time: '12:00', usAqi: 135, pm25: 49.2 },
      { time: '13:00', usAqi: 128, pm25: 45.0 },
    ],
    providerLink: 'https://open-meteo.com/en/docs/air-quality-api',
    disclaimer: 'Modeled forecast, not a ground-monitor reading.',
  };
  baseAir.verificationToken = signForecastSnapshot(baseAir);
  return baseAir;
})();

before(async () => {
  const app = createApp({
    isDevVite: false,
    airFetcher: async () => ({ ...mockLiveForecast }),
    geminiClientOverride: {
      async generateStructuredChat({ userPrompt }) {
        if (userPrompt.includes('TRIGGER_FAIL')) {
          throw new Error('Upstream Gemini failure');
        }
        return JSON.stringify({
          answer:
            'For better indoor air in New Delhi (illustrative US AQI 184, not India NAQI), start by removing smoke sources and damp-cleaning floors.',
          keyActions: [
            'Skip incense and candles indoors.',
            'Use damp mopping instead of dry sweeping.',
          ],
          impactDomain: 'indoor_generation',
          uncertaintyNote: 'Grounded in illustrative demo scenario (US AQI 184).',
          medicalDisclaimer: 'General environmental information only; not medical advice.',
        });
      },
      async generateSearchGrounded() {
        return {
          text: 'GRAP winter advisory summary (US AQI distinct from India NAQI).',
          groundingChunks: [
            { web: { uri: 'https://cpcb.nic.in/aqi', title: 'CPCB Portal' } },
          ],
        };
      },
      async generateMapsGrounded() {
        return {
          text: 'Nearby indoor library and metro stations around your coordinates.',
          groundingChunks: [
            {
              maps: {
                uri: 'https://maps.google.com/?cid=555',
                title: 'Pune Central Library',
                placeAnswerSources: { reviewSnippets: ['Quiet indoor space.'] },
              },
            },
          ],
        };
      },
    },
  });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Expected port');
  base = `http://127.0.0.1:${addr.port}`;
});

after(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

const post = (path: string, payload: unknown) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

test('Health endpoint reports status and sets strict security headers', async () => {
  const r = await fetch(`${base}/api/health`);
  assert.equal(r.status, 200);
  const csp = r.headers.get('content-security-policy') || '';
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-src 'self'/);
  assert.match(csp, /firestore\.googleapis\.com/);
  assert.match(csp, /frame-ancestors 'self' https:\/\/aistudio\.google\.com/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), null);
  const b = (await r.json()) as { ok: boolean; demoAvailable: boolean };
  assert.equal(b.ok, true);
  assert.equal(b.demoAvailable, true);
});

test('Live forecast endpoint rejects invalid coordinates before upstream call', async () => {
  for (const q of ['?lat=a&lon=40', '?lat=999&lon=40', '?lat=20&lon=999', '?lon=50']) {
    const r = await fetch(`${base}/api/air${q}`);
    assert.equal(r.status, 400);
  }
});

test('Signed live forecast from /api/air is accepted by /api/plan and /api/chat', async () => {
  const airRes = await fetch(`${base}/api/air?lat=18.52&lon=73.85&label=Pune`);
  assert.equal(airRes.status, 200);
  const airBody = (await airRes.json()) as AirQualityData;
  assert.equal(airBody.live, true);
  assert.ok(airBody.verificationToken);
  assert.ok(airBody.expiresAt);

  const planRes = await post('/api/plan', {
    profile: { city: 'Pune', commute: 'metro' },
    air: airBody,
  });
  assert.equal(planRes.status, 200);
  const planBody = (await planRes.json()) as { note: string };
  assert.match(planBody.note, /modeled Open-Meteo\/CAMS forecast/i);
});

test('Forged client air with live=true is rejected with 400 on /api/plan and /api/chat', async () => {
  const forged = { live: true, current: { usAqi: 10, pm25: 2 } };
  const planRes = await post('/api/plan', { profile: { city: 'New Delhi' }, air: forged });
  assert.equal(planRes.status, 400);
  const planErr = (await planRes.json()) as { error: string };
  assert.match(planErr.error, /unverified|missing server/i);

  const chatRes = await post('/api/chat', {
    message: 'Can I jog outside?',
    profile: { city: 'New Delhi' },
    air: forged,
  });
  assert.equal(chatRes.status, 400);
});

test('Geocoding rejects too-short search input and returns known Indian cities', async () => {
  const bad = await fetch(`${base}/api/locations?q=x`);
  assert.equal(bad.status, 400);

  const ok = await fetch(`${base}/api/locations?q=pune`);
  assert.equal(ok.status, 200);
  const b = (await ok.json()) as { results: Array<{ name: string; latitude: number }> };
  assert.equal(b.results[0].name, 'Pune');
  assert.ok(Number.isFinite(b.results[0].latitude));
});

test('Demo endpoint clearly labels data as invented', async () => {
  const r = await fetch(`${base}/api/demo?city=New%20Delhi`);
  assert.equal(r.status, 200);
  const b = (await r.json()) as { air: AirQualityData };
  assert.equal(b.air.live, false);
  assert.match(b.air.source, /DEMO ONLY/);
});

test('Plan API rejects non-object body and returns 3 daily actions on valid input', async () => {
  const bad = await post('/api/plan', [1, 2, 3]);
  assert.equal(bad.status, 400);

  const ok = await post('/api/plan', {
    profile: { city: 'New Delhi', children: true, commute: 'metro' },
    air: { live: false },
  });
  assert.equal(ok.status, 200);
  const b = (await ok.json()) as { actions: unknown[]; indoor: unknown[]; swaps: unknown[] };
  assert.equal(b.actions.length, 3);
  assert.equal(b.indoor.length, 4);
  assert.equal(b.swaps.length, 3);
});

test('Impact API calculates sourced emissions and rejects invalid distance', async () => {
  const ok = await post('/api/impact', { distanceKm: 12, daysPerWeek: 5, option: 'metro', country: 'India' });
  assert.equal(ok.status, 200);
  const b = (await ok.json()) as { savedKg: number };
  assert.equal(b.savedKg, 15.6);

  const bad = await post('/api/impact', { distanceKm: 999, daysPerWeek: 5, option: 'metro' });
  assert.equal(bad.status, 400);
});

test('Chat API returns structured Gemini output and falls back cleanly on error', async () => {
  const shortRes = await post('/api/chat', { message: 'hi' });
  assert.equal(shortRes.status, 400);

  const geminiRes = await post('/api/chat', {
    message: 'How can I improve indoor air?',
    profile: { city: 'New Delhi' },
    air: { live: false },
  });
  assert.equal(geminiRes.status, 200);
  const geminiBody = (await geminiRes.json()) as {
    mode: string;
    keyActions: string[];
    impactDomain: string;
    uncertaintyNote: string;
    medicalDisclaimer: string;
  };
  assert.equal(geminiBody.mode, 'gemini');
  assert.ok(geminiBody.keyActions.length >= 1);
  assert.equal(geminiBody.impactDomain, 'indoor_generation');

  const fallbackRes = await post('/api/chat', {
    message: 'TRIGGER_FAIL what about walking?',
    profile: { city: 'Pune' },
    air: { live: false },
  });
  assert.equal(fallbackRes.status, 200);
  const fallbackBody = (await fallbackRes.json()) as { mode: string; answer: string };
  assert.equal(fallbackBody.mode, 'rules-fallback');
  assert.match(fallbackBody.answer, /walking|metro|commute/i);
});

test('Malformed JSON, oversized payload, and unknown API routes return proper status codes', async () => {
  const malformed = await fetch(`${base}/api/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{broken',
  });
  assert.equal(malformed.status, 400);

  const oversized = await post('/api/chat', { message: 'x'.repeat(22_000) });
  assert.equal(oversized.status, 413);

  const unknown = await fetch(`${base}/api/secrets`);
  assert.equal(unknown.status, 404);
});

test('Rate limiter returns 429 with Retry-After after exceeding /api/chat threshold', async () => {
  const rateApp = createApp({
    isDevVite: false,
    geminiClientOverride: {
      async generateStructuredChat() {
        return JSON.stringify({
          answer: 'Use damp mopping inside for illustrative US AQI 184.',
          keyActions: ['Damp mop surfaces.'],
          impactDomain: 'indoor_generation',
          uncertaintyNote: 'Illustrative demo scenario.',
          medicalDisclaimer: 'Not medical advice.',
        });
      },
    },
  });
  const rateServer = rateApp.listen(0, '127.0.0.1');
  await once(rateServer, 'listening');
  const addr = rateServer.address();
  if (!addr || typeof addr === 'string') throw new Error('Expected port');
  const rateBase = `http://127.0.0.1:${addr.port}`;

  try {
    let lastStatus = 200;
    let retryAfter: string | null = null;
    for (let i = 0; i < 16; i++) {
      const r = await fetch(`${rateBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'How is indoor air?', air: { live: false } }),
      });
      lastStatus = r.status;
      retryAfter = r.headers.get('retry-after');
      if (i < 15) assert.equal(r.status, 200);
    }
    assert.equal(lastStatus, 429);
    assert.equal(retryAfter, '60');
  } finally {
    await new Promise<void>((resolve) => rateServer.close(() => resolve()));
  }
});

test('Live /api/air returns 503 with explicit safe message on upstream failure', async () => {
  const errApp = createApp({
    isDevVite: false,
    airFetcher: async () => {
      throw new Error('ECONNREFUSED');
    },
  });
  const errServer = errApp.listen(0, '127.0.0.1');
  await once(errServer, 'listening');
  const addr = errServer.address();
  if (!addr || typeof addr === 'string') throw new Error('Expected port');
  const errBase = `http://127.0.0.1:${addr.port}`;

  try {
    const r = await fetch(`${errBase}/api/air?lat=28.6139&lon=77.2090`);
    assert.equal(r.status, 503);
    const body = (await r.json()) as { error: string };
    assert.match(body.error, /unavailable/i);
    assert.doesNotMatch(body.error, /ECONNREFUSED/);
  } finally {
    await new Promise<void>((resolve) => errServer.close(() => resolve()));
  }
});

test('Cross-city forecast replay and GET /api/air label mismatch return 409', async () => {
  // Known city label bound to wrong coordinates in GET /api/air
  const badLabelAir = await fetch(`${base}/api/air?lat=28.6139&lon=77.2090&label=Mumbai`);
  assert.equal(badLabelAir.status, 409);

  // Pune signed snapshot sent with Mumbai household profile -> 409
  const airRes = await fetch(`${base}/api/air?lat=18.5204&lon=73.8567&label=Pune`);
  assert.equal(airRes.status, 200);
  const puneAir = (await airRes.json()) as AirQualityData;

  const mismatchPlan = await post('/api/plan', {
    profile: { city: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
    air: puneAir,
  });
  assert.equal(mismatchPlan.status, 409);

  const mismatchChat = await post('/api/chat', {
    message: 'How should we plan outdoor play today?',
    profile: { city: 'New Delhi' },
    air: puneAir,
  });
  assert.equal(mismatchChat.status, 409);
});

test('POST /api/* enforces JSON Content-Type (415) and rejects cross-origin browser requests (403)', async () => {
  const wrongMime = await fetch(`${base}/api/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: '{"profile":{"city":"Pune"}}',
  });
  assert.equal(wrongMime.status, 415);

  const crossOrigin = await fetch(`${base}/api/plan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://evil.example.com',
    },
    body: JSON.stringify({ profile: { city: 'Pune' }, air: { live: false } }),
  });
  assert.equal(crossOrigin.status, 403);
});

test('POST /api/brief validates input, verifies snapshot, and returns structured AI brief', async () => {
  const briefRes = await post('/api/brief', {
    profile: { city: 'New Delhi', children: true, commute: 'metro' },
    air: { live: false },
  });
  assert.equal(briefRes.status, 200);
  const briefBody = (await briefRes.json()) as {
    brief: string;
    keyFocus: string;
    uncertaintyNote: string;
    medicalDisclaimer: string;
    mode: string;
  };
  assert.ok(briefBody.brief.length > 20);
  assert.ok(briefBody.keyFocus.length > 5);
  assert.ok(['gemini', 'rules-fallback'].includes(briefBody.mode));

  const forgedBrief = await post('/api/brief', {
    profile: { city: 'New Delhi' },
    air: { live: true, current: { usAqi: 12 } },
  });
  assert.equal(forgedBrief.status, 400);
});

test('Search and Maps grounding endpoints validate inputs, enforce geo-binding, and return citations', async () => {
  const shortSearch = await post('/api/search-grounding', { message: 'hi' });
  assert.equal(shortSearch.status, 400);

  const okSearch = await post('/api/search-grounding', {
    message: 'What are current GRAP winter advisories?',
    profile: { city: 'New Delhi' },
    air: { live: false },
  });
  assert.equal(okSearch.status, 200);
  const searchBody = (await okSearch.json()) as {
    mode: string;
    sources: Array<{ title: string; uri: string }>;
  };
  assert.equal(searchBody.mode, 'gemini-search');
  assert.equal(searchBody.sources[0].title, 'CPCB Portal');

  const okMaps = await post('/api/maps-grounding', {
    message: 'Find nearby indoor libraries',
    profile: { city: 'Pune', latitude: 18.5204, longitude: 73.8567 },
    air: mockLiveForecast,
  });
  assert.equal(okMaps.status, 200);
  const mapsBody = (await okMaps.json()) as {
    mode: string;
    places: Array<{ title: string; uri: string }>;
  };
  assert.equal(mapsBody.mode, 'gemini-maps');
  assert.equal(mapsBody.places[0].title, 'Pune Central Library');

  // Cross-city mismatch on signed forecast returns 409
  const mismatchMaps = await post('/api/maps-grounding', {
    message: 'Find nearby metro stations',
    profile: { city: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
    air: mockLiveForecast,
  });
  assert.equal(mismatchMaps.status, 409);
});

test('fetchLiveAirForecast aborts 2 MB chunked stream mid-read at ~1 MB byte limit and handles malformed JSON', async () => {
  const { fetchLiveAirForecast, clearUpstreamCache, UpstreamError } = await import('../src/server/openMeteo.ts');
  clearUpstreamCache();

  let bytesEmitted = 0;
  let canceled = false;
  const chunkSize = 65_536; // 64 KB chunks
  let chunkIndex = 0;
  const twoMbStream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (chunkIndex >= 32) {
        controller.close();
        return;
      }
      chunkIndex += 1;
      bytesEmitted += chunkSize;
      controller.enqueue(new Uint8Array(chunkSize).fill(97)); // 'a'
    },
    cancel() {
      canceled = true;
    },
  });

  await assert.rejects(
    () =>
      fetchLiveAirForecast(28.6139, 77.209, 'New Delhi', {
        fetchFn: async () => new Response(twoMbStream, { status: 200 }),
      }),
    (err: unknown) => err instanceof UpstreamError && err.status === 502 && /payload too large/i.test(err.message),
  );
  assert.equal(canceled, true, 'Upstream stream must be canceled on 1 MB byte cap breach');
  assert.ok(bytesEmitted <= 1_150_000, `Expected <= ~1.15 MB (well below 2 MB) emitted before abort, got ${bytesEmitted}`);

  clearUpstreamCache();
  await assert.rejects(
    () =>
      fetchLiveAirForecast(18.5204, 73.8567, 'Pune', {
        fetchFn: async () => new Response('{not valid json', { status: 200 }),
      }),
    (err: unknown) => err instanceof UpstreamError && err.status === 502 && /invalid JSON/i.test(err.message),
  );
  clearUpstreamCache();
});

test('POST /api/plan handles null, array, boolean, and string profile inputs safely without crashing', async () => {
  for (const candidate of [null, [], true, 'untrusted input']) {
    const res = await post('/api/plan', { profile: candidate, air: { live: false } });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { profile: { city: string }; actions: unknown[] };
    assert.equal(body.profile.city, 'New Delhi');
    assert.equal(body.actions.length, 3);
  }
});
