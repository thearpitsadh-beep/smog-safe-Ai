# SmogSafe AI — Urban Air Quality Assistant

A responsive, family-first air quality companion for the PromptWars Virtual **Urban Air Quality Assistant** challenge. The app turns air-quality forecasts into practical household plans, transparent emissions comparisons, affordable indoor-air guidance, and a Gemini-powered question-and-answer interface with a deterministic fallback.

**Important:** This is a tested, locally runnable application—not a hosted website or a guarantee of competition scores. Live data requires outbound internet; Gemini requires your own API key. Demonstration values are INVENTED and labeled prominently.

## Start in less than a minute

**Requirements:** Node.js 20 or newer. **No `npm install` required.**

```bash
cd SmogSafe_AI_Challenge6
npm start
# open http://localhost:4173 in Chrome, Firefox, or Edge
```

If you want to run this with **Gemini in Google AI Studio**:

```bash
# macOS/Linux — put your own key here, do not commit it
export GEMINI_API_KEY="YOUR_KEY_FROM_GOOGLE_AI_STUDIO"
export GEMINI_MODEL="gemini-2.5-flash"
npm start
```

Windows PowerShell:

```powershell
$env:GEMINI_API_KEY="YOUR_KEY_FROM_GOOGLE_AI_STUDIO"
$env:GEMINI_MODEL="gemini-2.5-flash"
npm start
```

This project does **not automatically read `.env`**; you can also use `node --env-file=.env server.mjs` with recent Node versions. Never put a real API key inside browser code, a public repo, or the included offline preview.

## Features

| Area | How it works |
| --- | --- |
| **Air-quality overview** | Current modeled US AQI, PM2.5, PM10, a 12-hour forecast graph, explicit source and freshness label |
| **Location** | Preset Indian cities; other cities through Open-Meteo geocoding; optional browser geolocation with permission |
| **Household profile** | School/office/home routines, transport, spending budget, children, older adults, sensitive members, existing purifier |
| **Personalized daily plan** | Safe rule-based morning/afternoon/evening actions, explicit reason and impact mechanism, downloadable plan text |
| **Indoor air** | Source control, cleaning, ventilation trade-offs, optional appropriately sized HEPA filtration, no false plant/ozone claims |
| **Impact lab** | Transparent, adjustable illustrative commuting emissions comparison with assumptions and limitations |
| **AI copilot** | Gemini answers on the server when configured; secure deterministic guidance otherwise; no stored chat history |
| **Resilience** | User-visible errors, fallback data, rate limiting, bounded inputs, cached air queries, timeouts |

## Source and labels

- **Open-Meteo air-quality API:** <https://open-meteo.com/en/docs/air-quality-api>. Supplies **modeled forecasts** informed by Copernicus CAMS. The requested index is **US AQI**, **not India's national AQI**, and the app labels it as such. Open-Meteo values aren't a substitute for government ground-monitor readings or local health warnings. Use their terms and attribution when deploying.
- **Open-Meteo geocoding:** <https://open-meteo.com/en/docs/geocoding-api>.
- **Gemini:** <https://ai.google.dev/gemini-api/docs>. Server uses the supported `generateContent` REST endpoint and the configurable `gemini-2.5-flash` model.
- **No API/data available:** The app starts with explicitly invented example numbers so you can explore the product. Press **Load live forecast** in an internet-enabled environment. The app never silently treats examples as measured AQI.
- **Travel CO₂e:** `car 0.18`, `bus 0.08`, `metro 0.045 kg CO₂e/km`; walk, cycle and no commute `0` for the purpose of this **illustrative** comparison. These are *placeholder factors*, not region-specific emission factors or verified lifecycle assessments. Real usage must replace them with cited, appropriate factors. Emissions are **not** an estimate of reduced inhalation or individual health benefit.

## Tests

```bash
npm test
npm run check
```

`npm run check` syntax-checks all JS files and runs 71 native Node tests. Tests cover AQI bands, profiles, changing household recommendations, impact math, medical/secret-query fallbacks, API validation, HTTP headers, safety limits and asset serving. The offline preview was also browser-tested on desktop/mobile; see `docs/QUALITY_REPORT.md`.

## Deployment

`server.mjs` is a small Node HTTP server; it can be deployed to any platform that runs Node 20+. Use the `PORT` environment variable (default 4173). You can build a Docker image:

```bash
docker build -t smogsafe-ai .
docker run -p 4173:4173 -e GEMINI_API_KEY="YOUR_KEY" smogsafe-ai
```

Keep TLS termination, centralized rate limiting, secret management, monitoring, and API usage quotas at your hosting platform in a real production deployment. In-memory caching/rate limiting is suitable for a single-instance challenge demo, not distributed production.

## Project layout

```text
server.mjs               HTTP API, Gemini integration, Open-Meteo connector, security headers
src/logic.mjs            AQI categories, deterministic planner, impact math, safe fallback
public/index.html        Accessible dashboard and app layout
public/styles.css        Responsive styling
public/app.js            Front-end state, charts, city selection, planner, chat
public/favicon.svg       App logo
package.json             Zero-runtime-dependency scripts
tests/logic.test.mjs      Deterministic unit tests
tests/server.test.mjs     API integration tests
docs/QUALITY_REPORT.md   Limits and manual testing results
docs/AI_STUDIO_PROMPT.md Copy-paste prompt for Google AI Studio
.env.example             Environment template (no secrets)
```

## Safeguards and honest limitations

- Not a medical diagnosis tool; severe symptoms need licensed care and official guidance.
- The open-source demo has **no user accounts** and intentionally does not persist profile or conversation history server-side.
- The front-end renders model replies as text, not executable HTML; requests have size limits and the server sets a strict Content Security Policy.
- Gemini may hallucinate despite system prompting. Deterministic recommendations and labels remain the main source of in-app guidance.
- Multi-region localization, official CPCB integration, verified emissions factors, stress/load testing, and a public hosted deployment are **not yet included**.
- API rate limits and Gemini usage fees depend on your provider account and should be monitored separately.

## Challenge alignment

| Problem objective | Where the app addresses it |
| --- | --- |
| Severe winter smog | AQI overview, next-hours forecast, appropriate outdoor-routine adjustments |
| Low-emission daily routines | Personal plan's afternoon action, impact lab |
| Indoor air quality hacks | Indoor guide and evening plan |
| Sustainable alternatives | Travel comparison and rule-based alternatives |
| Tailored by location and lifestyle | City selector + household profile |
| Explain direct impacts | `Why this matters` explanations + visibly labeled illustrative emissions calculations |
| GenAI-powered assistant | `/api/chat` with server-side Gemini; rule fallback when unconfigured |

**Build note:** The user may choose to develop with Codex or Google AI Studio. No Google Antigravity or platform-specific SDK is required to **run** this project. However, contest organizers may separately mandate a particular build process: verify the current rules before submitting.
