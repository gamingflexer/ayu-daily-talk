// State of one "Tell Ayu" session and the local handlers for the two tools the
// model can call (record_symptom, finish_talk). Pure: no browser, no SDK, so the
// engine (src/live/gemini-live.js) and the tests share it.
//
// The model only RECORDS what she said. It never decides or announces a level:
// the fixed rules (shared/triage.js) run in the app after she confirms what Ayu heard.
// Nothing here reads her transcript: a sign is recorded only by a tool call.

import { SIGNS } from './red-flags.js';

export const SEVERITY = ['mild', 'moderate', 'severe', 'unknown'];

/** Sign groups that apply at each stage (same groups the rules use). */
const STAGE_GROUPS = {
  pregnant: ['pregnancy', 'any'],
  postnatal: ['pregnancy', 'postnatal', 'newborn', 'any'],
};

/** Signs the model may record for a woman at this stage (plus 'other' for anything else). */
export function signsFor(stage) {
  const groups = STAGE_GROUPS[stage];
  return Object.keys(SIGNS).filter((s) => !groups || groups.includes(SIGNS[s].group));
}

const str = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/\s+/g, ' ').trim().slice(0, max);

export function createTellState({ stage, check = null } = {}) {
  return {
    stage,
    /** In a daily check on the call: the questions (cleaned), her answers and the one on screen. */
    check: check ? { questions: check.questions, answers: {}, current: null } : null,
    allowed: new Set(signsFor(stage)),
    /** What she said she has, one entry per sign (deduped), in the order Ayu first recorded it. */
    symptoms: [],
    finished: false,
    startedAt: Date.now(),
  };
}

/** Recorded signs, deduped, in order (no 'other'). */
export const recordedSigns = (state) => state.symptoms.filter((x) => x.sign !== 'other').map((x) => x.sign);

/** Question ids of the daily check not answered yet (in order). */
export function checkLeft(state) {
  const c = state.check;
  return c ? c.questions.filter((q) => c.answers[q.id] === undefined).map((q) => q.id) : [];
}

/** She tapped an answer on the card (the same as record_answer, from her finger). */
export function tapAnswer(state, qid, oid) {
  return handleTellTool(state, 'record_answer', { question_id: qid, option_id: oid });
}

/**
 * Handle one tool call from the model.
 * @returns {{response: object, symptom?: object, finish?: boolean}}
 */
export function handleTellTool(state, name, args) {
  args = args && typeof args === 'object' ? args : {};
  switch (name) {
    case 'record_symptom': {
      if (state.finished) return { response: { saved: false, reason: 'already finished' } };
      const raw = str(args.sign, 40);
      const sign = state.allowed.has(raw) ? raw : 'other';
      const words = str(args.her_words, 200);
      const since = str(args.since, 60) || undefined;
      const severity = SEVERITY.includes(args.severity) ? args.severity : undefined;
      if (sign === 'other' && !words) return { response: { saved: false, reason: 'her_words needed for other' } };
      // One entry per sign; 'other' entries are one per distinct thing she said.
      const same =
        sign === 'other'
          ? state.symptoms.find((x) => x.sign === 'other' && x.her_words.toLowerCase() === words.toLowerCase())
          : state.symptoms.find((x) => x.sign === sign);
      if (same) {
        if (words) same.her_words = words;
        if (since) same.since = since;
        if (severity && severity !== 'unknown') same.severity = severity;
        return { symptom: same, response: { saved: true, already_noted: true } };
      }
      const symptom = { sign, her_words: words, since, severity, at: Date.now() };
      state.symptoms.push(symptom);
      return { symptom, response: { saved: true } };
    }
    case 'show_question': {
      const c = state.check;
      if (!c) return { response: { error: 'no daily check in this talk' } };
      const q = c.questions.find((x) => x.id === str(args.question_id, 20));
      if (!q) return { response: { shown: false, reason: 'unknown question_id', question_ids: c.questions.map((x) => x.id) } };
      c.current = q.id;
      return { show: q.id, response: { shown: true, already_answered: c.answers[q.id] !== undefined } };
    }
    case 'record_answer': {
      const c = state.check;
      if (!c) return { response: { error: 'no daily check in this talk' } };
      const q = c.questions.find((x) => x.id === str(args.question_id, 20));
      if (!q) return { response: { saved: false, reason: 'unknown question_id' } };
      const o = str(args.option_id, 20);
      if (o !== 'unsure' && !q.options.some((x) => x.id === o)) return { response: { saved: false, reason: 'unknown option_id', option_ids: [...q.options.map((x) => x.id), 'unsure'] } };
      c.answers[q.id] = o;
      return { answer: { q: q.id, o }, response: { saved: true, left: checkLeft(state) } };
    }
    case 'finish_talk': {
      state.finished = true;
      return { finish: true, response: { ok: true } };
    }
    default:
      return { response: { error: `unknown tool ${name}` } };
  }
}

/**
 * Add one input-transcription chunk to what she has said so far.
 * Chunks inside a turn are joined as they come (they carry their own spaces);
 * a new turn of hers (after Ayu spoke) starts after a space.
 */
export function appendHeard(heard, chunk, newTurn = false) {
  if (!chunk) return heard;
  const next = newTurn && heard ? `${heard.trimEnd()} ${chunk.trimStart()}` : heard + chunk;
  return next.replace(/\s+/g, ' ').replace(/^\s+/, '');
}

/** Text sent after a reconnect so Ayu does not start over. */
export function resumeText(state, heard = '') {
  const noted = state.symptoms.map((x) => `${x.sign} ("${x.her_words}")`).join('; ');
  const words = heard ? heard.slice(-400) : '';
  return `[The connection dropped for a moment and is back. Do not greet her again. Already recorded: ${noted || 'nothing yet'}. Her words so far: "${words}". Say "I'm back" in one short line in her language and keep listening.]`;
}
