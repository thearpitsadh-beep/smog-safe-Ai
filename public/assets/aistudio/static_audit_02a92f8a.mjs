/** Fast dependency-free checks for critical repository invariants (NOT a full linter). */
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>readFile(path.resolve(root,rel),'utf8');
const [ui,server,logic,trust,location,markup,gitignore]=await Promise.all([
 read('public/app.js'),read('server.mjs'),read('src/logic.mjs'),read('src/trust.mjs'),
 read('src/location.mjs'),read('public/index.html'),read('.gitignore'),
]);
const checks=[
 ['Server owns Gemini key', !ui.includes('GEMINI_API_KEY') && server.includes('process.env.GEMINI_API_KEY')],
 ['No untrusted HTML sink in frontend', !/\.innerHTML\s*=|insertAdjacentHTML\(|document\.write\(/.test(ui)],
 ['Client uses textContent for model responses',ui.includes("querySelector('p').textContent=answer")],
 ['Client supplies coordinates with profiles',ui.includes('latitude:city.latitude,longitude:city.longitude')],
 ['Server enforces geographic provenance',server.includes('assertLocationMatchesForecast(profile,record)')],
 ['Server prevents forged live data',server.includes('body.air?.live===true')],
 ['Client expires trusted snapshots',ui.includes('enforceForecastFreshness') && ui.includes('snapshotExpiresAt')],
 ['Client discards stale city fetches',ui.includes('requestVersion!==forecastRequestVersion')],
 ['Model output is schema checked',trust.includes('validateGeminiAnswer') && trust.includes('FORBIDDEN_AI_CLAIMS')],
 ['Network data remains a modeled US AQI',server.includes("'us_aqi,pm2_5") && markup.includes('US AIR QUALITY INDEX')],
 ['Built-in explanatory text distinguishes emissions and exposure',logic.includes('personal exposure') || logic.includes('NOT personal inhaled')],
 ['No raw .env committed',gitignore.includes('.env') && !(await readdir(root)).includes('.env')],
 ['API sends CSP and clickjacking headers',server.includes('Content-Security-Policy') && server.includes('X-Frame-Options')],
 ['Keyboard skip navigation is present',markup.includes('class="skip-link"') && markup.includes('id="main"')],
];
for(const [label,okay] of checks){assert.ok(okay,label);console.log(`PASS ${label}`);}
console.log(`Static invariants: ${checks.length}/${checks.length} passed (not a complete security or style audit).`);
