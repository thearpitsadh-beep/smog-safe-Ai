# SmogSafe AI Executive v3 — release notes

## Purpose
Strengthen the earlier Pro v2 app toward the user's **aspirational 97/100 external competition target**, without asserting that a private evaluator will award that score.

## Verified improvements
- **Fixed previously demonstrated location mix-up:** a Delhi live modeled forecast cannot be submitted with a Mumbai household label or coordinates.
- **Improved browser freshness:** expired snapshots, failed refreshes, and late replies from a former city no longer remain visible as trusted live measurements.
- **Modularized forecast services:** independent UTC AQI parser, geospatial validation, cache/dedup network client and AI trust layer.
- **Tightened server validation:** JSON content-type, bounded provider data, Gemini refusal/truncation detection, prompt safety filters.
- **Broader regression tests:** location, provider, UTC parsing, security, cross-city mismatch, Gemini refusal, browser state transitions, keyboard and small-device behavior.
- **Added explicit UTC hourly labeling** and preserved US AQI vs India AQI distinctions.

## What this release does NOT certify
- No official PromptWars AI-evaluator score was run or obtained.
- No live Gemini key was used; tests mocked Gemini's upstream response.
- No independent hosted deployment, live public-provider request or complete WCAG audit.
- Example emission factors are not verified Indian official factors.
