// Framework-neutral API handlers. Express (server/index.js) and the Vercel
// functions (api/*.js) both call `handleApi`, so the rules are the same.
//
//   GET  /api/health       is live mode on? + the short-lived page pass
//   POST /api/live-token   one-use Gemini Live ephemeral token for "Tell Ayu" (key stays here)
//        body {profile: {name, stage: 'pregnant'|'postnatal', weeks?, daysAfterBirth?, village?}, lang}
//        → {token, model, apiVersion, config, expiresInSec}. The profile is cleaned
//        (shared/live-config.js cleanProfile) before it reaches the prompt.
//
// Env: GEMINI_API_KEY, GEMINI_LIVE_MODEL, ALLOWED_ORIGINS,
//      LIVE_TOKEN_DAILY_CAP (200), LIVE_TOKEN_PER_MIN (6), PAGE_PASS_SECRET

import { GoogleGenAI } from '@google/genai';
import { buildTellConfig, cleanProfile, cleanCheck, DEFAULT_MODEL, API_VERSION, LANG_NAME } from '../../shared/live-config.js';
import { checkOrigin, rateLimit, takeDaily, envInt, issuePass, checkPass } from './guard.js';
import { handleDraft } from './draft.js';

// Every app language (shared/live-config.js LANG_NAME); anything else falls back to English.
const LANGS = Object.keys(LANG_NAME);

export function settings() {
  return {
    key: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_LIVE_MODEL || DEFAULT_MODEL,
    tokenCap: envInt('LIVE_TOKEN_DAILY_CAP', 200),
    tokenPerMin: envInt('LIVE_TOKEN_PER_MIN', 6),
    // POST /api/draft-questions (server/lib/draft.js): Ayu drafts a question set for an ASHA to review.
    draftModel: process.env.DRAFT_MODEL || process.env.SUMMARY_MODEL || 'gemini-flash-lite-latest',
    draftCap: envInt('DRAFT_DAILY_CAP', 100),
    draftPerMin: envInt('DRAFT_PER_MIN', 4),
  };
}

let genai = null;
let genaiKey = '';
function client(key) {
  if (!genai || genaiKey !== key) {
    genai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: API_VERSION } });
    genaiKey = key;
  }
  return genai;
}

const json = (status, body, headers = {}) => ({ status, headers, body });

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Talk-Pass',
    'Access-Control-Max-Age': '600',
  };
}

/**
 * @param {'health'|'live-token'} route
 * @param {{method: string, headers: object, body: any, ip: string}} req  headers lower-cased
 * @param {{mintToken?: Function}} [deps]  injectable for tests
 * @returns {Promise<{status: number, headers: object, body: any}>}
 */
export async function handleApi(route, req, deps = {}) {
  const s = settings();
  // POSTs need a browser Origin; the health check stays open.
  const origin = checkOrigin(req.headers, { requireOrigin: req.method === 'POST' });
  const cors = corsHeaders(origin.cors);
  const out = (status, body) => json(status, body, { ...cors, 'Cache-Control': 'no-store' });

  if (req.method === 'OPTIONS') return json(origin.ok ? 204 : 403, null, cors);

  if (route === 'health') {
    if (req.method !== 'GET') return out(405, { error: 'GET only' });
    const pass = s.key ? issuePass(s.key) : undefined;
    return out(200, { ok: true, live: Boolean(s.key), model: s.model, apiVersion: API_VERSION, pass });
  }

  if (req.method !== 'POST') return out(405, { error: 'POST only' });
  if (!origin.ok) return out(403, { error: 'Origin not allowed.' });

  if (route === 'live-token') {
    // `reason` tells the app which plain line to show; the quick taps work either way.
    if (!s.key) return out(503, { error: 'No GEMINI_API_KEY on the server.', reason: 'no-key' });
    if (!checkPass(s.key, req.headers['x-talk-pass'])) return out(403, { error: 'Please reload the page.', reason: 'pass', pass: false });
    if (!rateLimit('live-token', req.ip, { limit: s.tokenPerMin })) return out(429, { error: 'Too many requests, try again in a minute.', reason: 'busy' });
    if (!takeDaily('live-token', s.tokenCap)) return out(429, { error: 'Today’s live talks are used up.', reason: 'cap', cap: true });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const profile = cleanProfile(body.profile);
    const lang = LANGS.includes(body.lang) ? body.lang : 'en';
    // A daily check on the call sends its questions (in her language); they are cleaned before the prompt.
    const check = body.check ? cleanCheck(body.check) : null;
    if (body.check && !check) return out(400, { error: 'Bad question set.', reason: 'check' });
    const config = buildTellConfig({ profile, lang, check });
    try {
      const token = await (deps.mintToken || mintToken)({ key: s.key, model: s.model, config });
      return out(200, { token, model: s.model, apiVersion: API_VERSION, config, expiresInSec: 900 });
    } catch (err) {
      console.error('[live-token]', err?.message || err);
      return out(502, { error: 'Could not create a Live API token.', reason: 'token' });
    }
  }

  if (route === 'draft-questions') {
    return handleDraft(req, { key: s.key, model: s.draftModel, perMin: s.draftPerMin, cap: s.draftCap }, out, deps);
  }

  return out(404, { error: 'Not found' });
}

async function mintToken({ key, model, config }) {
  const now = Date.now();
  const token = await client(key).authTokens.create({
    config: {
      uses: 1,
      // A Tell Ayu session is at most 3 minutes; give it some slack.
      expireTime: new Date(now + 15 * 60 * 1000).toISOString(),
      // She must start the session within a minute.
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      // Lock model, prompt and tools, so the browser cannot change them.
      liveConnectConstraints: { model, config },
      httpOptions: { apiVersion: API_VERSION },
    },
  });
  return token.name;
}
