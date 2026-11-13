// State of one daily talk and the local handlers for every tool the model
// can call. Used by the Gemini engine (real tool calls) and the mock engine
// (scripted tool calls), so both behave the same.

import { evaluate, escalate, levelIndex, LEVELS, SIGNS } from './red-flags.js';

let nextCardId = 1;

/** Birth/travel plan items Ayu can fill in during a talk (S12). Order = order on screen. */
export const PLAN_ITEMS = ['hospital', 'transport', 'companion', 'money', 'documents_bag', 'blood_donor'];

/**
 * Pick-the-picture tiles that are themselves a danger sign, so a tap reaches
 * the fixed rules even if the model never calls record_symptom.
 */
export const PICTURE_SIGNS = {
  feet_swelling: { puffy: 'swelling_feet', pitting: 'swelling_feet' },
  baby_skin_colour: { light: 'baby_yellow_skin', deep: 'baby_yellow_skin' },
  stool_colour: { pale: 'baby_pale_stool' },
  medicine_strip: {},
  stomach_upset: { vomiting: 'vomiting_no_food' },
};

/** Picture sets where the back camera helps her compare (it turns on by itself for these). */
export const CAMERA_SETS = new Set(['feet_swelling', 'baby_skin_colour', 'stool_colour', 'medicine_strip']);

/** Tile in a set that means "no, looks normal" when the set is shown on a yes/no card. */
export const PICTURE_NORMAL = { feet_swelling: 'normal', baby_skin_colour: 'normal', stool_colour: 'yellow' };

/** Answer types beyond yes/no/choices/photo (Ada-style quick answers, all tool calls). */
export const DURATIONS = ['lt_day', 'day_week', 'week_month', 'gt_month'];
export const SEVERITIES = ['mild', 'moderate', 'severe'];
export const BODY_AREAS = [
  'head',
  'neck',
  'chest',
  'upper_belly_left',
  'upper_belly_right',
  'lower_belly_left',
  'lower_belly_right',
  'back',
  'legs_feet',
];
/** The local symptom list for the search card. Keys map to i18n `symptoms.*`; some are danger signs on their own. */
export const SYMPTOM_KEYS = [
  'headache', 'dizziness', 'blurred_vision', 'swelling_face', 'swollen_feet', 'belly_pain', 'back_pain', 'bleeding',
  'water_leak', 'fever', 'vomiting', 'nausea', 'burning_urine', 'cough', 'breathless', 'tired', 'baby_moving_less',
  'itching', 'low_mood', 'no_sleep', 'constipation', 'heartburn', 'fits',
];
export const SYMPTOM_SIGNS = {
  blurred_vision: 'blurred_vision',
  swelling_face: 'swelling_face_hands',
  swollen_feet: 'swelling_feet',
  bleeding: 'bleeding',
  water_leak: 'fluid_leak',
  fever: 'fever',
  breathless: 'breathlessness',
  baby_moving_less: 'reduced_fetal_movement',
  low_mood: 'very_low_mood',
  fits: 'convulsions',
};
/** A "Severe" answer about these signs is the sign itself. */
const SEVERE_MEANS = new Set(['severe_headache', 'severe_abdominal_pain']);
const LOWER_BELLY = new Set(['lower_belly_left', 'lower_belly_right']);

/** Which camera purpose fits a card (for "Not sure" → camera). Never her face or private parts. */
export function cameraPurposeFor(card) {
  if (!card) return 'medicine_strip';
  if (card.purpose) return card.purpose;
  if (card.pictureSet === 'baby_skin_colour' || card.pictureSet === 'stool_colour') return 'skin_patch';
  if (card.pictureSet === 'feet_swelling' || card.sign === 'swelling_feet') return 'feet';
  if (card.sign === 'baby_yellow_skin') return 'skin_patch';
  return 'medicine_strip';
}

export function createTalkState(persona) {
  return {
    persona,
    startedAt: Date.now(),
    signs: new Set(),
    // Signs from record_symptom, red_flag_check and earlier talks; answer signs are added on top (see deriveSigns).
    baseSigns: new Set(),
    symptoms: [],
    answers: [],
    photos: [],
    plan: {},
    modelLevel: 'none',
    modelReasons: [],
    rule: { level: 'none', reasons: [], rule: null },
    finished: null,
  };
}

/** Current referral: the rule result, raised (never lowered) by the model. */
export function referral(state) {
  const level = escalate(state.rule.level, state.modelLevel);
  return {
    level,
    ruleLevel: state.rule.level,
    rule: state.rule.rule,
    reasons: [...state.rule.reasons, ...state.modelReasons],
    raisedByModel: levelIndex(state.modelLevel) > levelIndex(state.rule.level),
  };
}

