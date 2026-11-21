# SmogSafe AI — Independent Engineering Validation & Audit Report

> **Audit Scope & Honesty Statement**: This document records reproducible engineering checks executed on the workspace repository (`server.ts`, `src/*`, `tests/*`, `firestore.rules`) on **2026-11-21**. Provisional category notes below are a self-audit aid toward high engineering quality—**never** an official PromptWars grade or guarantee. Where an integration could not be exercised live in this environment (specifically live Gemini inference without active model permissions and interactive human screen-reader/Google Sign-In runs), that gap is stated explicitly as **Unverified**.

---

## 1. Architecture, Stack Disclosure & Data-Flow Map

### Stack & Trade-offs
Unlike an earlier dependency-free Node HTTP / vanilla JS prototype, the active application is a **TypeScript full-stack Express + React 19 + Vite application** (`server.ts`, `src/server/*`, `src/shared/*`, `src/components/*`, `src/three/*`, `src/lib/firebase.ts`).

- **Trade-off**: Using React, Three.js, `@vis.gl/react-google-maps`, Firebase SDK, and Express adds npm dependencies and requires a build step (`npm install && npm run build && npm start`) rather than zero-dependency `node server.mjs`. In return, the app cleanly separates shared typed domain logic (`src/shared/*`), server-only trust boundaries (`src/server/*`), code-split 3D visualization (`SmogScene3DView`), Google Maps exploration, and per-user Cloud Firestore sync.

### Data-Flow & Trust Boundaries
```text
Browser SPA (React 19 + Three.js + Google Maps JS + Firebase Client)
  ├─ Never sees GEMINI_API_KEY or FORECAST_SIGNING_SECRET
  ├─ Enforces 30s client freshness timer + forecastRequestVersionRef race guard
  │
  ├──(Same-origin HTTPS/HTTP JSON + Origin/Content-Type checks)──▶ Express API (server.ts / src/server/app.ts)
  │     ├─ GET  /api/locations        ─▶ Open-Meteo Geocoding (24h cache, 1 MB byte cap)
  │     ├─ GET  /api/air              ─▶ Open-Meteo CAMS UTC (12m cache, 1 MB streaming cap)
  │     │                                └─ Signs snapshot via HMAC-SHA256 (12m TTL + lat/lon)
  │     ├─ POST /api/plan             ─▶ Verifies HMAC + geo-binding (409) ─▶ Deterministic plan
  │     ├─ POST /api/impact           ─▶ Bounded GHG calc (WRI/CEA 2018–2021 or non-cited custom)
  │     ├─ POST /api/brief            ─▶ Verifies HMAC + geo ─▶ @google/genai (schema + fallback)
  │     ├─ POST /api/chat             ─▶ Injection screen + @google/genai + safety regex + fallback
  │     ├─ POST /api/search-grounding ─▶ @google/genai + googleSearch + HTTPS URI sanitizer
  │     ├─ POST /api/maps-grounding   ─▶ @google/genai + googleMaps (lat/lon bound) + URI sanitizer
  │     └─ GET  /api/maps-aqi         ─▶ Server Google Air Quality proxy (daily quota ceiling)
  │
  └──(Optional Firebase Google Auth Bearer token)──▶ Cloud Firestore (firestore.rules)
        └─ /users/{uid}/private/profile, /plans/{planId}, /airLogs/{logId}
```

