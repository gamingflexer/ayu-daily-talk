// Small Node server for Ayu.
//  - POST /api/live-token  mints a one-use Gemini Live ephemeral token for "Tell Ayu".
//    The real GEMINI_API_KEY never leaves this process.
//  - GET  /api/health      tells the app whether live listening is available (+ page pass).
//  - POST /api/draft-questions  Ayu drafts a question set for an ASHA to review (server/lib/draft.js).
//  - Serves the built PWA from dist/ in production.
//
// Without GEMINI_API_KEY the app still works: Tell Ayu says it can't listen and
// offers the quick taps; the daily check and everything else run on the phone.

import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { handleApi, settings } from './lib/api.js';
import { clientIp } from './lib/guard.js';

try {
  process.loadEnvFile();
} catch {
  // no .env — fine, Tell Ayu runs without live listening
}

const PORT = Number(process.env.PORT || 8787);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

// Same handlers as the Vercel functions (server/lib/api.js): origin check,
// page pass, per-IP rate limit, daily token cap, token minting.
for (const route of ['health', 'live-token', 'draft-questions']) {
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

// Production: serve the built PWA.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  const s = settings();
  console.log(`[ayu] server on http://localhost:${PORT} · live listening: ${s.key ? `on (${s.model})` : 'off (no GEMINI_API_KEY)'}`);
});