/**
 * Signs = base signs + signs from her current (not changed) answers. She may change a tapped answer
 * ("Previous"); then the signs that answer gave are re-derived. The model can never remove a sign.
 */
function deriveSigns(state) {
  const signs = new Set(state.baseSigns);
  const live = state.answers.filter((a) => !a.changed);
  for (const a of live) for (const x of a.signs || []) signs.add(x);
  // Strong pain in the lower belly in pregnancy (body map + severity on the same pain).
  const pregnant = state.persona.stage === 'pregnant';
  const body = [...live].reverse().find((a) => a.kind === 'body');
  const sev = [...live].reverse().find((a) => a.kind === 'severity');
  if (pregnant && body && LOWER_BELLY.has(body.answer) && sev?.answer === 'severe') signs.add('severe_abdominal_pain');
  state.signs = signs;
}

/** Signs one answer gives (danger-sign answers reach the rules directly, not via the model). */
function answerSigns(state, card, answer, meta) {
  const out = [];
  if (card.kind === 'yes_no' && answer === 'yes' && card.sign) out.push(card.sign);
  if (card.kind === 'multi' && Array.isArray(answer)) {
    for (const label of answer) {
      const opt = card.options.find((o) => o.label === label);
      if (opt?.sign) out.push(opt.sign);
    }
  }
  if (meta.picture && card.pictureSet) {
    const sign = PICTURE_SIGNS[card.pictureSet]?.[meta.picture];
    if (sign) out.push(sign);
  }
  if (card.kind === 'severity' && answer === 'severe' && SEVERE_MEANS.has(card.sign)) out.push(card.sign);
  if (card.kind === 'body' && LOWER_BELLY.has(answer) && state.persona.stage === 'pregnant') out.push('lower_belly_pain');
  if (card.kind === 'search' && SYMPTOM_SIGNS[meta.symptom]) out.push(SYMPTOM_SIGNS[meta.symptom]);
  return out;
}

function runRules(state) {
  deriveSigns(state);
  const p = state.persona;
  state.rule = evaluate({ signs: [...state.signs], weeks: p.weeks, daysAfterBirth: p.daysAfterBirth, stage: p.stage });
  return referral(state);
}

const newCardId = () => `c${nextCardId++}`;
const explainOf = (args) => (args.explain ? String(args.explain).slice(0, 300) : undefined);

const str = (v, max = 300) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));

/**
 * Handle one tool call.
 * @returns {{response: object, card?: object, referral?: object, finish?: object, plan?: object}}
 */
