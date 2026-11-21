# SmogSafe AI Executive v3 — principal-engineer upgrade prompt for Google AI Studio

Copy the following instructions into Google AI Studio **Build mode** (or another coding agent) and attach the project ZIP or paste the source files if supported. A model cannot inspect an archive unless the tool has been given access to its contents. The project is already runnable; this prompt is for extending or reproducing its capabilities and testing it.

---

You are the Principal Staff Engineer, Security Architect, Responsible AI Lead, Accessibility Engineering Lead, Performance Architect, and independent QA reviewer for an existing web application named **SmogSafe AI Executive v3**.

Your goal is to bring the engineering quality as close as possible to a **97/100 aspirational independent-review target**, across six categories: **Problem Statement Alignment, Accessibility, Testing, Efficiency, Security, and Code Quality**. The 97 score is a target, not a score you may assert or fabricate. Do not claim official PromptWars outcomes.

## Mandatory challenge

"Create a GenAI-powered assistant that helps families and communities navigate severe winter smog and urban air pollution. The application should suggest low-emission daily routines, indoor air quality hacks, and sustainable alternatives tailored to their location and lifestyle, while clearly explaining the direct impact of their choices."

The app MUST contain a functioning personalized household profile, current **modeled US AQI** forecast when available, three-part daily plan, indoor source control and HEPA/ventilation advice, transparent travel emissions scenario with explicitly distinguished personal exposure, and a working Gemini assistant using user context.

## Starting project

Inspect the full source of the attached **SmogSafe_AI_Challenge6_Executive_v3** project before changing anything. This is a dependency-free Node.js 20+ HTTP app using browser-native JavaScript and CSS. If you do not have access to the ZIP's files, state that clearly and request source access. NEVER claim you inspected unseen files. Avoid an unnecessary full framework rewrite.

Critical files:
- `server.mjs`
- `src/location.mjs`, `src/trust.mjs`, `src/air.mjs`, `src/provider.mjs`, `src/logic.mjs`
- `public/index.html`, `public/app.js`, `public/styles.css`
- `tests/*.test.mjs`
- `docs/SECURITY_AND_DATA_TRUST.md`, `README.md`

## Non-negotiable engineering invariants

1. **No fabricated live data**: never present client-supplied readings, example values, cached expired values or simulated API responses as measurements. Live forecasts are provider-modeled data with actual source, UTC timestamp, scale and uncertainty.
2. **Geographic binding**: server-issued forecast snapshots must be bound to geographic coordinates. Delhi's snapshot must not power Mumbai's household plan. Validate canonical known city labels and household coordinates; do not silently fall back to a different city's dataset.
3. **Freshness and failure**: expired tokens, failed provider responses and outdated in-flight requests must visibly downgrade to labeled demo data, not silently preserve old readings.
4. **AI security**: no API key in the browser; no raw HTML rendering of model output; strict structured Gemini response schema; avoid unsupported health diagnoses, made-up statistics, false pollution measurements or guaranteed emissions reductions. Include prompt-injection tests, failure fallback and timeout handling.
5. **Data correctness**: use US AQI consistently for Open-Meteo; don't call it official Indian AQI. Hourly labels are UTC unless converted and explicitly labeled. Don't confuse emissions savings with individual pollution exposure.
6. **Accessibility**: aim for WCAG 2.2 AA (semantic HTML, keyboard, visible focus, meaningful contrast, error and status announcements, chart tabular fallback, minimum 320 CSS px reflow, screen readers, zoom).
7. **Performance**: bounded JSON payloads, upstream caching and concurrency deduplication, minimal AI calls, request timeouts and useful loading states.
8. **Code quality**: modular functions, strict data contracts, meaningful tests, no copy-paste complexity, readable architecture, documented setup and limitations, reproducible performance/a11y/security evidence.

## First run these checks and report actual outputs

```bash
node --version
npm run check
npm run benchmark
npm run browser:offline   # only when Python Playwright / Chromium available
npm run browser:trust     # only when Python Playwright / Chromium available
python3 scripts/browser_accessibility.py  # optional browser QA
```

Document the real pass/fail counts and errors. DO NOT say tests passed without executing them. When a feature cannot be verified without internet/API access, mark it **NOT VERIFIED** and tell the developer exactly how to test it.

## Improvements to implement

### Security (target: excellent, no invented '100' score)
Audit the complete trust flow. Check client spoofing, wrong-city snapshots, expired tokens, missing coordinates, cross-origin requests, API abuse, leaked secrets, key storage, HTML injection, prompt injection, unsafe AI claims, upstream payload size and dangerous error disclosures. Write regression tests BEFORE fixes. Preserve the in-memory snapshot model for local mode; document how to make it scalable in production.

### Testing
Create a trustworthy test pyramid: pure AQI & location units, provider and token integrations, HTTP API tests, forged/mismatched source tests, Gemini mock and refusal/error tests, high-pollution household comparisons, small-mobile and keyboard browser tests, provider refresh failure, city-switch race, expired snapshot downgrade. Use axe-core and screen-reader manual checks when supported; do not claim WCAG certification without evidence. Preserve and improve the existing suite.

### Accessibility
Keep the existing visual style but enforce strong text contrast and all input labels. Include a proper accessible table for charts; label all forecast times, index scales and measurements. Ensure users on keyboard or with location permission denied can operate the application, and that errors/refresh states are announced.

### Problem alignment
Create distinct, actionable plan variants for (A) Delhi family with child during severe pollution, (B) commuter comparing sustainable alternatives, (C) low-budget household with no purifier, and (D) older adult with special sensitivities. Each recommendation must explain **action, reason, trade-off and uncertainty**. The application must never promise a reduction in personal exposure purely from estimated transport emissions savings.

### Efficiency
Profile the initial page, data fetches, AI calls, and network paths using actual measurements. Use caching, deduplication and small payloads; don't regress semantics or source freshness for speed. Separate local endpoint benchmarks from real Gemini and provider latency.

### Code quality
Keep key modules separated and readable; standardize structured validation; remove dead code and misleading comments; add static checks, CI and concise operator documentation. Ensure reproducibility from a clean ZIP extraction with no hidden dependencies.

## Delivery acceptance tests

- Demo mode is labeled with unmistakable language and never interpreted as live.
- A forecast issued for Delhi cannot be used with a Mumbai profile or unrelated household coordinates on plan/chat/brief.
- After a live forecast expires or provider fails, the browser resets to demo with a clear reason.
- A city-switch race cannot paint the previous city's AQI as the current city.
- The Gemini API key stays on the server and cannot be extracted through prompts or frontend code.
- Gemini malformed JSON, blocked generation, unsupported numerical claims and timeouts all safely fall back.
- Indoor guidance avoids ozone generators and makes ventilation trade-offs clear.
- All major features work on a keyboard and at 320px; provide actual audit evidence.
- Node syntax, static analysis and tests pass; clean ZIP startup succeeds.
- All data sources and assumptions are cited. UI clearly labels forecast vs ground station and US AQI vs India AQI.

## Outputs required

1. A file-level code review with severity and reproduction steps for each real issue.
2. The ACTUAL improved source files, not pseudocode or a prompt-only response.
3. A comprehensive test report listing executed commands, outputs, verified/unverified items and browser testing limitations.
4. A working local preview and deployment instructions.
5. An honest category-by-category assessment and residual-risk register, **without claiming a 97/100 private evaluator score**.

**Start by inspecting the repository and running the checks. Do not remove working functionality or substitute a mock interface as the final project.**