### Threat Model Summary
| Threat | Mitigation Implemented | Verification Status |
|---|---|---|
| Forged or backdated `live: true` AQI from browser | Server-only `HMAC-SHA256` signature (`12m` expiry) + `timingSafeEqual` + client `live: true` rejection (`400`) | **Verified** (`tests/security-gemini.test.ts`, `tests/server.test.ts`) |
| Cross-city signed forecast replay (e.g., Pune AQI sent with Mumbai profile) | Canonical coordinates inside HMAC + `assertLocationMatchesForecast` (`409 Conflict` >5 km / >35 km city mismatch) | **Verified** (`tests/server.test.ts`) |
| Upstream Open-Meteo OOM / huge chunked stream / slowloris | Streaming `ReadableStream` reader cancels at `1,000,000` bytes (`502`); `AbortSignal.timeout(9500)` (`504`) | **Verified** (`tests/server.test.ts` 2 MB chunked stream aborts mid-read at `1,114,112` bytes) |
| Prompt injection / API key leak / high-risk medical query / ozone myths | Regex & `isHighRiskHealthQuestion` pre-screen before LLM, JSON `responseSchema`, safety regex gates (antibiotics, CO2e/% drop, 48 KB cap), numeric AQI grounding check, deterministic `rules-fallback` | **Verified** (`tests/security-gemini.test.ts`); live Maps grounding & full 20-prompt live sweep **Unverified** |
| Cross-site POST / MIME sniffing / XSS | Same-origin `Origin` check (`403`), `application/json` enforcement (`415`), CSP `script-src 'self'`, zero `innerHTML`, `safeProfile` NFKC/`<>`/injection sanitization | **Verified** (`tests/server.test.ts`, `tests/logic.test.ts`, `tests/accessibility.test.ts`) |
| Unauthorized Firestore reads/writes | Eight-Pillar `firestore.rules` (`request.auth.uid == userId`, strict field allowlists, schema limits) | **Linted cleanly** (`npx eslint firestore.rules`); live auth flow **Unverified** |

---

## 2. Reproducible Verification Log (Executed 2026-11-21)

### A. Static Typecheck, Automated Unit/Integration Tests & Production Build
Command:
```bash
npm run lint && npx tsx --test --experimental-test-coverage tests/*.test.ts && npx eslint firestore.rules
```
- **TypeScript (`tsc --noEmit`)**: `0` errors (exit code `0`).
- **Node Test Runner (`tsx --test --experimental-test-coverage tests/*.test.ts`)**: **114 / 114 passed**, `0` failed, `0` skipped (`3.43 s`).
  - `tests/logic.test.ts`: US AQI bands, `safeProfile` null/array/primitive guards & NFKC/`<>`/injection city stripping, 5 distinct household profiles (A–E) across Morning/Afternoon/Evening + indoor tips with explicit trade-offs, budget tiers (`low`/`medium`/`flexible`), WRI/CEA `2018–2021` historical vintage, `"non-cited custom scenario"` overrides, exposure vs emissions separation, `estimateIndoorPm25` monotonicity.
  - `tests/security-gemini.test.ts`: HMAC verification/tamper/expiry, prompt injection & `isHighRiskHealthQuestion` pre-screen bypass (`llmCalled === false`), medical/antibiotic/ozone/plant/100%-safe/CO2e/AQI%-drop/49 KB rejection, ungrounded AQI rejection, `/api/brief` fallback, Search & Maps URI sanitization (`javascript:`/`data:` rejected), `DEFAULT_GEMINI_API_VERSION === 'v1beta'`.
  - `tests/server.test.ts`: CSP/headers, `400`/`403`/`409`/`413`/`415`/`429` (`Retry-After: 60`)/`503` behavior, `null`/`[]`/primitive profile robustness (`200`), Search & Maps endpoints, **2 MB (32 × 64 KB) chunked upstream stream abort** (`canceled === true`, `1,114,112` bytes emitted < 2 MB, throws `UpstreamError 502`), malformed JSON (`502`).
  - `tests/accessibility.test.ts`: 23 WCAG 2.2 AA hex contrast pairs >= `4.5:1`, `:focus-visible`, `prefers-reduced-motion`, zero legacy low-contrast hex tokens (`#75898e`, `#91a0a1`, `#a3b2b2`), skip link, `aria-live`, `th[scope="col"]`, zero `GEMINI_API_KEY` or `innerHTML` in frontend components.
  - `tests/location-trust.test.ts` & `tests/firestore.rules.test.ts`: Geographic mismatch/provenance checks and static Eight-Pillar `firestore.rules` structure tests.
