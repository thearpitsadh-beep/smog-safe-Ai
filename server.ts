import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { createApp } from './src/server/app.ts';

dotenv.config({ quiet: true });

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer(): Promise<void> {
  const app = createApp({ isDevVite: !isProduction });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(ROOT, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir, { maxAge: '5m' }));
      app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    } else {
      app.use((_req, res) => {
        res.status(404).json({ error: 'Not found' });
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmogSafe AI running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SmogSafe AI server:', err);
  process.exit(1);
});
