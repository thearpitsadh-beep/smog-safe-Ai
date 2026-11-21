# SmogSafe AI — Security, Data Trust, and AI Safety Architecture

## 1. Non-Negotiable Data Integrity Invariants

1. **No Fabricated Live Data**
   - Unconnected, offline, failed, or expired states fall back strictly to labeled illustrative scenarios (`live: false`, `DEMO DATA`) or explicit unavailable error banners.
   - Example values, demo scenarios, or expired caches are never presented as real measurements or live forecasts.

2. **Server-Issued Forecast Provenance & HMAC Verification (`src/server/forecastSigning.ts`)**
   - All live forecasts originate exclusively from `GET /api/air` calling Open-Meteo / Copernicus CAMS (`timezone=UTC`) on the server.
   - Each snapshot is stamped with `source`, `scale: 'US AQI'`, UTC `timestamp`, `fetchedAt`, `expiresAt` (`12m` TTL), `coordinates`, and an HMAC-SHA256 `verificationToken` using `FORECAST_SIGNING_SECRET` (or a per-process 256-bit cryptographically random secret fallback).
   - `POST /api/plan`, `POST /api/brief`, and `POST /api/chat` reject tampered, unsigned, or expired `live: true` snapshots with `400 ForecastVerificationError`.

3. **Geographic Coordinate Binding (`src/shared/location.ts`)**
   - Known built-in city labels are checked against coordinates (`assertCityCoordinates`, max 35 km radius) on `GET /api/air` (`409 Conflict` on mismatch).
   - Server-signed live snapshots bind `{ latitude, longitude }` inside the HMAC canonical payload.
   - `assertLocationMatchesForecast` validates on every `POST /api/plan`, `POST /api/brief`, and `POST /api/chat` that:
     - Forecast provenance includes valid WGS84 coordinates.
     - Known city names match forecast coordinates (`<= 35 km`) and household coordinates (`<= 35 km`).
     - Household coordinates (or canonical known city coords) match the snapshot (`<= 5 km`). Mismatches return `409 Conflict`.

4. **Strict Upstream Parsing & DoS Protections (`src/server/openMeteo.ts`)**
   - Requests use `timezone=UTC` and `AbortSignal.timeout(9500)`.
   - Responses are capped at `1,000,000` bytes (`readJsonWithByteLimit`).
   - Identical concurrent requests are coalesced via `inFlightRequests`.
   - `parseOpenMeteoAir` rejects stale (`> 6h` old) or far-future (`> 3h` ahead) forecasts, rejects negative/out-of-range US AQI (`0..1000`), enforces monotonic future UTC hourly entries (`>= 2` valid hours), and explicitly marks `hourTimezone: 'UTC'`.

5. **Browser Freshness & Race Guards (`src/App.tsx`)**
   - `forecastRequestVersionRef` discards delayed earlier responses when the user switches cities or triggers another lookup.
   - `enforceForecastFreshness()` runs on a 30-second timer, on `visibilitychange`, and prior to plan/brief/chat/export actions—reverting expired live snapshots back to labeled demo mode with a clear warning.
   - Failed live refreshes revert any older live forecast to labeled demo mode rather than displaying stale numbers alongside an error.

---

## 2. Server-Side GenAI & Request Security

- **API Key Isolation**: `GEMINI_API_KEY` is read strictly on the server inside `src/server/geminiService.ts` via `@google/genai`. Verified statically by `tests/accessibility.test.ts`.
- **Origin & Content-Type Enforcement (`src/server/app.ts`)**: `POST /api/*` requires `Content-Type: application/json` (`415`) and rejects mismatched `Origin` headers against `Host` / `X-Forwarded-Host` (`403`), while remaining compatible with reverse-proxied preview environments.
- **CSP & Security Headers**: Sets `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cache-Control: no-store` on `/api/*`, and a strict Content Security Policy supporting Google Maps SDK and AI Studio preview embedding.
- **Per-IP Rate Limiting**: `/api/chat` (`15/min`), `/api/brief` (`20/min`), `/api/air` (`36/min`), other `/api/*` (`90/min`) returning `429` with `Retry-After: 60`.
- **Prompt Injection & Schema Guardrails**:
  - Pre-screens jailbreak / secret-extraction patterns before invoking Gemini.
  - Enforces JSON `responseSchema`, `ThinkingLevel.LOW` on Gemini 3/4, `8.5s` timeout, `finishReason` / `blockReason` inspection, and regex/numeric grounding validation rejecting:
    - Secret/system-prompt leaks
    - Medical diagnoses or prescriptions
    - Ozone purifier or plant-filtration myths
    - Presenting demo values as live sensors
    - Unsupported `100% safe` / `guaranteed` percentage reduction claims
    - Ungrounded AQI figures absent from verified context JSON
  - Deterministic rules (`fallbackAnswer`, `fallbackPlanBrief`) act as an automatic fallback whenever Gemini is unavailable, slow, or fails validation.
  - **Web Search & Maps Grounding (`/api/search-grounding`, `/api/maps-grounding`)**: Enforces forecast verification and geo-binding first, runs prompt-injection and plain-text safety checks, sanitizes all returned citation URIs strictly to `http:`/`https:` (rejecting `javascript:`/`data:`), and never fabricates links on fallback.
- **Firebase Auth & Cloud Firestore (`firestore.rules`)**: Per-user paths (`/users/{uid}/private/profile`, `/plans/{planId}`, `/airLogs/{logId}`) restrict access to `request.auth.uid == userId` with strict schema allowlists validated via `@firebase/eslint-plugin-security-rules`.

---

## 3. Emissions vs Exposure Separation & Limitations

- Transport GHG calculations (`src/shared/emissions.ts`) use historical `2018–2021` Indian urban reference factors (`0.171` car, `0.078` bus, `0.041` metro kg CO2e/pkm) with min/max ranges, optional user-editable overrides (`0..2 kg/km`, labeled *non-cited custom scenario*), and proxy notices outside India.
- Every recommendation and comparison explicitly separates **emissions avoided (kg CO2e)** from **personal inhaled PM2.5 exposure**—noting that zero-tailpipe walking/cycling increases inhalation dose along heavy traffic during unhealthy AQI.
- **Scale distinction**: Modeled forecasts use **US EPA AQI**, which uses different breakpoints from **India NAQI** (`CPCB/SAFAR`). SmogSafe AI provides environmental planning guidance, not medical advice.
- Full verification outputs and unresolved sandbox gaps are documented in [`docs/INDEPENDENT_VALIDATION.md`](INDEPENDENT_VALIDATION.md).

