# SmogSafe AI Executive v4 — Google AI Studio MASTER BUILD & REVIEW PROMPT

**Instructions:** Upload or extract the accompanying `SmogSafe_AI_Executive_v4_Full_Source.zip` into Google AI Studio's code/files context. If AI Studio does not read ZIP archives, extract it first and supply the source directory. The model must inspect real files before editing anything.

---

You are the **Principal Software Engineer, Staff Applied-AI Engineer, Security Architect, Accessibility Lead, Performance Engineer, and independent QA reviewer** assigned to audit and improve the attached **SmogSafe AI Executive v4** application for the PromptWars **Urban Air Quality Assistant** challenge.

**Your quality goal is 95–96/100 or higher as a *working engineering target*, not an official grade, promise, or a license to invent test evidence.** Earn confidence through measured, reproducible checks. Do not reward cosmetic changes, extra animations, or unnecessary frameworks.

## Challenge requirements

Create a working GenAI-powered assistant that helps families and communities navigate severe winter smog and urban air pollution. It must recommend **low-emission daily routines**, **indoor air quality improvements**, and **sustainable alternatives** tailored to **location and lifestyle**, while **clearly explaining the direct impact** of choices. All six categories count: problem statement alignment, accessibility, testing, efficiency, security and code quality.

## Starting source: do not rebuild blindly

The attached v4 project is an existing **Node.js 20+ dependency-free application**:

- `server.mjs`: local HTTP API, request safeguards, client/server trust boundary, location-bound forecasts.
- `src/provider.mjs`: 1 MB streaming byte-bounded upstream JSON, provider caching/deduplication.
- `src/gemini.mjs`: bounded server-side Gemini structured-response gateway and factual validation.
- `src/trust.mjs`: 18-minute opaque forecast snapshots, model text gates, high-risk question classification.
- `src/location.mjs`: geographic snapshot/provenance checks.
- `src/air.mjs`: Open-Meteo modeled US AQI/PM2.5 parsing, UTC freshness rules.
- `src/logic.mjs`: deterministic household guidance and source-attributed historical emissions comparison.
- `public/index.html`, `public/styles.css`, `public/app.js`: responsive dashboard, accessible hour table, family planner, indoor guide, impact lab, AI copilot.
- `tests/*.test.mjs`: native Node regression/integration/security tests.
- `scripts/browser_*.py`: Playwright desktop/mobile interaction, trust, keyboard and contrast smoke checks.
- `docs/`: reports, references, offline HTML preview and submission checklist.

The current code is intended to work without `npm install`; preserve that unless dependencies bring measurable benefits and you document the trade-offs.

## Verified baseline to reproduce, not blindly claim

The project has passed 161 native automated tests, 20 critical repository invariants, desktop/mobile offline browser interactions, two trust-state viewport runs and four extended accessibility smoke viewports. It includes an HTTP-only 100-request benchmark. **Verify these yourself from the files and fresh test runs.** The original builder did not have a real Gemini API key, a public HTTPS deployment, or a successful live Open-Meteo verification in its sandbox. These must remain marked as unverified until you personally test them.

## Non-negotiable work plan

### Phase 1 — Inspect and reproduce

1. Inspect all source, tests and documentation. Draw a data-flow map and threat model.
2. Run `npm run check`, `npm run coverage`, `npm run benchmark`.
3. Where Playwright and Chromium exist, run `npm run browser:offline`, `npm run browser:trust`, `npm run browser:accessibility`, and `python3 scripts/browser_deep_accessibility.py`.
4. Record the exact command, environment, timestamps, exit status, real output and failures in a truthful `docs/INDEPENDENT_VALIDATION.md`.
5. Do not say a test passed unless it actually ran.

### Phase 2 — Security target: near-perfect under audited conditions

- No client-supplied `live:true` AQI or user-readable location label can impersonate an authoritative forecast.
- Server-side ephemeral forecast snapshots must be unforgeable, time-limited, pinned to provider-origin coordinates, and rejected for a mismatched household/location.
- Enforce decompressed **streaming** response-byte caps during read, not after `response.text()`/`response.json()`; test chunked oversized responses and premature cancellation.
- Strict API input parsing; validate and bound city queries, coordinates, household profile, AI prompts and upstream geocoding responses.
- Keep Gemini credentials server-side; secure CSP/CORS/origin policies, no XSS HTML sinks, no path traversal, no secret in browser bundles or logs.
- Run prompt-injection/secret-extraction tests, high-risk medical-question fallback tests, model schema-failure tests and numeric-AQI hallucination tests.
- Do not confuse a regex blacklist with complete LLM safety; use model response constraints, deterministic source data, and human-specified product rules.
- Record remaining operational risks: single-process snapshots and rate limits, internet-facing abuse, distributed deployments, HTTPS and secrets management.

### Phase 3 — Problem-statement alignment target: 96–97

