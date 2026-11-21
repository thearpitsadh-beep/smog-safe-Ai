/** Trust boundaries for server-owned forecasts and AI text. No browser API keys. */
import { randomBytes } from 'node:crypto';

const SNAPSHOT_TTL_MS = 18 * 60_000;
const SNAPSHOT_CAP = 500;

/** Opaque, in-memory server snapshots. A client cannot mark arbitrary readings as live. */
export function createSnapshotStore({now = () => Date.now()} = {}) {
  const records = new Map();
  function prune() {
    const clock = now();
    for (const [id, entry] of records) if (entry.expiresAt <= clock) records.delete(id);
    while (records.size > SNAPSHOT_CAP) records.delete(records.keys().next().value);
  }
  return {
    issue(air, coordinates) {
      if (!air?.live || !Number.isFinite(air.current?.usAqi) || !Number.isFinite(coordinates?.latitude) || !Number.isFinite(coordinates?.longitude)) throw new Error('Cannot issue snapshot for unverified input');
      prune();
      const id = randomBytes(24).toString('base64url');
      // Keep a deep copy so subsequent application mutations do not change recorded provenance.
      records.set(id, {air: structuredClone(air), coordinates: {...coordinates}, expiresAt: now() + SNAPSHOT_TTL_MS});
      return id;
    },
    resolve(id) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(id)) return null;
      prune();
      const entry = records.get(id);
      return entry && entry.expiresAt > now() ? structuredClone(entry) : null;
    },
    size() { prune(); return records.size; },
  };
}

const FORBIDDEN_AI_CLAIMS = [
  /\b(?:guaranteed|completely safe|100% safe|risk[- ]free)\b/i,
  /\b(?:cures?|treats?|prevents?)\s+(?:asthma|COPD|lung disease|cancer|respiratory illness)\b/i,
  /\b(?:my|your)\s+(?:api\s*key|private\s*key|secret\s*token|system\s*prompt)\s*(?:is|:)\b/i,
  /\b(?:air pollution|pm2\.5|exposure)\s*(?:will|is guaranteed to)\s*(?:fall|reduce|drop)\s*(?:by)\s*\d+/i,
  /\b(?:use|buy|recommend|install)\s+(?:an?\s+)?ozone[- ]?(?:generat(?:or|ing)|purifier)/i,
  /\b(?:house\s*plants?|indoor\s*plants?)\s+(?:alone\s+)?(?:can|will|definitely)\s+(?:remove|eliminate|clean)\s+(?:all\s+)?(?:smog|pm2\.5|air\s*pollution)/i,
  /\b(?:take|increase|start|prescribe)\s+(?:(?:a|an|the|your|more|extra)\s+)?(?:medicine|medication|antibiotics?|steroids?|inhalers?)\b/i,
  /\b(?:official|government|ground[- ]monitor|certified)\s+(?:live\s+)?(?:aqi|reading|measurement|air[- ]quality\s+data)\b/i,
];
const UNSUPPORTED_NUMERICAL_IMPACT = /\b\d+(?:\.\d+)?\s*(?:%|percent\b|kg\s*(?:co2e?|carbon)?|grams?\s*(?:co2e?|carbon)?|µg\s*\/\s*m[³3])/i;

/** Reject unverifiable quantitative claims and unsafe medical certainty from model output. */
export function validateGeminiAnswer(payload, {live = false, usAqi = null} = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'answer') return null;
  const answer = payload.answer;
  if (typeof answer !== 'string') return null;
  const clean = answer.trim();
  if (clean.length < 12 || clean.length > 800 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(clean)) return null;
  if (FORBIDDEN_AI_CLAIMS.some(re => re.test(clean))) return null;
  if (UNSUPPORTED_NUMERICAL_IMPACT.test(clean)) return null;
  // In modeled-live mode, reject invented numeric 'current AQI' values. Historical
  // AQI thresholds in educational explanations do not count as current values.
  const currentAqi=clean.match(/\b(?:current|right\s+now|today(?:'s)?)\s+(?:modeled\s+)?(?:US\s+)?AQI\s*(?:is|of|:|around)?\s*(\d{1,4})\b/i);
  if (currentAqi && (!live || !Number.isFinite(usAqi) || Number(currentAqi[1])!==Math.round(usAqi))) return null;
  // In demo mode the model must not claim a current measured value from an invented scenario.
  if (!live && /\b(?:live (?:aqi|reading|data)|verified (?:aqi|reading|measurement)|official (?:aqi|reading)|(?:current|today's|real[- ]time)\s+(?:aqi|pollution\s+reading))\b/i.test(clean)) return null;
  return clean;
}

export function isRestrictedQuestion(question) {
  return /\b(?:api\s*key|password|secret\s*token|system\s*prompt|developer\s*message|ignore\s+(?:all\s+)?(?:previous|system)\s+instructions|jailbreak|credentials)\b/i.test(question);
}

/** High-stakes symptoms/diagnosis requests bypass generative text altogether. */
export function isHighRiskHealthQuestion(question){
  return /\b(?:chest pain|struggling to breathe|cannot breathe|can't breathe|unconscious|emergency|prescrib(?:e|ing)|antibiotic|dosage|medicine|medication|treat my asthma|asthma|COPD|wheez(?:e|ing)|pregnan(?:t|cy)|infant|baby|diagnos(?:e|is)|inhaler dose)\b/i.test(question);
}
