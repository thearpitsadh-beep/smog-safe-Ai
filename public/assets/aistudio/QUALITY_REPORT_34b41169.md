# SmogSafe AI Executive v4 — Independent local QA record

**Build date:** 2026-11-20 · **Scope:** Source ZIP's Node application, isolated unit/HTTP integration tests, offline Chromium browser tests and mocked upstream endpoints.

## Verified execution

| Check | Executed result | Limitation |
|---|---|---|
| `npm run check` | 161/161 native Node tests passed; 0 failed | Mocked Gemini/Open-Meteo integration, not external live services |
| `npm run lint` | 20/20 critical repo invariants passed | This is not comprehensive ESLint/SAST or a security certification |
| `npm run coverage` | Native Node coverage report generated | Overall includes tests; don't quote overall as app-only |
| `src/gemini.mjs` line/branch coverage | 100.00% / 93.55% | Measured on mocked model responses |
| `src/logic.mjs` line/branch coverage | 100.00% / 94.40% | Unit/integration execution paths only |
| `src/provider.mjs` line/branch coverage | 100.00% / 87.80% | Simulated chunked provider response stream |
| `npm run browser:offline` | Desktop and mobile complete workflow tests passed | Inline offline copy of exact production HTML/CSS/JS, no real live service |
| `npm run browser:trust` | 2/2 viewport trust-state scenarios passed | Live source simulated; tests include stale/wrong-city behavior |
| `npm run browser:accessibility` | 3/3 viewports passed (320, 390, 1440px) | Smoke test, not WCAG certification |
| `python3 scripts/browser_deep_accessibility.py` | 4/4 viewports passed (320, 390, 640, 1440px), sampled text contrast >=4.5:1 | No axe-core or manual NVDA/VoiceOver study |
| `npm run benchmark` | 100 localhost HTTP requests, 0 errors | Excludes internet, Gemini, TLS and deployed concurrency |
| **Fresh ZIP extraction** | 161/161 tests reran successfully + 10/10 runtime HTTP checks | App started from ZIP without project dependencies |

### Local-only benchmark p95

| Endpoint | Requests | p95 |
|---|---:|---:|
| Health | 25 | 3.14 ms |
| Demo | 25 | 1.25 ms |
| Personalized plan | 25 | 1.72 ms |
| Impact estimate | 25 | 1.18 ms |

These are local measurements and must not be presented as production SLAs.

## Clean-archive release verification

The compressed source ZIP was extracted into a new directory. `npm run check` passed all 161 tests again without running `npm install`. The Node server was started on an ephemeral port and **10/10 HTTP checks passed**: health/version, HTML, JavaScript, CSS, private module non-exposure, demo-source integrity, family plan generation, cited-impact basis, forged-live rejection and secrets-path protection.

## Key confirmed fixes

1. **Streaming byte limits:** provider and Gemini responses are rejected while streamed, with cancellation on overflow; tests verify early termination for chunked content.
2. **Fact-control and high-risk AI bypass:** deterministic fact context, bounded model response, rejection of invented official/current AQI and prohibited medical claims, urgent medical fallback, strict JSON acceptance.
3. **Data provenance:** existing 18-minute server-owned snapshot, location-bound to known city/coordinates; browser stale/out-of-order live data protections.
4. **Historically sourced emissions estimate:** WRI's 2018–2021 non-US commuting reference Table 27 factors, with source link, year and assumptions in UI/API; manual edits are labeled separate. Not a certified modern Indian factor.
5. **Problem alignment:** distinct school, office, home and mixed-schedule guidance, verified across household/transport combinations.
6. **Code organization:** independent Gemini gateway module, bounded upstream transport module, typed-shape contracts through actual integration tests, CI and source documentation.
7. **Accessibility:** textual AQI labels, semantic forms and tables, keyboard navigation, reduced-motion responsive tests, sampled contrast >=4.5:1.

## Unverified items — do not claim completed

- **Real Gemini integration:** no API key has been provided; all model calls used simulated responses. Prompt injection remains a probabilistic risk and requires human/domain evaluation.
- **Real Open-Meteo connectivity:** forecast response parser tested against fixtures, but internet connection from this runtime was not validated. Provider is *modeled US AQI*, not Indian national AQI/ground measurements.
- **Public deployment:** no HTTPS web service deployed; browser network to localhost blocked by environment, so UI tested using Playwright `set_content` with exact frontend assets and mocked fetch.
- **Comprehensive accessibility:** automated axe-core package could not be installed due absent registry access; no independent manual screen-reader certification.
- **Large-scale security:** not independently penetration tested; in-memory rate limits and snapshots are one-process only.
- **Carbon impact:** dated commuting reference values, not 2026 actual vehicle/fuel/occupancy measures.
- **Official evaluation score:** no PromptWars private judging ran. A 95–96 outcome cannot be claimed or guaranteed.

## Engineering score interpretation

The build targets 95–96 as an **aspiration**, backed by stronger automated evidence than v3. A high real-world category score still depends on external integrations, deployed behavior, judges' criteria and independent accessibility/security review. This QA record reports measurements, not a fabricated contest grade.

## References

- Open-Meteo AQI & provider attribution: https://open-meteo.com/en/docs/air-quality-api
- World Resources Institute (historical commuting factors, Table 27): https://www.wri.org/sustainability-wri/dashboard/methodology
- Google Gemini API: https://ai.google.dev/gemini-api/docs
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
