// Pure tool-call handling shared by the Gemini engine and the tests.
// One Live API toolCall message can carry several function calls; each gets
// exactly one functionResponse with the same id and name. Card tools are
// NON_BLOCKING: their response is SILENT so Ayu keeps talking.

import { handleTool } from '../../shared/talk-state.js';

export const CARD_TOOLS = new Set([
  'ask_yes_no',
  'ask_single_choice',
  'ask_multi_choice',
  'ask_duration',
  'ask_severity',
  'ask_body_map',
  'ask_symptom_search',
  'ask_photo',
]);

/**
 * @param {object} state  talk state
 * @param {{id: string, name: string, args?: object}[]} calls
 * @param {{asyncTools?: boolean}} opts
 * @returns {{events: object[], functionResponses: object[], cards: object[]}}
 */
export function runToolCalls(state, calls, { asyncTools = true } = {}) {
  const events = [];
  const functionResponses = [];
  const cards = [];
  for (const call of calls || []) {
    if (!call?.name) continue;
    const out = handleTool(state, call.name, call.args || {});
    events.push({ type: 'tool', name: call.name, args: call.args, result: out.response, callId: call.id });
    if (out.card) {
      out.card.callId = call.id;
      cards.push(out.card);
      events.push({ type: 'card', card: out.card });
    }
    if (out.referral) events.push({ type: 'referral', referral: out.referral });
    if (out.plan) events.push({ type: 'plan', plan: out.plan });
    if (out.finish) events.push({ type: 'finish', ...out.finish });
    const fr = { id: call.id, name: call.name, response: out.response };
    if (asyncTools && CARD_TOOLS.has(call.name)) fr.scheduling = 'SILENT';
    functionResponses.push(fr);
  }
  return { events, functionResponses, cards };
}

/**
 * Cards waiting to be shown. Several card calls can arrive in one message:
 * the first is shown, the rest wait their turn. A cancelled call is dropped.
 */
export function cardQueue(queue, action) {
  switch (action.type) {
    case 'add':
      return queue.some((c) => c.id === action.card.id) ? queue : [...queue, action.card];
    case 'answered':
      return queue.filter((c) => c.id !== action.id);
    case 'cancel':
      return queue.filter((c) => !(c.callId && action.ids.includes(c.callId)));
    case 'clear':
      return [];
    default:
      return queue;
  }
}

/** Is this a question that should have come with a card? Open questions and greetings need none. */
const OPEN_START = /^(how|what|tell|why|and how|so how|good morning|namaste|hello|hi)\b/i;
export function looksLikeCardQuestion(text, turnIndex) {
  if (turnIndex === 0) return false; // the greeting
  const q = lastQuestion(text);
  if (!q) return false;
  if (OPEN_START.test(q)) return false;
  return true;
}

/** Last sentence that ends in a question mark (works for Indic scripts too, which use "?"). */
export function lastQuestion(text = '') {
  const parts = String(text).trim().split(/(?<=[?？।.!])\s+/);
  for (let i = parts.length - 1; i >= 0; i--) if (/[?？]\s*$/.test(parts[i])) return parts[i].trim();
  return null;
}

/** Text sent when Ayu asked a closed question aloud without its card. */
export function missingCardNudge(q) {
  return `[You asked "${q}" aloud but showed no card. If that is a yes/no, choice, how long, how bad, where or which-symptom question, call the matching ask_* tool now with the same question. If it was an open question, ignore this.]`;
}
