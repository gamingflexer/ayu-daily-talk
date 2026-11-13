// Framework-neutral API handlers. Express (server/index.js) and the Vercel
// functions (api/*.js) both call `handleApi`, so the rules are the same.
//
//   GET  /api/health       is live mode on?
//   POST /api/live-token   one-use Gemini Live ephemeral token (key stays here)
//   POST /api/summary      optional short model-written doctor note
//
// Env: GEMINI_API_KEY, GEMINI_LIVE_MODEL, LIVE_ASYNC_TOOLS, ALLOWED_ORIGINS,
//      LIVE_TOKEN_DAILY_CAP (200), LIVE_TOKEN_PER_MIN (6), SUMMARY_MODEL,
//      SUMMARY_DAILY_CAP (300), SUMMARY_PER_MIN (10)

import { GoogleGenAI } from '@google/genai';
import { buildLiveConfig, DEFAULT_MODEL, API_VERSION } from '../../shared/live-config.js';
import { getPersona } from '../../shared/personas.js';
import { buildDoctorSummary } from '../../shared/doctor-summary.js';
import { checkOrigin, rateLimit, takeDaily, envInt } from './guard.js';

const LANGS = ['en', 'hi', 'mr'];

export function settings() {
  return {
    key: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_LIVE_MODEL || DEFAULT_MODEL,
    asyncTools: process.env.LIVE_ASYNC_TOOLS !== 'false',
    summaryModel: process.env.SUMMARY_MODEL || 'gemini-flash-lite-latest',
    tokenCap: envInt('LIVE_TOKEN_DAILY_CAP', 200),
    tokenPerMin: envInt('LIVE_TOKEN_PER_MIN', 6),
    summaryCap: envInt('SUMMARY_DAILY_CAP', 300),
    summaryPerMin: envInt('SUMMARY_PER_MIN', 10),
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
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  };
}

/**
 * @param {'health'|'live-token'|'summary'} route
 * @param {{method: string, headers: object, body: any, ip: string}} req  headers lower-cased
 * @param {{mintToken?: Function, writeNote?: Function}} [deps]  injectable for tests
 * @returns {Promise<{status: number, headers: object, body: any}>}
 */
export async function handleApi(route, req, deps = {}) {
  const s = settings();
  const origin = checkOrigin(req.headers);
  const cors = corsHeaders(origin.cors);
  const out = (status, body) => json(status, body, { ...cors, 'Cache-Control': 'no-store' });

  if (req.method === 'OPTIONS') return json(origin.ok ? 204 : 403, null, cors);

  if (route === 'health') {
    if (req.method !== 'GET') return out(405, { error: 'GET only' });
    return out(200, { ok: true, live: Boolean(s.key), model: s.model, apiVersion: API_VERSION, phone: 'stub', summary: Boolean(s.key) });
  }

  if (req.method !== 'POST') return out(405, { error: 'POST only' });
  if (!origin.ok) return out(403, { error: 'Origin not allowed.' });

  if (route === 'live-token') {
    if (!s.key) return out(503, { error: 'No GEMINI_API_KEY on the server — use mock mode.', mock: true });
    if (!rateLimit('live-token', req.ip, { limit: s.tokenPerMin })) return out(429, { error: 'Too many requests, try again in a minute.', mock: true });
    if (!takeDaily('live-token', s.tokenCap)) return out(429, { error: 'Today’s live talks are used up. Continuing in mock mode.', mock: true, cap: true });

    const body = req.body || {};
    const persona = getPersona(String(body.persona || 'sunita'));
    const lang = LANGS.includes(body.lang) ? body.lang : 'en';
    const config = buildLiveConfig({ persona, lang, asyncTools: s.asyncTools });
    try {
      const token = await (deps.mintToken || mintToken)({ key: s.key, model: s.model, config });
      return out(200, { token, model: s.model, apiVersion: API_VERSION, config, expiresInSec: 900 });
    } catch (err) {
      console.error('[live-token]', err?.message || err);
      return out(502, { error: 'Could not create a Live API token.', mock: true });
    }
  }

  if (route === 'summary') {
    const body = req.body || {};
    const persona = getPersona(String(body.persona || 'sunita'));
    // The deterministic summary is rebuilt here from the talk, so the model only rewrites known facts.
    const det = buildDoctorSummary({ persona, talk: sanitizeTalk(body.talk) });
    if (!s.key) return out(200, { note: null, source: 'deterministic', summary: det.text });
    if (!rateLimit('summary', req.ip, { limit: s.summaryPerMin })) return out(429, { error: 'Too many requests.', summary: det.text });
    if (!takeDaily('summary', s.summaryCap)) return out(200, { note: null, source: 'deterministic', summary: det.text, cap: true });
    try {
      const note = await (deps.writeNote || writeNote)({ key: s.key, model: s.summaryModel, text: det.text });
      return out(200, { note, source: 'model', model: s.summaryModel, summary: det.text });
    } catch (err) {
      console.error('[summary]', err?.message || err);
      return out(200, { note: null, source: 'deterministic', summary: det.text });
    }
  }

  return out(404, { error: 'Not found' });
}

