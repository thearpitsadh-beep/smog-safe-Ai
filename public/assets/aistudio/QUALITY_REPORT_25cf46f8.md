# SmogSafe AI — Verification notes

**Prepared:** 20 November 2026

## What was actually checked

- `node --check server.mjs`: passed.
- `node --check src/logic.mjs`: passed.
- `node --check public/app.js`: passed.
- `npm run check`: automated tests passed (71 passing cases, including mocked Gemini upstream success and fallback).
- Headless Chromium rendered the **self-contained offline preview** at desktop 1440×980 and mobile 390×844 without uncaught JavaScript errors.
- Browser interaction checks included: section navigation, daily-plan generation (3 cards), impact calculator (16.2 kg in the sample commute), and the chat's deterministic fallback.
- Local API health endpoint responded with truthful `geminiConfigured=false` in this test environment.
- Live Open-Meteo endpoint could **not** be verified from the local environment due to outbound network restrictions; the app displayed a 503 and did not present fabricated readings as live values.
- Gemini's real remote API response was **not** tested using a live key. Server-side integration supports a configurable model and falls back safely if unavailable.

## Requirements coverage

| Evaluation area | Implemented evidence | Remaining work before claiming perfection |
| --- | --- | --- |
| Problem alignment | Personalized family plans, source-labeled US AQI, indoor hacks, transportation alternatives, impact explanations | Evaluate with real users, verify official judges' rubric |
| Accessibility | Semantic labels, `aria-live` chat, skip-to-content, keyboard-focus styles, non-color AQI labels, responsive layouts, reduced-motion CSS | Automated axe audit, full screen-reader testing, contrast audit |
| Testing | Unit and local HTTP integration tests, browser smoke tests | Live upstream integration checks, production E2E tests, load testing |
| Efficiency | No runtime packages, API cache, bounded calls, capped token output | Benchmark against deployed network and realistic traffic |
| Security | Server-only secrets, input length checks, safe output text, CSP, rate limits | Abuse testing and stronger shared rate limits for multi-instance hosting |
| Code quality | Separation of deterministic logic and backend, typed/validated input values, descriptive modules and documentation | Formal lint/typecheck (vanilla JS), production code review |

## Why the preview looks like real data but is not

The offline preview intentionally displays an **invented** New Delhi example: US AQI 184, PM2.5 82.6 μg/m³ and PM10 140.4 μg/m³. These values are static product-demo inputs, **not** current observed or forecast conditions.

## What to improve next for top competition scoring

1. Replace placeholder travel-emissions factors with appropriate cited Indian/region-specific factors and document methodology.
2. Add a reliable Indian monitored-air-quality source **with authorization** and label its AQI scale separately from US AQI.
3. Run a full accessibility scan and correct any WCAG failures.
4. Publish a real HTTPS deployment and test Gemini / air data under actual network conditions.
5. Recruit at least three households with different needs and record whether the recommendations genuinely change their decisions.
6. Prepare a 2-minute scenario demo and honest build/test evidence.
