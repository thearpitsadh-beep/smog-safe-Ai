# Executive v3 — Senior Engineering QA Report
**Audit date:** 20 November 2026  
**Scope:** Locally run source code, offline/HTTP-mocked browser UX, native Node HTTP integration tests.  
**Score status:** The user's **97/100** is an *aspirational goal*. No official PromptWars evaluation was run; no evidence supports claiming a verified 97/100 across all six categories.

## Executed results

| Verification | Result | Limit |
|---|---|---|
| `npm run check` | **136 / 136 Node tests passed**, 0 failed | Native unit + mocked HTTP integration tests; not real upstream inference |
| `npm run lint` | **14 / 14 critical repository invariants passed** | A focused static invariant gate, not full ESLint/SAST certification |
| `npm run benchmark` | **60 requests, 0 errors, median 1.31 ms, p95 3.86 ms** | Local `/api/health` and `/api/demo` only, no internet/API latency |
| `npm run browser:offline` | **Desktop and mobile passed** | Exact frontend bundled with intentionally invented offline data |
| `npm run browser:trust` | **2 / 2 viewport scenarios passed** | API mock for live/expired/failure/late-city-response handling |
| `python3 scripts/browser_accessibility.py` | **3 / 3 viewport scenarios passed (320, 390, 1440px)** | Focused keyboard, button name, form label, accessible status, overflow checks; not a full WCAG audit |
| Targeted contrast measurement | Sampled text ~7.46–7.95:1 | Only selected text/background combinations; not a sitewide analysis |

## Confirmed defects fixed from Pro v2

1. **Valid snapshot attached to wrong city:** Previously an authentic Delhi forecast could be accepted alongside a Mumbai profile. The server now checks canonical city coordinates and profile coordinates against the stored snapshot and rejects the mismatch with HTTP 409. Tested for `/api/plan`, `/api/chat`, `/api/brief`.
2. **Stale or wrong-city client display:** Failed refresh, token expiry and late response from a previous city now downgrade or preserve clearly labeled demo state rather than silently displaying the old location's forecast. Browser tests cover all three cases.
3. **Unbounded upstream provider parsing:** Forecast and geocoding responses now use a bounded 1 MB upstream JSON reader, request timeouts, caching and concurrent-request deduplication. UTC forecast parser rejects stale, future-dated, malformed, negative and out-of-range data.
4. **Gemini incomplete generation:** Truncated/blocked model generations now trigger the deterministic safe fallback. Additional unsafe purifier and fabricated-data output patterns are rejected.
5. **Monolithic data transformation:** Forecast, provider networking, geospatial checks and trust rules are now separate tested modules.
6. **Ambiguous hourly times:** Current provider hours are labeled UTC; modeled US AQI is consistently distinguished from Indian AQI or ground-monitor measurements.

## Confidence limits by requested evaluation category

| User's target | Verified evidence | What remains to validate before claiming near-perfect compliance |
|---|---|---|
| **Security ~100** | Trusted location snapshots, forged-live rejection, CSP, request limits, output validation, token expiry tests | Independent pentest; production HTTPS, key management, multi-instance rate limits; model-adversarial review |
| **Code quality ~100** | Modules separated, syntax check, no extra runtime dependencies, CI checks, 14 invariants | Comprehensive typed linting / maintainability review and long-term project structure |
| **Efficiency 97–98** | Dedup/cache upstream, bounded payload, 60-request local benchmark | Actual Gemini/provider response times, CDN bundle metrics and load test on public deployment |
| **Testing 100** | 136 automated passes, backend integration + browser mocks, clean ZIP validation | Real Gemini sandbox/production key, live provider, edge cases on target devices and hosts |
| **Accessibility 97–98** | Keyboard, labels, contrast samples, small 320px reflow, chart data table | Full axe-core audit, NVDA/VoiceOver, zoom/reflow across browsers and full WCAG 2.2 AA manual review |
| **Problem alignment 96–97** | Household planner, indoor source control, lower-emission transport, explanatory comparisons and optional Gemini | Domain expert review, real user trials, cited local emissions factors, production-quality personalized AI output |

## Explicitly unverified

- **Real Gemini API**: no user Gemini key was available. All structured Gemini interactions were simulated; cannot claim real Gemini generation quality or safety.
- **Live Open-Meteo data**: endpoint URL, parameters and JSON parsing were tested with a simulated provider; this environment has not confirmed successful public network calls.
- **Public HTTPS deployment**: absent. Browser tests used the exact production frontend code with inline local script and mocked fetch, while the real Node HTTP server was tested independently.
- **Official competition score**: not available; a 97/100 claim would be speculative.
- **Certified regional carbon estimates**: the app intentionally uses editable illustrative factors, not verified local emission factors.
- **Full accessibility certification**: neither a complete automated axe-core pass nor manual screen-reader certification was conducted.

## Sources and methodology

- Provider docs: https://open-meteo.com/en/docs/air-quality-api
- Gemini API docs: https://ai.google.dev/gemini-api/docs
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- GHG reporting conversion factors (UK methodology; not silently applied to India): https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026

**Judgment:** Executive v3 is substantially more trustworthy and testable than the earlier Pro v2 app. It is a strong **local prototype and deployable source project**, but claiming a 97+ category score without real Gemini, live-provider and deployed-system validation would be unsupported.
