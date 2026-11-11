// State of one daily talk and the local handlers for every tool the model
// can call. Used by the Gemini engine (real tool calls) and the mock engine
// (scripted tool calls), so both behave the same.

import { evaluate, escalate, levelIndex } from './red-flags.js';

let nextCardId = 1;

export function createTalkState(persona) {
  return {
    persona,
    signs: new Set(),
    symptoms: [],
    answers: [],
    photos: [],
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

/**
 * Handle one tool call.
 * @returns {{response: object, card?: object, referral?: object, finish?: object}}
 */
export function handleTool(state, name, args = {}) {
  switch (name) {
    case 'ask_yes_no': {
      const card = {
        id: `c${nextCardId++}`,
        kind: 'yes_no',
        question: args.question,
        notSure: args.not_sure_action || (args.picture_set ? 'pictures' : 'camera'),
        pictureSet: args.picture_set,
        sign: args.sign,
      };
      return { card, response: { shown: true, card_id: card.id } };
    }
    case 'ask_single_choice': {
      const card = {
        id: `c${nextCardId++}`,
        kind: 'single',
        question: args.question,
        herWords: args.her_words,
        options: (args.options || []).slice(0, 4).map((label) => ({ label })),
        pictureSet: args.picture_set,
        somethingElse: true,
      };
      return { card, response: { shown: true, card_id: card.id } };
    }
    case 'ask_multi_choice': {
      const card = {
        id: `c${nextCardId++}`,
        kind: 'multi',
        question: args.question,
        options: (args.options || []).slice(0, 8).map((o) => (typeof o === 'string' ? { label: o } : o)),
        noneOption: true,
      };
      return { card, response: { shown: true, card_id: card.id } };
    }
    case 'ask_photo': {
      const card = {
        id: `c${nextCardId++}`,
        kind: 'photo',
        purpose: args.purpose,
        instruction: args.instruction,
      };
      return { card, response: { shown: true, card_id: card.id } };
    }
    case 'record_symptom': {
      state.symptoms.push({ ...args, at: Date.now() });
      if (args.sign && args.sign !== 'other') state.signs.add(args.sign);
      return { response: { saved: true, total: state.symptoms.length } };
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
              ? 'Tell her to call 108 now. Stay calm and short.'
              : r.level === 'see_today'
                ? 'Tell her to see a doctor today, why in one line, and to keep taking her tablets.'
                : 'No danger sign by the rules. Continue the talk.',
        },
      };
    }
    case 'add_referral': {
      const before = referral(state).level;
      if (levelIndex(args.level) > levelIndex(state.modelLevel)) state.modelLevel = args.level;
      if (args.reason) state.modelReasons.push(`model: ${args.reason}`);
      const r = referral(state);
      return { referral: r, response: { level: r.level, changed: r.level !== before } };
    }
    case 'finish_talk': {
      runRules(state);
      state.finished = { noted: args.noted || [], questionsForDoctor: args.questions_for_doctor || [] };
      return { finish: { ...state.finished, referral: referral(state) }, response: { ok: true } };
    }
    default:
      return { response: { error: `unknown tool ${name}` } };
  }
}

/** Record a tapped answer. Danger-sign answers feed the fixed rules directly, not via the model. */
export function recordAnswer(state, card, answer) {
  state.answers.push({ cardId: card.id, question: card.question, answer, at: Date.now() });
  if (card.kind === 'yes_no' && answer === 'yes' && card.sign) state.signs.add(card.sign);
  if (card.kind === 'multi' && Array.isArray(answer)) {
    for (const label of answer) {
      const opt = card.options.find((o) => o.label === label);
      if (opt?.sign) state.signs.add(opt.sign);
    }
  }
  return runRules(state);
}

/** Text sent to the model when she taps instead of speaking. */
export function answerText(card, answer, labels = {}) {
  const shown = Array.isArray(answer) ? answer.join(', ') : labels[answer] || answer;
  return `[She tapped on the card "${card.question}": ${shown || 'nothing'}]`;
}
