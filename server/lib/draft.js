// POST /api/draft-questions — Ayu drafts a daily-check question set for an ASHA to review.
//
// The model only WRITES words and suggests levels. The draft is sanitised here and
// again on the phone (shared/question-sets.js sanitizeDraft), nothing reaches a woman
// until the ASHA checks every question and approves it, and the fixed rules
// (shared/triage.js optionLevel) still set the lowest level for any answer that
// carries a danger sign, whatever level the draft asked for.
//
// Env: DRAFT_MODEL (default SUMMARY_MODEL, then gemini-flash-lite-latest),
//      DRAFT_DAILY_CAP (100), DRAFT_PER_MIN (4)

import { GoogleGenAI } from '@google/genai';
import { LEVELS, SIGNS } from '../../shared/red-flags.js';
import { sanitizeDraft } from '../../shared/question-sets.js';
import { rateLimit, takeDaily, checkPass } from './guard.js';

/** The 9 app languages (src/i18n/dicts.js). */
export const DRAFT_LANGS = ['en', 'hi', 'mr', 'bn', 'ta', 'te', 'kn', 'gu', 'ml'];
const LANG_NAMES = { en: 'English', hi: 'Hindi', mr: 'Marathi', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', gu: 'Gujarati', ml: 'Malayalam' };
const TIMEOUT_MS = 12_000; // Vercel functions stop at 15 s (vercel.json)

/** Keep only what the prompt needs, with limits (the body comes from the browser). */
export function draftRequest(body) {
  const b = body && typeof body === 'object' ? body : {};
  const stage = b.stage === 'postnatal' ? 'postnatal' : 'pregnant';
  const about = typeof b.about === 'string' ? b.about.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
  const asked = Array.isArray(b.langs) ? b.langs.filter((l) => DRAFT_LANGS.includes(l)) : [];
  const langs = [...new Set(['en', ...asked])].slice(0, 5);
  return { stage, about, langs };
}

/** JSON schema for the model's answer: text in exactly the asked languages. */
export function draftSchema(langs) {
  const text = (max) => ({
    type: 'object',
    properties: Object.fromEntries(langs.map((l) => [l, { type: 'string', description: `${LANG_NAMES[l]}, at most ${max} words` }])),
    required: langs,
  });
  return {
    type: 'object',
    properties: {
      title: text(6),
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: text(12),
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: text(6),
                  level: { type: 'string', enum: LEVELS },
                  // A plain string: the full sign enum makes the schema too large for the API. sanitizeDraft drops unknown keys.
                  sign: { type: 'string' },
                },
                required: ['text', 'level'],
              },
            },
          },
          required: ['text', 'options'],
        },
      },
    },
    required: ['title', 'questions'],
  };
}

export function draftPrompt({ stage, about, langs }) {
  const who = stage === 'postnatal' ? 'women who have just given birth, and their newborn babies' : 'pregnant women';
  return `You help an ASHA (a village health worker in India) write a short daily check for ${who}.
She described the women like this: "${about || 'no extra detail'}".

Write a title and 5 to 8 questions the woman answers by tapping one option, every day, at home.
Rules:
- Plain spoken words a rural woman understands. One thing per question.
- Answers she can see or feel herself. No numbers, no measurements, no medical terms.
- Never diagnose. Never mention medicines or tablets.
- Each question at most 12 words. Each option at most 6 words. 2 to 4 options per question, the first one the "all well" answer.
- For each option give "level": none (fine), watch (the ASHA should visit), see_today (a doctor today), emergency (call 108 now).
- When unsure between two levels, pick the HIGHER one.
- If an option describes one of these danger signs, set "sign" to exactly that key; leave it out otherwise: ${Object.keys(SIGNS).join(', ')}.
- Write every text in each of these languages: ${langs.map((l) => `${l} (${LANG_NAMES[l]})`).join(', ')}. Non-English text in its own script, not in Latin letters. Same meaning in every language.`;
}

/** Options leave the server with `level` (the field sanitizeDraft reads), so a second sanitize on the phone keeps them. */
export function forTransport(draft) {
  return {
    title: draft.title,
    stage: draft.stage,
    questions: draft.questions.map((q) => ({
      text: q.text,
      options: q.options.map((o) => ({ text: o.text, level: o.floor, ...(o.sign ? { sign: o.sign } : {}) })),
    })),
  };
}

let genai = null;
let genaiKey = '';
function client(key) {
  if (!genai || genaiKey !== key) {
    genai = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: 'v1beta', timeout: TIMEOUT_MS } });
    genaiKey = key;
  }
  return genai;
}

/** The model call. Returns the parsed JSON draft (not yet sanitised). */
export async function writeDraft({ key, model, stage, about, langs }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await client(key).models.generateContent({
      model,
      contents: draftPrompt({ stage, about, langs }),
      config: {
        responseMimeType: 'application/json',
        responseJsonSchema: draftSchema(langs),
        temperature: 0.3,
        maxOutputTokens: 6000,
        abortSignal: ctrl.signal,
      },
    });
    return JSON.parse(res.text || 'null');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The route. Origin and method are checked by handleApi before this runs.
 * @param {{headers: object, body: any, ip: string}} req
 * @param {{key: string, model: string, perMin: number, cap: number}} s
 * @param {(status: number, body: object) => object} out
 * @param {{writeDraft?: Function}} deps
 */
export async function handleDraft(req, s, out, deps = {}) {
  if (!s.key) return out(503, { error: 'Ayu cannot write questions on this server (no GEMINI_API_KEY).' });
  if (!checkPass(s.key, req.headers['x-talk-pass'])) return out(403, { error: 'Please reload the page.', pass: false });
  if (!rateLimit('draft-questions', req.ip, { limit: s.perMin })) return out(429, { error: 'Too many requests, try again in a minute.' });
  if (!takeDaily('draft-questions', s.cap)) return out(429, { error: 'Today’s drafts are used up. Try again tomorrow.', cap: true });

  const ask = draftRequest(req.body);
  try {
    const raw = await (deps.writeDraft || writeDraft)({ key: s.key, model: s.model, ...ask });
    const draft = sanitizeDraft({ ...(raw && typeof raw === 'object' ? raw : {}), stage: ask.stage });
    if (!draft) return out(502, { error: 'Ayu could not write a usable set. Try again.' });
    return out(200, { draft: forTransport(draft), model: s.model });
  } catch (err) {
    console.error('[draft-questions]', err?.message || err);
    return out(502, { error: 'Ayu could not write the questions. Try again.' });
  }
}
