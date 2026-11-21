# Security and data trust — Executive v4

## Threat model and boundaries

- **Client:** untrusted. Browser-submitted `air.live` cannot establish provider provenance. Known-city coordinates, household coordinates and server-issued expiring snapshots must agree.
- **Server:** owns the Gemini credential. Only allowlisted static files and known, fixed upstream provider hosts can be requested. Generated model output is rendered via `textContent`, not HTML.
- **External forecast:** Open-Meteo/CAMS modeled **US AQI**. It is not official Indian AQI or an observed station reading. Provider JSON is streamed and limited to 1 MB before parsing; responses can be stale, malformed or unavailable.
- **Gemini:** server-only REST call with bounded JSON input and a 48 KB streamed response cap; trusted context explicitly labels modeled vs demo data. Structured answer shape is validated; high-risk medical, quantitative health benefit, made-up current AQI and secret-revelation content is conservatively rejected. If a model fails, safe deterministic guidance is returned.
- **Data handling:** no browser secret storage; the in-memory snapshot store is single-process and short-lived. No user accounts, medical records or server-side family history database is implemented.

## Known limitations

Filters and mocked evaluations **do not guarantee immunity to prompt injection, hallucination, unsafe advice or data poisoning**. Test a real Gemini key with an independent adversarial prompt suite and domain-expert review. Use HTTPS, external rate limiting, centralized secrets and telemetry redaction in production.

## Source and calculation transparency

Air quality: https://open-meteo.com/en/docs/air-quality-api
Historical emissions assumptions: https://www.wri.org/sustainability-wri/dashboard/methodology (Table 27, 2018–2021). Estimates measure possible commuting CO₂e differences, not personal pollutant exposure or health impacts.