export function handleTool(state, name, args) {
  args = args || {};
  switch (name) {
    case 'ask_yes_no': {
      const card = {
        id: `c${nextCardId++}`,
        kind: 'yes_no',
        explain: explainOf(args),
        question: str(args.question),
        // "Not sure" is a camera button by default (UI rule 1).
        notSure: ['camera', 'pictures', 'none'].includes(args.not_sure_action) ? args.not_sure_action : 'camera',
        pictureSet: PICTURE_SIGNS[args.picture_set] ? args.picture_set : undefined,
        sign: args.sign,
      };
      return { card, response: { shown: true, card_id: card.id } };
    }
    case 'ask_single_choice': {
      const card = {
        id: `c${nextCardId++}`,
        kind: 'single',
        explain: explainOf(args),
        question: str(args.question),
        herWords: args.her_words ? str(args.her_words) : undefined,
        options: (args.options || []).slice(0, 4).map((label) => ({ label: str(label, 80) })),
        pictureSet: PICTURE_SIGNS[args.picture_set] ? args.picture_set : undefined,
        somethingElse: true,
      };
      return { card, response: { shown: true, card_id: card.id } };
    }
    case 'ask_multi_choice': {
      const card = {
        id: `c${nextCardId++}`,
        kind: 'multi',
        explain: explainOf(args),
        question: str(args.question),
        options: (args.options || [])
          .slice(0, 8)
          .map((o) => (typeof o === 'string' ? { label: str(o, 80) } : { label: str(o.label, 80), sign: o.sign })),
        noneOption: true,
      };
      return { card, response: { shown: true, card_id: card.id } };
    }
    case 'ask_photo': {
      const purpose = ['medicine_strip', 'skin_patch', 'feet', 'document'].includes(args.purpose) ? args.purpose : 'medicine_strip';
      const card = { id: newCardId(), kind: 'photo', purpose, instruction: str(args.instruction), explain: explainOf(args) };
      return { card, response: { shown: true, card_id: card.id } };
    }
    case 'ask_duration': {
      const card = { id: newCardId(), kind: 'duration', question: str(args.question), options: DURATIONS, dontKnow: true, explain: explainOf(args) };
      return { card, response: { shown: true, card_id: card.id } };
    }
    case 'ask_severity': {
      const sign = SEVERE_MEANS.has(args.sign) ? args.sign : undefined;
      const card = { id: newCardId(), kind: 'severity', question: str(args.question), options: SEVERITIES, sign, explain: explainOf(args) };
      return { card, response: { shown: true, card_id: card.id } };
    }
    case 'ask_body_map': {
      const card = { id: newCardId(), kind: 'body', question: str(args.question), options: BODY_AREAS, explain: explainOf(args) };
      return { card, response: { shown: true, card_id: card.id } };
    }
    case 'ask_symptom_search': {
      const card = { id: newCardId(), kind: 'search', question: str(args.question), explain: explainOf(args) };
      return { card, response: { shown: true, card_id: card.id } };
    }
    case 'record_symptom': {
      state.symptoms.push({
        sign: args.sign || 'other',
        her_words: str(args.her_words),
        since: args.since ? str(args.since, 60) : undefined,
        severity: args.severity,
        at: Date.now(),
      });
      if (args.sign && args.sign !== 'other' && args.sign in SIGNS) state.baseSigns.add(args.sign);
      const r = runRules(state);
      return { referral: r, response: { saved: true, total: state.symptoms.length } };
    }
    case 'red_flag_check': {
      for (const s of args.extra_signs || []) if (s in SIGNS) state.baseSigns.add(s);
      const r = runRules(state);
      return {
        referral: r,
        response: {
          level: r.level,
          decided_by: 'fixed_rules',
          rule: r.rule,
          reasons: r.reasons,
          instruction:
            r.level === 'emergency'
              ? 'Tell her to call 108 now. Stay calm and short. Then call finish_talk.'
              : r.level === 'see_today'
                ? 'Tell her to see a doctor today, why in one line, and to keep taking her tablets. No disclaimers. Then call finish_talk.'
                : 'No danger sign by the rules. Continue the talk.',
        },
      };
    }
    case 'add_referral': {
      const before = referral(state).level;
      if (LEVELS.includes(args.level) && levelIndex(args.level) > levelIndex(state.modelLevel)) state.modelLevel = args.level;
      if (args.reason) state.modelReasons.push(`model: ${str(args.reason, 160)}`);
      const r = referral(state);
      return { referral: r, response: { level: r.level, changed: r.level !== before } };
    }
    case 'update_plan': {
      if (!PLAN_ITEMS.includes(args.item)) return { response: { error: `item must be one of ${PLAN_ITEMS.join(', ')}` } };
      state.plan[args.item] = { value: str(args.value, 120), ready: Boolean(args.ready), at: Date.now() };
      const ready = PLAN_ITEMS.filter((k) => state.plan[k]?.ready).length;
      return { plan: { ...state.plan }, response: { saved: true, item: args.item, ready_items_this_talk: ready } };
    }
    case 'finish_talk': {
      runRules(state);
      state.finished = {
        noted: (args.noted || []).slice(0, 8).map((x) => str(x, 140)),
        questionsForDoctor: (args.questions_for_doctor || []).slice(0, 5).map((x) => str(x, 160)),
        by: args.by || 'model',
      };
      return { finish: { ...state.finished, referral: referral(state) }, response: { ok: true } };
    }
    default:
      return { response: { error: `unknown tool ${name}` } };
  }
}

/**
 * Record a tapped answer. Danger-sign answers feed the fixed rules directly, not via the model.
 * @param {object} meta  {picture?: tile key, symptom?: search key, via?: 'tap'|'camera'|'keypad'|'voice'}
 */
export function recordAnswer(state, card, answer, meta = {}) {
  state.answers.push({
    cardId: card.id,
    kind: card.kind,
    question: card.question,
    answer,
    label: meta.label,
    picture: meta.picture,
    symptom: meta.symptom,
    pictureSet: card.pictureSet,
    via: meta.via || 'tap',
    signs: answerSigns(state, card, answer, meta),
    at: Date.now(),
  });
  return runRules(state);
}

/** "Previous": she changes her last answer to a card. The old answer stops counting; the new one is recorded. */
export function changeAnswer(state, card, answer, meta = {}) {
  const before = [...state.answers].reverse().find((a) => a.cardId === card.id && !a.changed);
  if (before) before.changed = true;
  return { before, referral: recordAnswer(state, card, answer, { ...meta, via: 'changed' }) };
}

