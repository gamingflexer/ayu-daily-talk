// Small Node server for Ayu's daily talk.
//  - POST /api/live-token  mints a one-use Gemini Live ephemeral token.
//    The real GEMINI_API_KEY never leaves this process.
//  - GET  /api/health      tells the client whether live mode is available.
//  - Serves the built PWA from dist/ in production.
//
// Without GEMINI_API_KEY everything still works: the client uses mock mode.

import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { buildLiveConfig, DEFAULT_MODEL, API_VERSION } from '../shared/live-config.js';
import { getPersona } from '../shared/personas.js';
import { phoneRouter } from './phone/bridge.js';

try {
  process.loadEnvFile();
} catch {
  // no .env — fine, mock mode
}

const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_LIVE_MODEL || DEFAULT_MODEL;
const ASYNC_TOOLS = process.env.LIVE_ASYNC_TOOLS !== 'false';
const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

// CORS only for the origins we list (e.g. the GitHub Pages site).
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Tiny in-memory rate limit: 10 tokens per minute per IP.
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 10) return res.status(429).json({ error: 'Too many requests, try again in a minute.' });
  recent.push(now);
  hits.set(ip, recent);
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, live: Boolean(KEY), model: MODEL, apiVersion: API_VERSION, phone: 'stub' });
});

let genai = null;
function client() {
  if (!genai) genai = new GoogleGenAI({ apiKey: KEY, httpOptions: { apiVersion: API_VERSION } });
  return genai;
}

app.post('/api/live-token', rateLimit, async (req, res) => {
  if (!KEY) return res.status(503).json({ error: 'No GEMINI_API_KEY on the server — use mock mode.', mock: true });

  const persona = getPersona(String(req.body?.persona || 'sunita'));
  const lang = ['en', 'hi', 'mr'].includes(req.body?.lang) ? req.body.lang : 'en';
  const config = buildLiveConfig({ persona, lang, asyncTools: ASYNC_TOOLS });

  try {
    const now = Date.now();
    const token = await client().authTokens.create({
      config: {
        uses: 1,
        // The talk is 5 minutes; give the session some slack.
        expireTime: new Date(now + 15 * 60 * 1000).toISOString(),
        // She must start the session within a minute.
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        // Lock model, prompt and tools, so the browser cannot change them.
        liveConnectConstraints: { model: MODEL, config },
        httpOptions: { apiVersion: API_VERSION },
      },
    });
    res.json({ token: token.name, model: MODEL, apiVersion: API_VERSION, config, expiresInSec: 900 });
  } catch (err) {
    console.error('[live-token]', err?.message || err);
    res.status(502).json({ error: 'Could not create a Live API token.' });
  }
});

// Phone-call fallback: interface only (see server/phone/README.md).
app.use('/api/phone', phoneRouter);

// Production: serve the built PWA.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[ayu] server on http://localhost:${PORT} · live mode: ${KEY ? `on (${MODEL})` : 'off — mock mode'}`);
});