/** Keep only the fields the summary reads, with size limits (the talk comes from the browser). */
export function sanitizeTalk(t) {
  if (!t || typeof t !== 'object') return null;
  const s = (v, n = 160) => (typeof v === 'string' ? v.slice(0, n) : undefined);
  const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
  const level = ['none', 'watch', 'see_today', 'emergency'].includes(t.referral?.level) ? t.referral.level : 'none';
  return {
    at: Number(t.at) || Date.now(),
    signs: arr(t.signs, 20).map((x) => s(x, 40)).filter(Boolean),
    symptoms: arr(t.symptoms, 10).map((x) => ({ sign: s(x?.sign, 40), her_words: s(x?.her_words) || '', since: s(x?.since, 40), severity: s(x?.severity, 20) })),
    answers: arr(t.answers, 12).map((x) => ({
      kind: s(x?.kind, 10),
      question: s(x?.question) || '',
      answer: Array.isArray(x?.answer) ? x.answer.slice(0, 8).map((y) => s(y, 80)) : s(x?.answer, 80),
      picture: s(x?.picture, 20),
      pictureSet: s(x?.pictureSet, 30),
      via: s(x?.via, 10),
    })),
    photos: arr(t.photos, 6).map((x) => ({ purpose: s(x?.purpose, 20) || 'document', kind: s(x?.kind, 10) })),
    plan: t.plan && typeof t.plan === 'object' ? Object.fromEntries(Object.entries(t.plan).slice(0, 6).map(([k, v]) => [s(k, 20), { value: s(v?.value, 120) || '', ready: Boolean(v?.ready) }])) : {},
    referral: { level, rule: s(t.referral?.rule, 80), reasons: arr(t.referral?.reasons, 6).map((x) => s(x, 160)).filter(Boolean) },
    questionsForDoctor: arr(t.questionsForDoctor, 5).map((x) => s(x)).filter(Boolean),
  };
}

async function mintToken({ key, model, config }) {
  const now = Date.now();
  const token = await client(key).authTokens.create({
    config: {
      uses: 1,
      // The talk is 5 minutes; give the session some slack.
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

const NOTE_PROMPT = `You write a handover note for a busy doctor in India.
Rewrite the summary below as at most 3 short sentences (under 70 words), in English.
Use only facts in the summary. Lead with the referral level and the danger signs. Quote her own words if they matter.
Do not diagnose, do not suggest or change medicines, do not add advice.

Summary:
`;

async function writeNote({ key, model, text }) {
  const res = await client(key).models.generateContent({
    model,
    contents: NOTE_PROMPT + text,
    config: { maxOutputTokens: 160, temperature: 0.2 },
  });
  return (res.text || '').trim().slice(0, 600) || null;
}