/** Text sent to the model when she taps instead of speaking. */
export function answerText(card, answer, labels = {}, meta = {}) {
  const shown = Array.isArray(answer) ? answer.join(', ') : meta.label || labels[answer] || answer;
  const pic = meta.picture ? ` (picture "${meta.picture}" from ${card.pictureSet})` : '';
  const code = ['duration', 'severity', 'body'].includes(card.kind) ? ` (${card.kind}: ${answer})` : card.kind === 'search' && meta.symptom ? ` (symptom: ${meta.symptom})` : '';
  return `[She tapped on the card "${card.question}": ${shown || 'nothing'}${pic}${code}]`;
}

/** Text sent to the model when she goes back and changes an answer. */
export function changedText(card, before, answer, meta = {}) {
  const was = before ? (Array.isArray(before.answer) ? before.answer.join(', ') : before.label || before.answer) : 'nothing';
  const now = Array.isArray(answer) ? answer.join(', ') : meta.label || answer;
  return `[She went back and changed her answer to "${card.question}": it was "${was}", now "${now}". Use the new answer.]`;
}

const CAMERA_WHAT = {
  feet: 'her feet and ankles',
  skin_patch: 'a face-free patch of skin (for a baby: chest skin in daylight)',
  medicine_strip: 'the medicine strip or box',
  document: 'a report or MCP card page',
};

/** Text that starts a camera turn ("Not sure" → camera). */
export function cameraTurnText(card, purpose) {
  const what = CAMERA_WHAT[purpose] || CAMERA_WHAT.medicine_strip;
  return `[She is not sure about "${card?.question || 'your question'}". She turned on her back camera to show you ${what}. Video frames follow, about one per second. In one or two short sentences say what you see, in her language, without naming a disease. If you see her face or a private body part, kindly ask her to point the camera only at ${what}. Then ask her to confirm, or show a card.]`;
}

/** Plain-JSON snapshot of the talk, kept as lastTalk and used by S10–S13. */
export function snapshotTalk(state, extra = {}) {
  const r = referral(state);
  return {
    at: Date.now(),
    startedAt: state.startedAt,
    persona: state.persona.id,
    signs: [...state.signs],
    symptoms: state.symptoms,
    answers: state.answers,
    photos: state.photos,
    plan: state.plan,
    referral: r,
    noted: state.finished?.noted || [],
    questionsForDoctor: state.finished?.questionsForDoctor || [],
    finishedBy: state.finished?.by || null,
    ...extra,
  };
}

/** Rebuild a talk state from a snapshot (video talk → phone call keeps going). */
export function restoreTalkState(persona, snap) {
  const s = createTalkState(persona);
  if (!snap || snap.persona !== persona.id) return s;
  for (const x of snap.signs || []) s.baseSigns.add(x);
  s.symptoms = [...(snap.symptoms || [])];
  s.answers = [...(snap.answers || [])];
  s.photos = [...(snap.photos || [])];
  s.plan = { ...(snap.plan || {}) };
  s.startedAt = snap.startedAt || s.startedAt;
  if (snap.referral?.raisedByModel) {
    s.modelLevel = snap.referral.level;
    s.modelReasons = (snap.referral.reasons || []).filter((x) => x.startsWith('model:'));
  }
  runRules(s);
  return s;
}

/**
 * "Ayu noted today" from what the talk recorded. Card text and labels are already in her language.
 * @returns {string[]} "mark|text" items for <Checklist>
 */
export function notedFromTalk(talk, words = {}) {
  if (!talk) return [];
  const { yes = 'Yes', no = 'No', notSure = 'Not sure', none = 'None', camera = 'shown on camera' } = words;
  if (talk.noted?.length) return talk.noted.map((x) => (/^\w+\|/.test(x) ? x : `done|${x}`));
  const label = (a) => (a === 'yes' ? yes : a === 'no' ? no : a === 'not_sure' ? notSure : a);
  const out = [];
  for (const s of talk.symptoms || []) out.push(`warn|“${s.her_words}”${s.since ? ` · ${s.since}` : ''}`);
  for (const a of talk.answers || []) {
    if (a.kind === 'photo' || a.changed) continue;
    const ans = Array.isArray(a.answer) ? a.answer.join(', ') || none : a.label || label(a.answer);
    const cam = a.via === 'camera';
    out.push(`${cam ? 'warn' : 'done'}|${a.question} — ${ans}${cam ? ` (${camera})` : ''}`);
  }
  return out.slice(0, 8);
}
