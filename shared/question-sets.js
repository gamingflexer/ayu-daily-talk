// Daily-check question sets.
//
// A set is a short list of questions with tap answers. Each answer can carry
//   sign   a danger sign from shared/red-flags.js (the fixed rules read it), and/or
//   floor  the lowest level this answer may end at ('watch' | 'see_today' | 'emergency').
// The fixed rules still decide: a floor can only RAISE what the rules say (shared/triage.js).
//
// Built-in sets take their words from src/i18n (key `sets.<setId>.<questionId>…`).
// Sets an ASHA makes with Ayu carry their own words: `text: { en, hi, … }`.
//
// The built-in pregnancy set follows Vrindar's "Daily check" board (5 questions).
// The postnatal set is [Inferred] from the same pattern and the postnatal / newborn
// signs in red-flags.js. Neither has been clinically reviewed.

import { LEVELS, SIGNS } from './red-flags.js';

/** The four levels in the order the UI shows them: Fine · ASHA · Doctor · 108. */
export const FLOORS = LEVELS;

export const UNSURE = 'unsure';

export const BUILTIN_SETS = {
  pregnancy: {
    id: 'pregnancy',
    builtin: true,
    stage: 'pregnant',
    version: 1,
    questions: [
      {
        id: 'swell',
        options: [
          { id: 'none', pic: 'feet_normal' },
          { id: 'feet', sign: 'swelling_feet', pic: 'feet_puffy' },
          { id: 'dent', sign: 'swelling_feet', floor: 'watch', pic: 'feet_dent' },
          { id: 'face', sign: 'swelling_face_hands', floor: 'see_today', pic: 'face_puffy' },
        ],
      },
      {
        id: 'head',
        options: [
          { id: 'none' },
          { id: 'mild' },
          { id: 'stays', sign: 'severe_headache', floor: 'see_today' },
          { id: 'vision', sign: 'blurred_vision', floor: 'see_today' },
        ],
      },
      {
        id: 'baby',
        options: [
          { id: 'usual' },
          { id: 'less', sign: 'reduced_fetal_movement', floor: 'see_today' },
          { id: 'still', sign: 'reduced_fetal_movement', floor: 'emergency' },
        ],
      },
      {
        id: 'bleed',
        options: [
          { id: 'none' },
          { id: 'spot', sign: 'bleeding', floor: 'see_today' },
          { id: 'heavy', sign: 'bleeding', floor: 'emergency' },
          { id: 'water', sign: 'fluid_leak', floor: 'emergency' },
        ],
      },
      {
        id: 'body',
        options: [
          { id: 'fine' },
          { id: 'tired' },
          { id: 'fever', sign: 'fever', floor: 'see_today' },
          { id: 'fits', sign: 'convulsions', floor: 'emergency' },
        ],
      },
    ],
    // Answers that together mean "call 108" (possible pre-eclampsia).
    combos: [{ any: ['swell:face', 'swell:dent'], with: ['head:stays', 'head:vision'], level: 'emergency' }],
  },

  postnatal: {
    id: 'postnatal',
    builtin: true,
    stage: 'postnatal',
    version: 1,
    questions: [
      {
        id: 'pbleed',
        options: [
          { id: 'less' },
          { id: 'period', floor: 'watch' },
          { id: 'clots', sign: 'heavy_bleeding', floor: 'emergency' },
          { id: 'soaked', sign: 'heavy_bleeding', floor: 'emergency' },
        ],
      },
      {
        id: 'pfever',
        options: [
          { id: 'none' },
          { id: 'fever', sign: 'fever', floor: 'see_today' },
          { id: 'smell', sign: 'foul_discharge', floor: 'see_today' },
        ],
      },
      {
        id: 'feed',
        options: [
          { id: 'well' },
          { id: 'poor', sign: 'baby_poor_feeding', floor: 'see_today' },
          { id: 'hot', sign: 'baby_cold_or_hot', floor: 'see_today' },
          { id: 'fast', sign: 'baby_fast_breathing', floor: 'see_today' },
        ],
      },
      {
        id: 'skin',
        options: [
          { id: 'normal', pic: 'baby_normal' },
          { id: 'light', sign: 'baby_yellow_skin', floor: 'see_today', pic: 'baby_light' },
          { id: 'deep', sign: 'baby_yellow_skin', floor: 'see_today', pic: 'baby_deep' },
        ],
      },
      {
        id: 'mood',
        options: [{ id: 'fine' }, { id: 'tired' }, { id: 'low', sign: 'very_low_mood', floor: 'watch' }],
      },
    ],
    // Bleeding like a heavy period together with fever or a bad smell: a doctor today.
    combos: [{ any: ['pbleed:period'], with: ['pfever:fever', 'pfever:smell'], level: 'see_today' }],
  },
};

/** The built-in set for a stage. */
export function builtinFor(stage) {
  return stage === 'postnatal' ? BUILTIN_SETS.postnatal : BUILTIN_SETS.pregnancy;
}

/**
 * The set a woman answers today: the newest approved set an ASHA sent her, else the built-in one.
 * @param {{id: string, stage: string}} woman
 * @param {Record<string, object>} [sets] sets made on this phone
 */
export function setFor(woman, sets = {}) {
  const mine = Object.values(sets)
    .filter((s) => s.status === 'approved' && (s.assignedTo || []).includes(woman.id) && s.questions?.length)
    .sort((a, b) => (b.approvedAt || 0) - (a.approvedAt || 0));
  return mine[0] || builtinFor(woman.stage);
}

const clean = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');

function cleanText(text, n) {
  if (typeof text === 'string') return clean(text, n) ? { en: clean(text, n) } : null;
  if (!text || typeof text !== 'object') return null;
  const out = {};
  for (const [lang, v] of Object.entries(text).slice(0, 9)) {
    if (/^[a-z]{2}$/.test(lang) && clean(v, n)) out[lang] = clean(v, n);
  }
  return out.en ? out : null;
}

/**
 * Make a model-written draft safe to store and show: sizes capped, levels and signs
 * limited to the known lists, nothing checked, nothing approved.
 * Returns null when there is nothing usable.
 */
export function sanitizeDraft(raw, { id, now = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const title = cleanText(raw.title, 60);
  const questions = (Array.isArray(raw.questions) ? raw.questions : [])
    .slice(0, 10)
    .map((q, qi) => {
      const text = cleanText(q?.text, 140);
      const options = (Array.isArray(q?.options) ? q.options : [])
        .slice(0, 5)
        .map((o, oi) => {
          const label = cleanText(o?.text ?? o?.label, 60);
          if (!label) return null;
          const opt = { id: `o${oi + 1}`, text: label, floor: FLOORS.includes(o?.level) ? o.level : 'none' };
          if (o?.sign in SIGNS) opt.sign = o.sign;
          return opt;
        })
        .filter(Boolean);
      if (!text || options.length < 2) return null;
      return { id: `q${qi + 1}`, text, options, checked: false };
    })
    .filter(Boolean);
  if (!title || questions.length < 2) return null;
  return {
    id: id || `set_${now.toString(36)}`,
    builtin: false,
    stage: raw.stage === 'postnatal' ? 'postnatal' : 'pregnant',
    title,
    version: 1,
    status: 'draft',
    createdAt: now,
    questions,
    combos: [],
    assignedTo: [],
  };
}
