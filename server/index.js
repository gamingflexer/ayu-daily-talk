// Small Node server for Ayu's daily talk.
//  - POST /api/live-token  mints a one-use Gemini Live ephemeral token.
//    The real GEMINI_API_KEY never leaves this process.
//  - GET  /api/health      tells the client whether live mode is available.
//  - Serves the built PWA from dist/ in production.
//
// Without GEMINI_API_KEY everything still works: the client uses mock mode.

import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { phoneRouter } from './phone/bridge.js';
import { handleApi, settings } from './lib/api.js';
import { clientIp } from './lib/guard.js';

try {
  process.loadEnvFile();
} catch {
  // no .env — fine, mock mode
}

const PORT = Number(process.env.PORT || 8787);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

// Same handlers as the Vercel functions (server/lib/api.js): origin check,
// per-IP rate limit, daily token cap, token minting, doctor note.
for (const route of ['health', 'live-token', 'summary']) {
  app.all(`/api/${route}`, async (req, res) => {
    const out = await handleApi(route, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      ip: clientIp(req.headers, req.socket.remoteAddress),
    });
    res.status(out.status).set(out.headers);
    if (out.body == null) return res.end();
    res.json(out.body);
  });
}

// Phone-call fallback: interface only (see server/phone/README.md).
app.use('/api/phone', phoneRouter);

// Production: serve the built PWA.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  const s = settings();
  console.log(`[ayu] server on http://localhost:${PORT} · live mode: ${s.key ? `on (${s.model})` : 'off — mock mode'}`);
});
