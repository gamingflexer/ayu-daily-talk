// Pure tool-call handling shared by the Gemini engine and the tests.
// One Live API toolCall message can carry several function calls; each gets
// exactly one functionResponse with the same id and name, so the model is never
// left waiting.

import { handleTellTool, recordedSigns } from '../../shared/talk-state.js';

/**
 * @param {object} state  Tell state (shared/talk-state.js)
 * @param {{id: string, name: string, args?: object}[]} calls
 * @returns {{events: object[], functionResponses: object[]}}
 */
export function runToolCalls(state, calls) {
  const events = [];
  const functionResponses = [];
  let noted = false;
  for (const call of calls || []) {
    if (!call?.name) continue;
    const out = handleTellTool(state, call.name, call.args || {});
    if (out.symptom) noted = true;
    if (out.finish) events.push({ type: 'finish', by: 'model' });
    functionResponses.push({ id: call.id, name: call.name, response: out.response });
  }
  // One event per message, with the whole deduped list, before any finish.
  if (noted) events.unshift({ type: 'noted', symptoms: state.symptoms.map((x) => ({ ...x })), signs: recordedSigns(state) });
  return { events, functionResponses };
}