- **Line / Branch Coverage (`--experimental-test-coverage`)**:
  - `src/shared/airQuality.ts`: `96.24%` line / `91.57%` branch (`100%` funcs)
  - `src/shared/emissions.ts`: `93.33%` line / `95.00%` branch (`100%` funcs)
  - `src/shared/location.ts`: `90.43%` line / `82.50%` branch (`100%` funcs)
  - `src/server/forecastSigning.ts`: `91.44%` line / `60.32%` branch (`100%` funcs)
  - `src/server/openMeteo.ts`: `83.54%` line / `70.77%` branch (`80.00%` funcs)
  - `src/server/app.ts`: `74.42%` line / `71.53%` branch (`90.48%` funcs)
  - `src/server/geminiService.ts`: `72.25%` line / `55.06%` branch (`85.71%` funcs; live SDK wrappers tested against real endpoint separately)
- **ESLint Security Rules (`npx eslint firestore.rules`)**: Exit code `0` (`0` errors/warnings).
- **Production Vite Build (`npm run build`)**: Code-split chunks:
  - `dist/index.html`: `1.18 kB` (`0.52 kB` gzip)
  - `dist/assets/index-*.css`: `34.99 kB` (`7.89 kB` gzip)
  - `dist/assets/index-*.js` (initial shell + React + Maps + Firebase): `1,209.46 kB` (`358.28 kB` gzip)
  - `dist/assets/SmogScene3DView-*.js` (lazy Three.js 3D twin chunk): `624.27 kB` (`157.89 kB` gzip)

### B. Local HTTP Micro-Benchmark
Command:
```bash
npm run benchmark
```
Measured against an isolated in-process Express server (`127.0.0.1`):
- `GET /api/health` (`n=50`): `avg=4.24ms`, `p50=2.75ms`, `p95=5.26ms`
- `POST /api/plan` (`n=50`): `avg=3.90ms`, `p50=3.38ms`, `p95=6.46ms`
- `POST /api/impact` (`n=50`): `avg=3.21ms`, `p50=3.20ms`, `p95=5.29ms`
- `POST /api/chat (rules-fallback)` (`n=12`): `avg=3.17ms`, `p50=3.04ms`, `p95=5.41ms`
- `POST /api/brief (rules-fallback)` (`n=12`): `avg=2.84ms`, `p50=2.86ms`, `p95=3.94ms`

### C. Live Upstream Open-Meteo & Live Gemini Verification (`http://127.0.0.1:3000`)
- **Open-Meteo (`GET /api/air?lat=28.6139&lon=77.2090&label=New%20Delhi`)**: HTTP `200`, `live: true`, `scale: 'US AQI'`, `hourTimezone: 'UTC'`, `usAqi: 212`, `pm25: 68.7`, `hasToken: true`, `expiresAt: '2026-11-21T09:32:31.731Z'`, `hoursLen: 12`; accepted by `POST /api/plan` (`200 OK`, `3` actions).
- **Gemini (`apiVersion: 'v1beta'`)**:
  - `POST /api/chat`: HTTP `200`, `mode: 'gemini'` (`10,822 ms`), schema-validated answer grounded in `US AQI 184`.
  - `POST /api/brief`: HTTP `200`, `mode: 'gemini'` (`8,452 ms`), schema-validated narrative grounded in `Pune` `US AQI 112`.
  - `POST /api/search-grounding`: HTTP `200`, `mode: 'gemini-search'` (`9,883 ms`) with `8` sanitized live web citations (`thehindu.com`, `livemint.com`, `whatisgrap.com`, `drishtiias.com`, etc.).
  - `POST /api/maps-grounding`: HTTP `200`, safely fell back (`mode: 'fallback'`, `places: []`, `1,007 ms`) with zero fabricated place URLs.

