// State of one daily talk and the local handlers for every tool the model
// can call. Used by the Gemini engine (real tool calls) and the mock engine
// (scripted tool calls), so both behave the same.

import { evaluate, escalate, levelIndex, LEVELS } from './red-flags.js';

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
};

/** Tile in a set that means "no, looks normal" when the set is shown on a yes/no card. */
export const PICTURE_NORMAL = { feet_swelling: 'normal', baby_skin_colour: 'normal', stool_colour: 'yellow' };

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

function runRules(state) {
  const p = state.persona;
  state.rule = evaluate({ signs: [...state.signs], weeks: p.weeks, daysAfterBirth: p.daysAfterBirth });
  return referral(state);
}

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
      const card = { id: `c${nextCardId++}`, kind: 'photo', purpose, instruction: str(args.instruction) };
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
      if (args.sign && args.sign !== 'other') state.signs.add(args.sign);
      const r = runRules(state);
      return { referral: r, response: { saved: true, total: state.symptoms.length } };
    }
    case 'red_flag_check': {
      for (const s of args.extra_signs || []) state.signs.add(s);
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
                ? 'Tell her to see a doctor today, why in one line, and to keep taking her tablets. Then call finish_talk.'
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
 * @param {object} meta  {picture?: tile key, via?: 'tap'|'camera'|'keypad'}
 */
export function recordAnswer(state, card, answer, meta = {}) {
  state.answers.push({
    cardId: card.id,
    kind: card.kind,
    question: card.question,
    answer,
    picture: meta.picture,
    pictureSet: card.pictureSet,
    via: meta.via || 'tap',
    at: Date.now(),
  });
  if (card.kind === 'yes_no' && answer === 'yes' && card.sign) state.signs.add(card.sign);
  if (card.kind === 'multi' && Array.isArray(answer)) {
    for (const label of answer) {
      const opt = card.options.find((o) => o.label === label);
      if (opt?.sign) state.signs.add(opt.sign);
    }
  }
  if (meta.picture && card.pictureSet) {
    const sign = PICTURE_SIGNS[card.pictureSet]?.[meta.picture];
    if (sign) state.signs.add(sign);
  }
  return runRules(state);
}

/** Text sent to the model when she taps instead of speaking. */
export function answerText(card, answer, labels = {}, meta = {}) {
  const shown = Array.isArray(answer) ? answer.join(', ') : labels[answer] || answer;
  const pic = meta.picture ? ` (picture "${meta.picture}" from ${card.pictureSet})` : '';
  return `[She tapped on the card "${card.question}": ${shown || 'nothing'}${pic}]`;
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
  for (const x of snap.signs || []) s.signs.add(x);
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
    if (a.kind === 'photo') continue;
    const ans = Array.isArray(a.answer) ? a.answer.join(', ') || none : label(a.answer);
    const cam = a.via === 'camera';
    out.push(`${cam ? 'warn' : 'done'}|${a.question} — ${ans}${cam ? ` (${camera})` : ''}`);
  }
  return out.slice(0, 8);
}
