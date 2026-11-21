# Optional Google AI Studio prompt

You already have runnable source code; you do NOT need this prompt to run the app. Use it only if you want to rebuild, port or extend SmogSafe AI in Google AI Studio.

```
You are a careful senior full-stack engineer and product designer.

Create or improve SmogSafe AI: a mobile-friendly Urban Air Quality Assistant for families and communities. It must offer (1) location-specific, clearly source-labeled air-quality forecasts, (2) personalized morning/afternoon/evening routines, (3) affordable indoor air-quality suggestions, (4) low-emission alternatives, (5) transparent impact comparisons, and (6) a genuinely useful GenAI assistant.

Use Google AI Studio/Gemini only for grounded natural-language explanations. Use deterministic code for AQI classification, safety rules and emissions arithmetic. Never invent live AQI data. Label US AQI distinctly from Indian AQI. Keep the Gemini API key on a server, not in the client.

Prefer simple, maintainable code; semantic accessible HTML; keyboard support; screen-reader labels; reduced-motion support; prompt-injection resilience; input validation; server-side API rate limiting; caching; clear no-data states; source/time citations; error handling; 3 distinct household personas; and automated unit, HTTP integration and browser tests.

Do not make unsupported medical statements or claim that emissions avoided equals reduced personal exposure. Avoid ozone-producing purifiers and unsupported indoor-plant purification claims.

Deliver a deployable app, setup instructions, source code, API key template without secrets, validation checklist, test report, and an honest disclosure of what remains unverified. Run checks and fix failures before claiming completion.
```