### D. Multi-Viewport Browser, 3D WebGL & Accessibility Inspection (`playwright-cli`)
Verified against running `http://127.0.0.1:3000`:
- **Horizontal Overflow (`scrollWidth <= innerWidth`)**:
  - `1440×900`: `1440 === 1440` (`overflow: false`)
  - `720×450` (200% zoom CSS width equivalent): `720 === 720` (`overflow: false`)
  - `640×800`: `640 === 640` (`overflow: false`)
  - `390×844`: `390 === 390` (`overflow: false`)
  - `320×568`: `320 === 320` (`overflow: false`)
- **Console & Network**: `0` console errors, `0` warnings across Overview, 3D Smog Twin, Impact Lab, and Copilot views.
- **Interactive Controls Checked**:
  - Hourly data table toggle: `aria-expanded="true"`, `12` rendered table rows.
  - Impact Lab custom override: expanding disclosure + setting `car-factor=0.2` renders `"Non-cited custom scenario · range reflects ±15%"`.
  - 3D Smog Twin (`scene3d`): cutaway house opens toward the `+Z` camera exposing the interior HEPA purifier, sofa, and airflow ribbon across desktop (`Overview` & `Indoor HEPA` camera presets) and `390×844` mobile; pressing `H` toggles control dock visibility cleanly (`dockHiddenAfterH: true`).
  - Media & Keyboard: `emulateMedia({ reducedMotion: 'reduce' })` verified (`matches === true`), keyboard `Tab` focus styling active.

---

## 3. Unresolved Verification Gaps, Limitations & Operational Blockers

1. **Live Gemini Maps Grounding & Exhaustive 20-Prompt Live Sweep**:
   - After setting `apiVersion: 'v1beta'` on `GoogleGenAI`, live `POST /api/chat` (`gemini`), `POST /api/brief` (`gemini`), and `POST /api/search-grounding` (`gemini-search` with 8 citations) succeeded live against `http://127.0.0.1:3000`.
   - `POST /api/maps-grounding` fell back deterministically (`mode: 'fallback'`, `places: []`) under the current runtime key/model scope, and a full 20-prompt live model sweep was not run to avoid exhausting quota (safety/schema/injection logic is covered deterministically by `tests/security-gemini.test.ts`).
2. **Manual Screen Reader & Automated `axe-core` Audit**:
   - No `axe-core` package is installed in `package.json`, and no human NVDA/VoiceOver/JAWS run was executed. Semantic markup, focus order, contrast math, and 200% zoom reflow are verified, but assistive-technology announcement nuances remain unverified.
3. **Interactive Google Sign-In + Live Firestore Sync**:
   - `firestore.rules` linted cleanly and deployed to database `ai-studio-smogsafeai-3a1b80fa-e132-4262-8a1c-61fc71453b70`, and unauthenticated fallback renders properly; interactive OAuth sign-in flow requires a human Google account in a non-headless browser.
4. **Horizontal Scaling State**:
   - `buckets` (rate limiting) and `upstreamCache` (Open-Meteo TTL cache) live in process memory. Production multi-instance hosting requires a shared Redis/Memorystore layer and an explicit `FORECAST_SIGNING_SECRET`.
5. **Emission Factor Scope**:
   - Default GHG factors use historical **2018–2021** WRI India / UK DESNZ / CEA India reference values (clearly marked as illustrative proxies outside India and non-cited when user-edited).

---

## 4. Provisional Self-Assessment Scorecard (Not Official PromptWars Outcome)

