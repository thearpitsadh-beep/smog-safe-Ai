# SmogSafe AI Executive v4 — Urban Air Quality Assistant

**Working, dependency-free Node.js 20+ application** for personalized low-emission routines, indoor air guidance, sustainable transport scenarios, and an optional Gemini-powered assistant. The app uses live **modeled US AQI** forecasts from Open-Meteo/CAMS when available and a prominently labeled invented **demo** scenario otherwise.

**Challenge problem statement:** Create a GenAI-powered assistant that helps families and communities navigate severe winter smog and urban air pollution. Suggest low-emission daily routines, indoor air quality hacks, and sustainable alternatives tailored to location and lifestyle, explaining the direct impact of choices.

> **Reality check:** This is a tested engineering prototype, not a certified medical device, an official Indian AQI monitor, a deployed production service, or an official competition evaluation. A Gemini API key and real external network access are required to test AI generation. An API without a configured key uses explicitly labeled deterministic fallback advice.

## Start in less than a minute

```bash
# Node.js 20+; npm install is NOT required
cd SmogSafe_AI_Executive_v4
npm start
# Browse to http://localhost:4173
```

Use a different port: `PORT=4174 npm start`.

### Optional Gemini integration

Get a key from [Google AI Studio](https://aistudio.google.com/) and set it **on the server**:

```bash
export GEMINI_API_KEY='YOUR_PRIVATE_KEY'
export GEMINI_MODEL='gemini-2.5-flash'
npm start
```

Never put an API key in the frontend or commit `.env`. This project deliberately does not load arbitrary `.env` files automatically; use environment variables, or for Node 22+, `node --env-file=.env server.mjs` with a private local file.

## What you can actually use

- **Location and household profile:** known Indian cities, geocoded city search, optional user-approved geolocation, travel, budget, home air purifier, children, older adults and sensitivities.
- **AQI dashboard:** US AQI, PM₂.₅, PM₁₀, modeled data source, timestamp, UTC hourly graph and screen-reader-friendly data table.
- **Daily plan:** morning/afternoon/evening actions with *why this helps* explanations, differentiated by household requirements and commute mode.
- **Indoor air:** smoke-source control, damp dusting, HEPA filtration, and context-sensitive ventilation without ozone-generator recommendations.
- **Impact lab:** a transport CO₂e comparison with user-editable, explicitly **published historical (WRI 2018–2021)** kg/km reference factors with user overrides. These are not current verified city-specific values or measured exposure reductions.
- **Optional Gemini:** server-side, structured answers and AI family brief, with model-output checks and a safe deterministic fallback.
- **Accessible offline preview:** `docs/SmogSafe_AI_Standalone_Demo.html` can be opened without network/server; its data and AI answers are labeled demonstration-only.

## Engineering improvements through Executive v3

| Improvement | Implementation | Evidence |
|---|---|---|
| **City-binding fix** | A server-issued forecast snapshot cannot be reused for a different selected city or coordinates. Known city names are checked against expected geography. | `src/location.mjs`, `tests/location.test.mjs`, `tests/server.v3.test.mjs` |
| **Stale-data fix** | Refresh failures, timeouts, expired tokens and late responses following a city change are not displayed as live readings. | `public/app.js`, `scripts/browser_trust_e2e.py` |
| **Forecast provenance** | Only server-owned modeled data can be used with `snapshotId`; client-supplied `air.live=true` is rejected. Snapshot TTL: 18 minutes. | `src/trust.mjs`, `server.mjs`, `tests/trust.test.mjs` |
| **AQI parsing** | UTC timestamps, bounded pollutant values, chronological hourly data and stale/future date checks. | `src/air.mjs`, `tests/air.test.mjs` |
| **Efficiency** | Bounded upstream response payload, in-flight request de-duplication and TTL caching. | `src/provider.mjs`, `tests/provider.test.mjs` |
| **AI response controls** | Strict single-answer JSON, forbidden high-confidence medical/health/impact claims, unsafe purifier advice rejection, truncation/refusal fallback. | `src/trust.mjs`, `tests/server.v3.test.mjs` |
| **Code quality** | Extraction of provider, AQI parsing and location validation into independent modules; 14 static quality invariants. | `npm run lint`, `npm run check` |
| **Accessibility** | Clear demo/live status announcements, keyboard navigation, UTC hourly data table, high-contrast palette and 320px mobile smoke test. | `scripts/browser_accessibility.py` |

## What's new in Executive v4

- **Streaming resource safety:** `src/provider.mjs` now enforces byte caps while reading upstream streams. Oversized chunked responses are cancelled before buffering the full body. The Gemini gateway uses the same streaming reader with a separate 48 KB cap.
- **Modular AI boundary:** the Gemini request, schema check, output validation and fallback integration are separated into `src/gemini.mjs`, independent of the HTTP server.
- **Higher-risk AI safeguards:** high-risk health questions use conservative rule-based guidance; unverified prescriptions, fabricated "current AQI" numbers, and ground-monitor claims are rejected. These filters reduce risk but do not prove the model is incapable of harmful answers.
- **Sourced assumptions:** the Impact Lab defaults to WRI's published non-US commuting factors (including India) from **2018–2021**: gasoline car 0.18368, bus 0.10097, metro 0.03760 kg CO₂e per km. These are *historical benchmarks*, not certified present-day Indian emissions factors. Manual overrides are labeled as user-edited scenarios. Source: https://www.wri.org/sustainability-wri/dashboard/methodology (Table 27).
- **Problem-statement fidelity:** the family planner now varies morning guidance for school, office, mostly-at-home and mixed schedules in addition to transport and household vulnerability.
- **Defensive input and code quality:** null/array profiles are handled without 500 errors, city input is normalized, and upstream geocoder output is validated and constrained.
- **Evidence-oriented QA:** 161 native automated tests, 20 repository invariants, extended keyboard/reflow tests and a 100-request local HTTP smoke benchmark. Exact results and limitations are in `docs/V4_QA_REPORT.md`.

## Engineering verification

```bash
npm run check        # syntax + static invariant gate + native Node tests
npm run benchmark    # 100 local HTTP requests across health/demo/plan/impact
npm run browser:offline # optional: Python Playwright + installed Chromium
npm run browser:trust   # optional: mock-browser live/expired/failure state tests
python3 scripts/browser_deep_accessibility.py  # optional: four-viewport enhanced smoke tests
python3 scripts/browser_accessibility.py  # optional focused a11y smoke checks
```

Node tests run with zero runtime dependencies. Browser checks require `playwright` Python package and Chromium; they are optional for users who only want to launch the app. The current audit's exact execution outputs are in `docs/`.

**Testing limits:** The external-provider connector and Gemini request/response contract are tested with simulated upstream services; neither real Gemini inference nor a deployed HTTPS domain has been independently verified in the build environment. Chromium is restricted from navigating `localhost` here; it tests the **real production HTML, CSS and JS** via a self-contained bundle with mocked fetch, while Node exercises the actual HTTP server separately. This is not a full axe-core or screen-reader certification.

## Important data boundaries

1. The live provider reports **US AQI**, not India's official national AQI. Forecasts are CAMS-modeled values, **not ground-monitor measurements**.
2. A client-supplied AQI or location label is not evidence of a real forecast. The backend creates and validates an expiring snapshot and checks location agreement.
3. If a data request fails or expires, the dashboard must visibly switch to **illustrative demo data**. Demo values are invented and never called measurements.
4. Effects on **transport emissions** and **personal pollution exposure** are different. The calculator estimates only the former, with user-editable factors.
5. Household details are sent to Gemini only when an API key is configured and the assistant is used; do not enter personal medical records or unnecessary identifying details.
6. Content is general environmental guidance, not medical diagnosis or treatment.

## Known limitations and production requirements

- **Gemini is not live-tested with a real API key** here. Model hallucinations remain possible despite schema validation; conduct human/domain reviews.
- **Provider availability is unverified on a public host**. Verify API quota, timezone fields, proper attribution and current output in your deployment region.
- **In-memory tokens, cache and rate limits** are suitable for a single Node process. Use a shared trusted store and rate limiting for scale-out deployments.
- **Emissions factors are cited but dated reference values** (WRI 2018–2021). Replace or validate them using contemporary, city-appropriate evidence before reporting real carbon reductions.
- **Accessibility smoke checks are not full WCAG 2.2 AA certification**. Run automated axe-core auditing, screen readers, zoom/reflow and manual checks on the real deployed app.
- **Security is not certified**. Arrange threat-model review, independent application penetration testing, dependency/SAST review and HTTPS deployment testing.
- **Challenge eligibility is separate from code quality.** Verify PromptWars' specific build process, deadlines and tool requirements, and represent them truthfully.

## Important resources

- Air-quality provider and attribution: https://open-meteo.com/en/docs/air-quality-api
- Gemini API documentation: https://ai.google.dev/gemini-api/docs
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Historical transport factor reference including India (WRI Table 27): https://www.wri.org/sustainability-wri/dashboard/methodology

## Main source files

```text
server.mjs                 HTTP gateway, trusted snapshot enforcement, Gemini, security policies
src/air.mjs                UTC modeled US AQI parsing and validation
src/location.mjs           Coordinates + known-city mismatch rejection
src/provider.mjs           Streaming byte-bounded, deduplicated, cached upstream JSON requests
src/gemini.mjs             Server-only Gemini request, structured output + fact-safety guard
src/trust.mjs              192-bit token snapshots and Gemini text validation
src/logic.mjs              Deterministic household planning + impact calculations
public/index.html          Responsive semantic UI
public/app.js              Browser state, rendering, status, chat, impact
public/styles.css          Responsive palette and accessibility design
scripts/*.py / *.mjs       Performance, browser regressions and static quality checks
tests/*.test.mjs           Native Node unit, integration and security regression tests
docs/GOOGLE_AI_STUDIO_MASTER_PROMPT.md   Paste-ready AI Studio upgrade instructions
```
