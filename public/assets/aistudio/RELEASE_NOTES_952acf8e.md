# SmogSafe AI Executive v4 — Release Notes

**20 November 2026 | Working local engineering upgrade**

## Addressed from v3's independent review

1. **High severity: unbounded upstream buffering.** Implemented `readBoundedJSON` with streaming byte accounting and cancellation. Applied to Open-Meteo/geocoding and Gemini; prior implementation called `response.text()`/`response.json()` before full bound enforcement. Tests assert early cancellation under chunked transfer.
2. **Medium severity: unsupported emissions numbers.** Default factors are now published, *historical WRI 2018–2021 non-US commuting factors*: gasoline car 0.18368, bus 0.10097, metro 0.03760 kg CO₂e/km. The interface links to the exact methodology. These are not current local measurements, and manual edits are labeled.
3. **AI hardening.** A separate `src/gemini.mjs` handles the provider boundary. 48 KB maximum Gemini response; refuses incomplete, blocked, invalid JSON, forbidden medical prescriptions, fabricated live/official AQI assertions and unsupported impact figures. Urgent medical questions go to conservative fallback.
4. **Problem alignment.** Morning routines adapt to school, office, home and mixed schedules, tested across household/commute combinations.
5. **Defensive input handling.** Null/array profiles no longer cause server errors; location labels are normalized; geocoding output is constrained.
6. **QA improvements.** 161 native tests, 20 static invariants, four viewport accessibility smoke checks, desktop/mobile browser workflow tests, backend snapshots/race regression, fresh ZIP smoke test, 100 local HTTP benchmark requests.

## Explicit limitations

- No real Gemini API key; inference tested with mocked upstream data only.
- No verified public HTTPS deployment; Open-Meteo network connection not confirmed here.
- No complete axe-core audit or manual screen-reader certification; offline browser accessibility checks are not a full WCAG 2.2 AA review.
- In-memory rate limiting and snapshots are single-instance protections; use a shared trusted store and external rate limiter before multi-instance deployment.
- Historical WRI factors must not be described as current observed emissions savings.
- This is not a verified PromptWars or Google AI evaluation score. The 95–96 target remains aspirational.

## Start

`npm start` then open http://localhost:4173. Run `npm run check`, `npm run benchmark`, and optionally the browser scripts.
