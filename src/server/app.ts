import express, { type NextFunction, type Request, type Response } from 'express';
import { DEMO_CITIES, demoAir, makePlan, safeProfile } from '../shared/airQuality.ts';
import { travelImpact } from '../shared/emissions.ts';
import { LocationMismatchError, assertCityCoordinates } from '../shared/location.ts';
import {
  ForecastVerificationError,
  resolveAuthoritativeAir,
} from './forecastSigning.ts';
import {
  generateCopilotReply,
  generateMapsGroundedReply,
  generatePlanBrief,
  generateSearchGroundedReply,
  type GeminiClientLike,
} from './geminiService.ts';
import {
  fetchLiveAirForecast,
  searchLocations,
  UpstreamError,
} from './openMeteo.ts';

interface RateBucket {
  start: number;
  count: number;
}

export interface CreateAppOptions {
  isDevVite?: boolean;
  geminiClientOverride?: GeminiClientLike;
  airFetcher?: typeof fetchLiveAirForecast;
  locationSearcher?: typeof searchLocations;
}

function cleanString(v: unknown, max = 120): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function parseCoords(query: Request['query']): { latitude: number; longitude: number } | null {
  const rawLat = typeof query.lat === 'string' ? query.lat : '';
  const rawLon = typeof query.lon === 'string' ? query.lon : '';
  if (!rawLat || !rawLon) return null;
  const latitude = Number(rawLat);
  const longitude = Number(rawLon);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function isSameOriginHeader(req: Request): boolean {
  const originHeader = req.headers.origin;
  if (!originHeader || typeof originHeader !== 'string') return true;
  let originHost = '';
  try {
    originHost = new URL(originHeader).host.toLowerCase();
  } catch {
    return false;
  }
  const allowedHosts = new Set<string>();
  if (typeof req.headers.host === 'string' && req.headers.host.trim()) {
    allowedHosts.add(req.headers.host.trim().toLowerCase());
  }
  const forwarded = req.headers['x-forwarded-host'];
  if (typeof forwarded === 'string') {
    for (const part of forwarded.split(',')) {
      const trimmed = part.trim().toLowerCase();
      if (trimmed) allowedHosts.add(trimmed);
    }
  }
  if (allowedHosts.size === 0) return false;
  return allowedHosts.has(originHost);
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const app = express();
  app.disable('x-powered-by');

  const buckets = new Map<string, RateBucket>();
  const airFetcher = options.airFetcher ?? fetchLiveAirForecast;
  const locationSearcher = options.locationSearcher ?? searchLocations;

  const scriptSrc = options.isDevVite
    ? "'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com https://apis.google.com https://www.gstatic.com"
    : "'self' https://maps.googleapis.com https://maps.gstatic.com https://apis.google.com https://www.gstatic.com";
  const styleSrc = "'self' 'unsafe-inline' https://fonts.googleapis.com";
  const connectSrc = options.isDevVite
    ? "'self' ws: wss: https://*.googleapis.com https://maps.gstatic.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://www.googleapis.com"
    : "'self' https://*.googleapis.com https://maps.gstatic.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://www.googleapis.com";

  // Security headers on every response (compatible with AI Studio preview iframe, Google Maps SDK, and Firebase Auth/Firestore)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; script-src ${scriptSrc}; style-src ${styleSrc}; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.ggpht.com https://*.googleusercontent.com; connect-src ${connectSrc}; frame-src 'self' https://gen-lang-client-0314540465.firebaseapp.com https://accounts.google.com; font-src 'self' data: https://fonts.gstatic.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://aistudio.google.com https://*.google.com`,
    );
    next();
  });

  // Rate limiting, cross-origin check, and strict Content-Type enforcement for API endpoints
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'POST') {
      if (!isSameOriginHeader(req)) {
        res.status(403).json({ error: 'Cross-origin request rejected.' });
        return;
      }
      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      if (!contentType.startsWith('application/json')) {
        res.status(415).json({ error: 'Content-Type must be application/json.' });
        return;
      }
    }

    const ip = (req.socket.remoteAddress || 'unknown').slice(0, 128);
    const endpoint = req.path;
    const now = Date.now();
    const key = `${ip}|${endpoint}`;
    const maxPerMin =
      endpoint === '/chat' || endpoint === '/search-grounding' || endpoint === '/maps-grounding'
        ? 15
        : endpoint === '/brief'
          ? 20
          : endpoint === '/air'
            ? 36
            : 90;

    const bucket = buckets.get(key) ?? { start: now, count: 0 };
    if (now - bucket.start > 60_000) {
      bucket.start = now;
      bucket.count = 0;
    }
    bucket.count += 1;
    buckets.set(key, bucket);

    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) {
        if (now - v.start > 120_000) buckets.delete(k);
      }
    }

    if (bucket.count > maxPerMin) {
      res.setHeader('Retry-After', '60');
      res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
      return;
    }
    next();
  });

  // Strict JSON parser for API requests (16 KB cap)
  app.use('/api', express.json({ limit: '16kb', strict: false }));

  // Malformed JSON / Payload Too Large error handler
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (!err || typeof err !== 'object') {
      next(err);
      return;
    }
    const statusErr = err as { status?: number; type?: string };
    if (statusErr.type === 'entity.too.large' || statusErr.status === 413) {
      res.status(413).json({ error: 'Request too large.' });
      return;
    }
    if (statusErr.type === 'entity.parse.failed' || statusErr.status === 400) {
      res.status(400).json({ error: 'Invalid JSON.' });
      return;
    }
    next(err);
  });

  app.get('/api/health', (_req, res) => {
    const rawKey = process.env.GEMINI_API_KEY?.trim();
    const geminiConfigured = Boolean(rawKey && rawKey !== 'MY_GEMINI_API_KEY');
    const mapsApiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ||
      process.env.GOOGLE_MAPS_API_KEY?.trim() ||
      '';
    res.json({
      ok: true,
      app: 'SmogSafe AI',
      geminiConfigured,
      mapsConfigured: Boolean(mapsApiKey),
      mapsApiKey,
      demoAvailable: true,
    });
  });

  app.get('/api/maps-aqi', async (req, res) => {
    const coords = parseCoords(req.query);
    if (!coords) {
      res.status(400).json({ error: 'Valid latitude and longitude are required.' });
      return;
    }
    const mapsKey =
      process.env.GOOGLE_MAPS_API_KEY?.trim() ||
      process.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
    if (!mapsKey) {
      res.json({ available: false });
      return;
    }
    try {
      const upstream = await fetch(
        `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(mapsKey)}`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(8000),
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
          },
          body: JSON.stringify({
            universalAqi: true,
            location: {
              latitude: coords.latitude,
              longitude: coords.longitude,
            },
            extraComputations: ['LOCAL_AQI', 'DOMINANT_POLLUTANT_CONCENTRATION'],
            languageCode: 'en',
          }),
        },
      );
      const data = (await upstream.json().catch(() => ({}))) as {
        error?: { status?: string; message?: string };
        dateTime?: string;
        indexes?: Array<{
          code?: string;
          displayName?: string;
          aqi?: number;
          aqiDisplay?: string;
          category?: string;
          dominantPollutant?: string;
        }>;
      };
      if (upstream.status === 429 || data.error?.status === 'RESOURCE_EXHAUSTED') {
        res.status(429).json({
          available: false,
          quotaExceeded: true,
          error: 'Google Maps Platform Air Quality API quota exceeded.',
        });
        return;
      }
      if (!upstream.ok || !Array.isArray(data.indexes) || data.indexes.length === 0) {
        res.json({ available: false });
        return;
      }
      res.json({
        available: true,
        dateTime: data.dateTime ?? null,
        indexes: data.indexes,
      });
    } catch {
      res.json({ available: false });
    }
  });

  app.get('/api/demo', (req, res) => {
    const cityName = cleanString(req.query.city, 80);
    const location = DEMO_CITIES.find((c) => c.name === cityName) ?? DEMO_CITIES[0];
    res.json({ location, air: demoAir(location.name) });
  });

  app.get('/api/locations', async (req, res) => {
    const q = cleanString(req.query.q, 80);
    if (q.length < 2 || q.length > 80) {
      res.status(400).json({ error: 'Enter at least 2 characters to search.' });
      return;
    }
    try {
      const results = await locationSearcher(q);
      res.json({ results });
    } catch (err) {
      const status = err instanceof UpstreamError ? err.status : 503;
      res.status(status).json({
        error: 'City lookup unavailable. Try New Delhi, Pune, Mumbai, Bengaluru or Lucknow.',
      });
    }
  });

  app.get('/api/air', async (req, res) => {
    const coords = parseCoords(req.query);
    if (!coords) {
      res.status(400).json({ error: 'Valid latitude and longitude are required.' });
      return;
    }
    const label = cleanString(req.query.label, 80) || undefined;
    if (label) {
      try {
        assertCityCoordinates(label, coords);
      } catch (err) {
        if (err instanceof LocationMismatchError) {
          res.status(409).json({ error: err.message });
          return;
        }
      }
    }
    try {
      const forecast = await airFetcher(coords.latitude, coords.longitude, label);
      res.json(forecast);
    } catch (err) {
      const status = err instanceof UpstreamError ? err.status : 503;
      res.status(status).json({
        error: 'Live air forecast unavailable. Use clearly labeled demo data or try again.',
      });
    }
  });

  app.post('/api/plan', (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Expected a JSON object.' });
      return;
    }
    const profile = safeProfile(isPlainObject(req.body.profile) ? req.body.profile : {});
    try {
      const air = resolveAuthoritativeAir(req.body.air, profile);
      res.json(makePlan(profile, air));
    } catch (err) {
      if (err instanceof LocationMismatchError) {
        res.status(409).json({ error: err.message });
        return;
      }
      if (err instanceof ForecastVerificationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: 'Invalid planning request.' });
    }
  });

  app.post('/api/brief', async (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Expected a JSON object.' });
      return;
    }
    const profile = safeProfile(isPlainObject(req.body.profile) ? req.body.profile : {});
    let air;
    try {
      air = resolveAuthoritativeAir(req.body.air, profile);
    } catch (err) {
      if (err instanceof LocationMismatchError) {
        res.status(409).json({ error: err.message });
        return;
      }
      if (err instanceof ForecastVerificationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: 'Invalid air-quality context.' });
      return;
    }

    const plan = makePlan(profile, air);
    const result = await generatePlanBrief(plan, profile, air, options.geminiClientOverride);
    res.json({
      ...result.response,
      mode: result.mode,
      dataMode: air.live ? 'modeled-live-forecast' : 'illustrative-demo',
      ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {}),
    });
  });

  app.post('/api/impact', (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Expected a JSON object.' });
      return;
    }
    try {
      const result = travelImpact({
        distanceKm: req.body.distanceKm as number | undefined,
        daysPerWeek: req.body.daysPerWeek as number | undefined,
        option: req.body.option as never,
        country: typeof req.body.country === 'string' ? req.body.country : undefined,
        carFactor: req.body.carFactor as number | undefined,
        optionFactor: req.body.optionFactor as number | undefined,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Invalid travel impact inputs.',
      });
    }
  });

  app.post('/api/chat', async (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Expected a JSON object.' });
      return;
    }
    const question = cleanString(req.body.message, 850);
    if (question.length < 3 || question.length > 800) {
      res.status(400).json({ error: 'Ask a question between 3 and 800 characters.' });
      return;
    }
    const profile = safeProfile(isPlainObject(req.body.profile) ? req.body.profile : {});
    let air;
    try {
      air = resolveAuthoritativeAir(req.body.air, profile);
    } catch (err) {
      if (err instanceof LocationMismatchError) {
        res.status(409).json({ error: err.message });
        return;
      }
      if (err instanceof ForecastVerificationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: 'Invalid air-quality context.' });
      return;
    }

    const result = await generateCopilotReply(
      question,
      profile,
      air,
      options.geminiClientOverride,
    );
    res.json({
      ...result.response,
      mode: result.mode,
      dataMode: air.live ? 'modeled-live-forecast' : 'illustrative-demo',
      ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {}),
    });
  });

  app.post('/api/search-grounding', async (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Expected a JSON object.' });
      return;
    }
    const question = cleanString(req.body.message, 850);
    if (question.length < 3 || question.length > 800) {
      res.status(400).json({ error: 'Enter a search question between 3 and 800 characters.' });
      return;
    }
    const profile = safeProfile(isPlainObject(req.body.profile) ? req.body.profile : {});
    let air;
    try {
      air = resolveAuthoritativeAir(req.body.air, profile);
    } catch (err) {
      if (err instanceof LocationMismatchError) {
        res.status(409).json({ error: err.message });
        return;
      }
      if (err instanceof ForecastVerificationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: 'Invalid air-quality context.' });
      return;
    }

    const result = await generateSearchGroundedReply(
      question,
      profile,
      air,
      options.geminiClientOverride,
    );
    res.json(result);
  });

  app.post('/api/maps-grounding', async (req, res) => {
    if (!isPlainObject(req.body)) {
      res.status(400).json({ error: 'Expected a JSON object.' });
      return;
    }
    const question = cleanString(req.body.message, 850);
    if (question.length < 3 || question.length > 800) {
      res.status(400).json({ error: 'Enter a place search between 3 and 800 characters.' });
      return;
    }
    const profile = safeProfile(isPlainObject(req.body.profile) ? req.body.profile : {});
    let air;
    try {
      air = resolveAuthoritativeAir(req.body.air, profile);
    } catch (err) {
      if (err instanceof LocationMismatchError) {
        res.status(409).json({ error: err.message });
        return;
      }
      if (err instanceof ForecastVerificationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      res.status(400).json({ error: 'Invalid air-quality context.' });
      return;
    }

    const result = await generateMapsGroundedReply(
      question,
      profile,
      air,
      options.geminiClientOverride,
    );
    res.json(result);
  });

  app.all('/api/{*splat}', (req, res) => {
    const status = req.method === 'GET' || req.method === 'POST' ? 404 : 405;
    res.status(status).json({ error: 'Unknown API endpoint.' });
  });

  return app;
}
