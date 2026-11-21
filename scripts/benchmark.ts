import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { createApp } from '../src/server/app.ts';

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function benchEndpoint(
  name: string,
  iterations: number,
  fn: () => Promise<Response>,
): Promise<void> {
  const timings: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const res = await fn();
    await res.arrayBuffer();
    const t1 = performance.now();
    if (res.status !== 200) {
      throw new Error(`${name} failed with status ${res.status}`);
    }
    timings.push(t1 - t0);
  }
  timings.sort((a, b) => a - b);
  const avg = timings.reduce((s, x) => s + x, 0) / timings.length;
  console.log(
    `${name}: n=${iterations} avg=${avg.toFixed(2)}ms p50=${percentile(timings, 50).toFixed(2)}ms p95=${percentile(timings, 95).toFixed(2)}ms`,
  );
}

async function main() {
  const app = createApp({ isDevVite: false });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Expected TCP address');
  const base = `http://127.0.0.1:${addr.port}`;

  try {
    await benchEndpoint('GET /api/health', 50, () => fetch(`${base}/api/health`));
    await benchEndpoint('POST /api/plan', 50, () =>
      fetch(`${base}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: { city: 'New Delhi', children: true, commute: 'metro' },
          air: { live: false },
        }),
      }),
    );
    await benchEndpoint('POST /api/impact', 50, () =>
      fetch(`${base}/api/impact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distanceKm: 12, daysPerWeek: 5, option: 'metro', country: 'India' }),
      }),
    );
    await benchEndpoint('POST /api/chat (rules-fallback)', 12, () =>
      fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'How can I reduce indoor smoke?',
          profile: { city: 'Pune' },
          air: { live: false },
        }),
      }),
    );
    await benchEndpoint('POST /api/brief (rules-fallback)', 12, () =>
      fetch(`${base}/api/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: { city: 'Pune', commute: 'metro' },
          air: { live: false },
        }),
      }),
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
