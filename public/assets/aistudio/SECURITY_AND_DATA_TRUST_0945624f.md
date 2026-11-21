# SmogSafe AI Executive v3 — security and data provenance

## Protected assets
- Gemini API credentials (server-only environment variable).
- Forecast provenance (server-created snapshot with 18-minute expiry).
- Household location integrity (city label and coordinates must match snapshot).
- AI and web rendering integrity (validated, plain-text answers; `textContent`).

## Threats and controls

| Threat | Control | Residual limitation |
|---|---|---|
| Browser forges official/live AQI | `air.live=true` rejected; trusted live data must reference server-issued snapshot | User can tamper with their own browser display; never trust screenshots as official evidence |
| User applies Delhi AQI to Mumbai | Verify snapshot vs household coordinates and canonical known-city coordinates | Arbitrary geocoded labels are descriptive, not independently authenticated |
| Token replay | Unpredictable 192-bit random token, 18-minute expiry and location checks | Token remains a bearer value; not bound to authentication/session; single-process store |
| Outdated or invalid air data | UTC freshness checks, bounded pollutants, snapshot expiry, hard fallback with conspicuous demo warning | Provider model uncertainty and downtime remain |
| Prompt injection / model hallucinations | Strong system context, constrained JSON schema, server text validation, deterministic fallback, no tools | AI can still produce subtle misinformation; must validate real model and review outputs |
| API key disclosure | Key read on server only, transmitted to Google API over TLS, never served as JS or logged | Host-level environment configuration and deployment logs require operator care |
| Malicious HTML in model content | DOM text nodes and `textContent` only, CSP, no dynamic HTML injection | Browser dependency/security updates still required |
| Denial of service | Request size bounds, per-IP throttling, timeout, provider response cap, upstream dedup | In-memory limits do not scale across multiple instances or CDN |
| Misleading health/carbon claims | Safe language, model filters, editable emissions assumptions, clear disclaimers | No certified emissions factors or clinical validation in this prototype |

## Production priorities
- Deploy behind HTTPS with host-level rate limits, monitoring and key management.
- Consider a shared Redis-like store for forecast snapshots and distributed throttling.
- Add a privacy notice and purge policy appropriate to actual deployment.
- Independently test the upstream APIs, screen readers, all accessibility checks, and full threat model.
- Never call Open-Meteo US AQI India's official AQI or modeled data a station measurement.
