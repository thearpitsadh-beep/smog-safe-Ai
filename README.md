# SmogSafe AI

**SmogSafe AI** is a GenAI-assisted urban air-quality planning application that helps households navigate winter smog and high-pollution episodes with personalized daily routines, indoor source-control guidance, transparent commute emissions vs inhalation exposure trade-offs, an interactive regional Google Map explorer, and a safety-guarded Gemini assistant.

---

## Key Features

- **Modeled US AQI Forecasts + Clearly Labeled Illustrative Demos**
  - Server-side Open-Meteo / Copernicus CAMS connector (`timezone=UTC`) with `12m` TTL caching, `1 MB` payload cap, concurrent fetch deduplication, and strict UTC/numeric validation.
  - Cryptographic HMAC-SHA256 snapshot signing (`src/server/forecastSigning.ts`) bound to WGS84 geographic coordinates (`src/shared/location.ts`) and expiry metadata.
  - Automatic fallback to clearly labeled **DEMO DATA** (`live: false`) whenever live forecasts are unrequested, offline, expired, or mismatched.
- **Personalized 3-Part Daily Plan (`Morning · Afternoon · Evening`) & AI Family Brief**
  - Deterministic household engine adapting to city, US AQI severity, routine, commute mode, budget (`low` / `medium` / `flexible`), children, older adults, air-sensitive members, and HEPA purifier ownership.
  - Every daily action and indoor tip lists **Why**, **Trade-off**, **Supporting data**, and **Impact & uncertainty**.
  - `POST /api/brief` generates a plain-language household summary via `@google/genai` (server-side `GEMINI_API_KEY`) with strict schema/grounding checks and deterministic fallback.
- **Indoor Air Guide**
  - Prioritizes zero-cost smoke/dust source controls before hardware; explicitly avoids ozone-generating purifiers and houseplant myths.
- **Impact Lab (GHG Emissions vs Personal Exposure)**
  - Uses Indian urban reference factors (India GHG Program / WRI India & CEA India grid intensity) with min–max ranges, optional custom emission factors (`0–2 kg CO2e/km`), proxy notices outside India, and explicit warnings separating emissions avoided from personal inhalation dose.
- **3D Smog Twin Simulation (`scene3d`)**
  - Lazy-loaded Three.js WebGL cutaway home + urban corridor synced to active US AQI, PM2.5, commute mode, interactive HEPA CADR / wind sliders, and window-sealing controls (`H` toggles HUD controls).
- **Ask SmogSafe AI Copilot (3 Grounding Modes)**
  - **Grounded Plan Chat** (`/api/chat`): Context-grounded Q&A via server-side Gemini (`ThinkingLevel.LOW` where supported, strict JSON schema, prompt-injection & medical/scientific safety guardrails, deterministic fallback).
  - **Live Web Search** (`/api/search-grounding`) & **Nearby Clean-Air Places** (`/api/maps-grounding`): Server-side Google Search / Google Maps grounding returning sanitized HTTPS citations (or falling back safely without fabricated links).
- **Google Maps Location Explorer & Optional Cloud Sync**
  - Interactive Google Map markers, Google Places jump-to-neighborhood search, and server-side `/api/maps-aqi` lookup with quota protection.
  - Optional Firebase Google Sign-In (`src/context/FirebaseContext.tsx`) syncing household profiles, routine snapshots, and air logs under strict Eight-Pillar `firestore.rules`.

---

## Quick Start & Commands

```bash
npm install
npm run dev      # Starts Express + Vite SSR middleware on http://localhost:3000
```

### Verification, Linting & Benchmarking

```bash
npm run lint                 # TypeScript typecheck (tsc --noEmit)
npm test                     # Node test runner across tests/*.test.ts (114 tests)
npm run build                # Code-split production Vite client bundle (dist/)
npm run check                # Runs lint + test + build together
npx eslint firestore.rules   # Validates Firestore security rules
npm run benchmark            # Local HTTP micro-benchmark for API endpoints
```

See [`docs/INDEPENDENT_VALIDATION.md`](docs/INDEPENDENT_VALIDATION.md) and [`docs/SECURITY_AND_DATA_TRUST.md`](docs/SECURITY_AND_DATA_TRUST.md) for measured verification evidence, threat model, and unresolved sandbox limitations.

### Production Build & Run

```bash
npm run build
npm start        # Runs Express serving dist/ on port 3000
```

---

## Environment Variables (Server-Side Only)

See `.env.example` for placeholders (never commit secrets):

- `GEMINI_API_KEY` — Enables server-side Gemini responses on `/api/chat`, `/api/brief`, `/api/search-grounding`, and `/api/maps-grounding` (deterministic fallback activates automatically when unset or unavailable).
- `GEMINI_MODEL` — Optional valid Gemini model alias (defaults to `gemini-4-hydrogen` with automatic candidate fallback).
- `FORECAST_SIGNING_SECRET` — Recommended >=16-char HMAC secret in multi-instance production deployments so signed forecast tokens remain valid across server restarts.
- `GOOGLE_MAPS_API_KEY` / `VITE_GOOGLE_MAPS_API_KEY` — Google Maps Platform key for interactive map & `/api/maps-aqi`.

---

## Known Limitations & Operational Notes

- **US AQI vs India NAQI**: Open-Meteo / CAMS provides modeled US EPA AQI, which differs numerically from India's CPCB National AQI (NAQI). Always follow official local alerts (`CPCB`/`SAFAR`) and clinical advice for health symptoms.
- **Multi-instance scaling**: In-memory rate-limit buckets (`buckets` Map) and Open-Meteo caches (`upstreamCache` Map) are per-process; use Redis/shared store plus a shared `FORECAST_SIGNING_SECRET` behind horizontal load balancers.
- **Historical GHG factors**: Default transport factors reflect WRI India / CEA India `2018–2021` reference baselines; outside India these are illustrative proxies, and custom user overrides switch to an explicit non-cited scenario.
- **Firestore rules review**: Before sharing broadly or deploying externally, review `firestore.rules` carefully against your production Firebase project policies.
- **Medical disclaimer**: Environmental planning guidance only—never diagnoses or prescribes medical care.