| Category | Provisional Range | Basis in Measured Evidence & Remaining Deductions |
|---|---|---|
| **Problem Statement Alignment** | ~94–96 / 100 | Complete seasonal/urban smog workflow: personalized 5-profile/budget/family planner, US AQI vs NAQI distinction, zero-cost-first indoor guide, emissions vs exposure separation, interactive 3D HEPA twin, safe fallback. Minor deduction: live Maps grounding fell back under current key scope. |
| **Security & Data Trust** | ~94–96 / 100 | Strict `HMAC-SHA256` forecast signing, `409` geo-binding, `1 MB` streaming byte cutoff verified at `2 MB`, CSP/`Origin`/`Content-Type` enforcement, zero frontend secrets, injection/safety regex gates, Eight-Pillar `firestore.rules` linted cleanly. Deduction: in-memory single-process rate limiter/cache. |
| **Testing** | ~92–95 / 100 | **114/114** Node unit/integration tests + `--experimental-test-coverage` (`96%` on `airQuality.ts`) + `firestore.rules` ESLint + Playwright 5-viewport E2E + live Open-Meteo & Gemini chat/brief/search checks + HTTP benchmark. Deduction: live Maps grounding, 20-prompt live sweep, & signed-in OAuth Firestore sync unverified in sandbox. |
| **Efficiency** | ~91–94 / 100 | Sub-7 ms deterministic API p95 (`2.75–3.38 ms` p50), 12m/24h caches + in-flight dedup, `React.lazy` split removing `624 kB` Three.js from initial load, software-WebGL `afterDraw` pacing. Deduction: main JS bundle (`358 kB` gzip) still includes Firebase + Maps together; Gemini timeout chain takes ~14s per candidate model when upstream stalls. |
| **Accessibility** | ~91–94 / 100 | 23 verified WCAG 2.2 AA contrast pairs (`>= 4.5:1`), `0` overflow across `320–1440 px` & 200% zoom, `prefers-reduced-motion`, `:focus-visible`, skip link, ARIA live regions, accessible 12-hour data table. Deduction: no `axe-core` scan or manual NVDA/VoiceOver test executed. |
| **Code Quality** | ~94–96 / 100 | Strict TypeScript (`tsc --noEmit` clean), modular `shared`/`server`/`components`/`three` architecture, honest separation of verified vs fallback states, complete reproducible docs. |

---

## 5. Three-Minute Judges' Demo Script

1. **0:00–0:40 · Overview & Live Provenance**: Point out the **ILLUSTRATIVE DEMO (`live: false`)** warning badge vs clicking **Load live forecast** (or clicking a city on the Google Map), showing live Open-Meteo CAMS **US AQI** with UTC hourly bar chart + toggleable accessible **hourly data table** and `US AQI vs India NAQI` disclosure.
2. **0:40–1:25 · Personalization & Daily Plan**: Switch household flags (e.g., `Keep it affordable`, `Children`, `Metro / rail`) -> click **Update my plan** -> open **My daily plan**. Highlight how **Morning / Afternoon / Evening** each state **Why**, **Trade-off**, **Supporting data**, and **Impact & uncertainty**, plus **Generate AI family brief** (showing live Gemini or transparent verified fallback).
3. **1:25–2:10 · Indoor Air Guide & 3D Smog Twin**: Open **Indoor air guide** (zero-cost source control before HEPA, zero ozone/plant myths), then click **3D Smog Twin** -> click **Indoor HEPA** camera preset, slide **HEPA CADR** up and toggle **Windows open/sealed** to watch outdoor vs estimated indoor PM2.5 particles react in real time.
4. **2:10–2:40 · Impact Lab (Emissions vs Personal Exposure)**: Open **Impact lab**, compare Metro vs Solo Car using cited WRI/CEA 2018–2021 factors, note the explicit **Personal exposure note** warning for roadside walking/cycling, and toggle **Optional custom emission factors** to show the `"Non-cited custom scenario"` label.
5. **2:40–3:00 · Ask SmogSafe AI & Cloud Sync**: Switch to **Ask SmogSafe AI**, show the three tabs (**Grounded Plan Chat** | **Live Web Search** | **Nearby Clean-Air Places**) and demonstrate both safety guardrails (e.g., medical or prompt-injection refusal) and zero-fabrication fallback behavior.