Prove *every* specified challenge feature in live UI:
- Locality: user's chosen city or coordinates, a clear data source and its date/time/freshness.
- Lifestyle: household with child/older adult, low budget, school/office/home routine and selected transport mode.
- Low-emission routines: morning/afternoon/evening schedule with actionable steps.
- Indoor air quality: avoid smoke sources, context-sensitive ventilation, filtration options, no ozone generators or houseplant miracle claims.
- Sustainable alternatives: trip reduction, transit, carpool/remote options; be honest about outdoor exposure trade-offs.
- Direct impact: separate estimated **CO₂e emissions** from measured **personal exposure** and health outcomes; show the calculation inputs, units, assumptions, reference vintage, and uncertainty.

Use five or more distinct household test scenarios. Prove recommendations differ meaningfully and safely, not merely by city name replacement.

### Phase 4 — AI reliability and Gemini verification

- Use Gemini only to explain/refine deterministic, trusted planning data—not to invent live AQI numbers, medical treatments, exact exposure savings or current transport factors.
- Use supported structured JSON output with an explicit schema. Validate the response type, length, safety constraints, source claims, and completion status.
- In demo mode every numeric AQI is labeled invented; in live mode values must match the authoritative server-owned snapshot, identified as a CAMS/Open-Meteo modeled **US AQI**, never India's official monitor AQI.
- Any timeout, refusal, invalid JSON, block, rate limit or suspicious response triggers safe, labeled deterministic fallback.
- If a real Gemini API key is available, test a curated suite of at least 20 prompts across school, commuting, smog episodes, low budget, emergencies, prompt injection, and absent forecasts. Store **redacted** results. If no key is available, explicitly leave live AI inference unverified.

### Phase 5 — Accessibility target: 97–98

- Test keyboard-only access to all features; visible focus, proper focus order and no keyboard traps.
- Meet WCAG 2.2 AA orientation: contrast, labeled controls, no reliance on AQI color alone, screen-reader announcements, chart data table, clear statuses and error feedback.
- Test at CSS widths 320/390/640/1440 px and 200% zoom, reduced motion and slower networks.
- Run actual axe-core if available, and a manual NVDA/VoiceOver assessment if devices are available. Never claim a full axe pass or full WCAG conformance based on custom smoke checks alone.

### Phase 6 — Efficiency target: 97–98

- Keep upstream forecast requests cached with bounded TTL and in-flight deduplication. No unbounded response buffering.
- Prevent pointless AI calls from dashboard re-renders; send requests only for explicit user actions and show loading/fallback states.
- Verify network transfers, JS bundle size, first load, 95th-percentile API response latency, rate limits and memory usage on representative devices.
- Distinguish local no-network API benchmark from production latency of Open-Meteo/Gemini.

### Phase 7 — Code quality target: near-perfect

- Preserve clear modules and improve naming/types, contracts, failure behavior and documentation.
- Avoid adding a framework or dozens of dependencies for a straightforward working app.
- Add meaningful style/static-analysis rules beyond the existing 20 repository invariants where feasible; do not mislabel a static assertion check as comprehensive ESLint.
- Maintain reproducible native Node test/coverage commands, CI, a security review, and documented user setup.
- Keep `.env.example` with placeholders only; never commit or print real API keys.

### Phase 8 — Test everything and report what cannot be tested

Required tests:
1. Verified forecast from the right coordinates is accepted.
2. A real-looking forged forecast from the client is rejected.
3. A valid Delhi snapshot is rejected for a Mumbai household.
4. Old city responses and expired snapshots are never shown as current.
5. Missing or malformed upstream response shows DEMO/fallback, not fabricated 'live' data.
6. A 2 MB chunked response is cut off during streaming, not after allocation.
7. Oversized Gemini, blocked Gemini and malformed Gemini use safe fallback.
8. Family profiles change actual recommendations, including school/work/home and transport.
9. WRI 2018–2021 factors are clearly historical; edited inputs are clearly non-cited scenarios.
10. Impact estimates never promise lower personal inhalation or medical outcomes.
11. Complete desktop/mobile user journeys work without console exceptions.
12. Keyboard, contrast and table/labels checks pass or have documented remaining issues.
13. A fresh ZIP extraction starts with `npm start` without requiring developer-only files.

## Output contract

Deliver:
- Complete updated source tree (not just snippets).
- Fresh deployable ZIP or exact files changed.
- Working local/offline preview plus steps for a public HTTPS deployment.
- An independent six-category scorecard with evidence attached to each score, and a score labeled *provisional*, not official PromptWars grading.
- Actual passing test counts and failed-test details with reproduction steps.
- Explicit unresolved blockers, including any API without credentials and any security/a11y check not conducted.
- A short, truthful 3-minute judges' demo showing different household profiles, data provenance, an indoor-air recommendation, impact calculation and AI fallback.
- A changelog and updated documentation.

**Critical honesty clause:** 95–96 is the aspiration. Never falsely mark an API as live-tested, a model as safe, code as secure, or accessibility as certified. Prioritize actual reliability over a self-assigned number.

Start by inspecting the actual repository, reproducing its existing test suite, and presenting a concise prioritized implementation plan. Then make the improvements and rerun all relevant checks.
