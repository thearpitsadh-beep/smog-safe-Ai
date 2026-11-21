import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const num = Number.parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const PALETTE_CHECKS: ReadonlyArray<{ name: string; fg: string; bg: string; minRatio: number }> = [
  { name: 'Primary ink on white card', fg: '#122b31', bg: '#ffffff', minRatio: 4.5 },
  { name: 'Muted copy on white card', fg: '#4a5e63', bg: '#ffffff', minRatio: 4.5 },
  { name: 'Muted copy on page bg', fg: '#4a5e63', bg: '#f6f8f7', minRatio: 4.5 },
  { name: 'Subtle label on white card', fg: '#53676b', bg: '#ffffff', minRatio: 4.5 },
  { name: 'Subtle label on page bg', fg: '#53676b', bg: '#f6f8f7', minRatio: 4.5 },
  { name: 'Emerald accent text on white', fg: '#1b6d52', bg: '#ffffff', minRatio: 4.5 },
  { name: 'Emerald accent text on page bg', fg: '#1b6d52', bg: '#f6f8f7', minRatio: 4.5 },
  { name: 'Emerald dark text on mint chip', fg: '#155740', bg: '#e4f5ec', minRatio: 4.5 },
  { name: 'Primary button white on teal', fg: '#ffffff', bg: '#145a4f', minRatio: 4.5 },
  { name: 'Demo banner text on amber bg', fg: '#70490b', bg: '#fff8e9', minRatio: 4.5 },
  { name: 'Demo pill text on amber pill', fg: '#664208', bg: '#ffe8b5', minRatio: 4.5 },
  { name: 'Live banner text on green bg', fg: '#155740', bg: '#edf9f2', minRatio: 4.5 },
  { name: 'Gemini verified pill text on mint bg', fg: '#124b37', bg: '#d3f2df', minRatio: 4.5 },
  { name: 'Custom factors summary on soft bg', fg: '#155740', bg: '#f6f9f7', minRatio: 4.5 },
  { name: 'Insight text on mint banner', fg: '#195b45', bg: '#e6f4ed', minRatio: 4.5 },
  { name: 'Sidebar nav item on deep bg', fg: '#c3dcd9', bg: '#0a292f', minRatio: 4.5 },
  { name: 'Sidebar caption on deep bg', fg: '#96b9bc', bg: '#0a292f', minRatio: 4.5 },
  { name: 'Sidebar bottom on deep bg', fg: '#9ec0c4', bg: '#0a292f', minRatio: 4.5 },
  { name: 'AQI tile subtitle on lightest gradient stop', fg: '#e6f9f0', bg: '#1d6b5c', minRatio: 4.5 },
  { name: 'Chart axis text on white', fg: '#445d61', bg: '#ffffff', minRatio: 4.5 },
  { name: '3D HUD badge text on deep overlay', fg: '#d6ebe8', bg: '#0a292f', minRatio: 4.5 },
  { name: '3D active dock pill on mint', fg: '#0a292f', bg: '#b7eac8', minRatio: 4.5 },
  { name: 'Grounding link chip text on white', fg: '#155740', bg: '#ffffff', minRatio: 4.5 },
];

for (const check of PALETTE_CHECKS) {
  test(`WCAG 2.2 AA contrast >= ${check.minRatio}:1 — ${check.name}`, () => {
    const ratio = contrastRatio(check.fg, check.bg);
    assert.ok(
      ratio >= check.minRatio,
      `${check.name} (${check.fg} on ${check.bg}) had contrast ${ratio.toFixed(2)}:1 < ${check.minRatio}:1`,
    );
  });
}

test('CSS enforces visible focus rings and reduced-motion media query', async () => {
  const css = await fs.readFile(path.resolve('src/styles.css'), 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  // Ensure old low-contrast hex tokens are no longer present
  assert.doesNotMatch(css, /#75898e/i);
  assert.doesNotMatch(css, /#91a0a1/i);
  assert.doesNotMatch(css, /#a3b2b2/i);
});

test('Components provide skip link, aria-live regions, form labels, and table alternative', async () => {
  const appTsx = await fs.readFile(path.resolve('src/App.tsx'), 'utf8');
  const overviewTsx = await fs.readFile(path.resolve('src/components/OverviewView.tsx'), 'utf8');
  const copilotTsx = await fs.readFile(path.resolve('src/components/CopilotView.tsx'), 'utf8');

  assert.match(appTsx, /className="skip-link"/);
  assert.match(appTsx, /aria-live="polite"/);
  assert.match(overviewTsx, /htmlFor="city-input"/);
  assert.match(overviewTsx, /htmlFor="schedule"/);
  assert.match(overviewTsx, /<th scope="col">/);
  assert.match(overviewTsx, /aria-expanded=\{showTable\}/);
  assert.match(copilotTsx, /role="log"/);
  assert.match(copilotTsx, /aria-live="polite"/);
});

test('Frontend source never references GEMINI_API_KEY or x-goog-api-key', async () => {
  const files = [
    'src/App.tsx',
    'src/components/OverviewView.tsx',
    'src/components/AirQualityMapCard.tsx',
    'src/components/DailyPlanView.tsx',
    'src/components/IndoorGuideView.tsx',
    'src/components/ImpactLabView.tsx',
    'src/components/CopilotView.tsx',
    'src/components/SmogScene3DView.tsx',
    'src/components/CloudSyncCard.tsx',
    'src/components/ErrorBoundary.tsx',
    'src/context/FirebaseContext.tsx',
  ];
  for (const rel of files) {
    const content = await fs.readFile(path.resolve(rel), 'utf8');
    assert.doesNotMatch(content, /GEMINI_API_KEY|x-goog-api-key|@google\/genai/i);
    assert.doesNotMatch(content, /dangerouslySetInnerHTML|innerHTML\s*=/);
  }
});

test('UI components display UTC hourly context, explicit trade-offs, and AI family brief card', async () => {
  const overviewTsx = await fs.readFile(path.resolve('src/components/OverviewView.tsx'), 'utf8');
  const dailyPlanTsx = await fs.readFile(path.resolve('src/components/DailyPlanView.tsx'), 'utf8');
  const impactTsx = await fs.readFile(path.resolve('src/components/ImpactLabView.tsx'), 'utf8');

  assert.match(overviewTsx, /UTC/);
  assert.match(dailyPlanTsx, /TRADE-OFF/);
  assert.match(dailyPlanTsx, /Generate AI family brief/);
  assert.match(impactTsx, /Optional custom emission factors/);
});
