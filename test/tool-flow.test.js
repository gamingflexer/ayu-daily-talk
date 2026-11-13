import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runToolCalls, cardQueue, CARD_TOOLS, looksLikeCardQuestion, lastQuestion, missingCardNudge } from '../src/live/tool-flow.js';
import { nextPhase } from '../src/live/phase.js';
import { createTalkState, recordAnswer, changeAnswer, referral, handleTool } from '../shared/talk-state.js';
import { getPersona } from '../shared/personas.js';
import { toolDeclarations, buildLiveConfig, LANG_NAME, LANG_SCRIPT, openingNudge } from '../shared/live-config.js';
import { evaluate } from '../shared/red-flags.js';

const sunita = getPersona('sunita');

test('every declared ask_* tool is a non-blocking card tool, and back', () => {
  const decl = toolDeclarations({ asyncTools: true });
  const askNames = decl.filter((d) => d.name.startsWith('ask_')).map((d) => d.name);
  assert.deepEqual(askNames.sort(), [...CARD_TOOLS].sort());
  for (const d of decl) assert.equal(d.behavior === 'NON_BLOCKING', CARD_TOOLS.has(d.name), d.name);
  for (const n of askNames) assert.ok(decl.find((d) => d.name === n).parameters.properties.explain, `${n} has explain`);
});

test('several calls in one message: one response per call, same id + name, cards SILENT, others not', () => {
  const s = createTalkState(sunita);
  const calls = [
    { id: 'a1', name: 'ask_duration', args: { question: 'Since when?', explain: 'When did it start' } },
    { id: 'a2', name: 'record_symptom', args: { sign: 'severe_headache', her_words: 'sir dard' } },
    { id: 'a3', name: 'ask_severity', args: { question: 'How bad?', sign: 'severe_headache' } },
    { id: 'a4', name: 'red_flag_check', args: {} },
  ];
  const { events, functionResponses, cards } = runToolCalls(s, calls, { asyncTools: true });
  assert.deepEqual(functionResponses.map((r) => [r.id, r.name]), calls.map((c) => [c.id, c.name]));
  assert.equal(functionResponses[0].scheduling, 'SILENT');
  assert.equal(functionResponses[1].scheduling, undefined);
  assert.equal(functionResponses[2].scheduling, 'SILENT');
  assert.equal(functionResponses[3].response.decided_by, 'fixed_rules');
  assert.deepEqual(cards.map((c) => c.kind), ['duration', 'severity']);
  assert.deepEqual(cards.map((c) => c.callId), ['a1', 'a3']);
  assert.equal(cards[0].explain, 'When did it start');
  assert.equal(events.filter((e) => e.type === 'card').length, 2);
  assert.ok(events.some((e) => e.type === 'referral'));
  assert.notEqual(cards[0].id, cards[1].id);
});

test('blocking mode (LIVE_ASYNC_TOOLS=false): no SILENT scheduling', () => {
  const s = createTalkState(sunita);
  const { functionResponses } = runToolCalls(s, [{ id: 'x', name: 'ask_yes_no', args: { question: 'q' } }], { asyncTools: false });
  assert.equal(functionResponses[0].scheduling, undefined);
});

test('unknown tool still gets a response (the model is never left waiting)', () => {
  const s = createTalkState(sunita);
  const { functionResponses } = runToolCalls(s, [{ id: 'z', name: 'nope', args: {} }]);
  assert.equal(functionResponses.length, 1);
  assert.match(functionResponses[0].response.error, /unknown tool/);
});

test('card queue: first shown, rest wait, cancellation drops by call id, answered removes', () => {
  const s = createTalkState(sunita);
  const { cards } = runToolCalls(s, [
    { id: 'k1', name: 'ask_yes_no', args: { question: 'a?' } },
    { id: 'k2', name: 'ask_body_map', args: { question: 'where?' } },
    { id: 'k3', name: 'ask_symptom_search', args: { question: 'else?' } },
  ]);
  let q = [];
  for (const c of cards) q = cardQueue(q, { type: 'add', card: c });
  q = cardQueue(q, { type: 'add', card: cards[0] }); // duplicate ignored
  assert.deepEqual(q.map((c) => c.kind), ['yes_no', 'body', 'search']);
  q = cardQueue(q, { type: 'cancel', ids: ['k2'] });
  assert.deepEqual(q.map((c) => c.kind), ['yes_no', 'search']);
  q = cardQueue(q, { type: 'answered', id: cards[0].id });
  assert.equal(q[0].kind, 'search');
});

test('question guard: closed questions need a card, greetings and open questions do not', () => {
  assert.equal(lastQuestion('Okay. Do your feet look swollen today?'), 'Do your feet look swollen today?');
  assert.equal(lastQuestion('तबीयत कैसी है? ठीक है।'), 'तबीयत कैसी है?');
  assert.equal(looksLikeCardQuestion('Namaste Sunita, how are you today?', 0), false);
  assert.equal(looksLikeCardQuestion('How did you sleep?', 3), false);
  assert.equal(looksLikeCardQuestion('I see. Is the baby moving as usual?', 3), true);
  assert.equal(looksLikeCardQuestion('I have noted that.', 3), false);
  assert.match(missingCardNudge('Is the baby moving?'), /call the matching ask_\* tool/);
});

test('phase follows engine events: connecting → listening → thinking → speaking → checking → saving', () => {
  let p = 'permissions';
  const seq = [
    [{ type: 'status', status: 'connecting' }, 'connecting'],
    [{ type: 'status', status: 'live' }, 'listening'],
    [{ type: 'speaking', on: true }, 'speaking'],
    [{ type: 'speaking', on: false }, 'listening'],
    [{ type: 'thinking' }, 'thinking'],
    [{ type: 'card', card: {} }, 'listening'],
    [{ type: 'thinking' }, 'thinking'],
    [{ type: 'speaking', on: true }, 'speaking'],
    [{ type: 'thinking' }, 'speaking'], // never "thinking" over her hearing Ayu
    [{ type: 'speaking', on: false }, 'listening'],
    [{ type: 'tool', name: 'red_flag_check' }, 'checking'],
    [{ type: 'speaking', on: true }, 'speaking'],
    [{ type: 'status', status: 'reconnecting' }, 'reconnecting'],
    [{ type: 'status', status: 'live' }, 'listening'],
    [{ type: 'finish' }, 'saving'],
    [{ type: 'speaking', on: true }, 'saving'],
    [{ type: 'status', status: 'ended' }, 'saving'],
  ];
  for (const [e, want] of seq) {
    p = nextPhase(p, e);
    assert.equal(p, want, JSON.stringify(e));
  }
  assert.equal(nextPhase('listening', { type: 'status', status: 'ended', unexpected: true }), 'error');
  assert.equal(nextPhase('listening', { type: 'status', status: 'ended' }), 'ended');
});

test('new answer types reach the fixed rules', () => {
  // Severe headache via the severity card + face swelling → see today
  const s = createTalkState(getPersona('reena'));
  const sev = handleTool(s, 'ask_severity', { question: 'How bad is the headache?', sign: 'severe_headache' }).card;
  assert.equal(recordAnswer(s, sev, 'moderate').level, 'none');
  const s2 = createTalkState(getPersona('reena'));
  const sev2 = handleTool(s2, 'ask_severity', { question: 'How bad?', sign: 'severe_headache' }).card;
  recordAnswer(s2, sev2, 'severe');
  assert.ok(s2.signs.has('severe_headache'));
  const yn = handleTool(s2, 'ask_yes_no', { question: 'Face swollen?', sign: 'swelling_face_hands' }).card;
  assert.equal(recordAnswer(s2, yn, 'yes').level, 'see_today');

  // Body map: lower belly in pregnancy → watch; with "severe" → strong belly pain → see today
  const b = createTalkState(sunita);
  const map = handleTool(b, 'ask_body_map', { question: 'Where?' }).card;
  assert.equal(recordAnswer(b, map, 'lower_belly_left').level, 'watch');
  const bs = handleTool(b, 'ask_severity', { question: 'How bad?' }).card;
  const r = recordAnswer(b, bs, 'severe');
  assert.equal(r.level, 'see_today');
  assert.ok(b.signs.has('severe_abdominal_pain'));

  // Body map after birth: no pregnancy belly rule
  const pn = createTalkState(getPersona('anita'));
  const pmap = handleTool(pn, 'ask_body_map', { question: 'Where?' }).card;
  assert.equal(recordAnswer(pn, pmap, 'lower_belly_right').level, 'none');

  // Symptom search: "Bleeding" from the list is the sign itself; a free-text answer is not
  const q = createTalkState(sunita);
  const search = handleTool(q, 'ask_symptom_search', { question: 'Anything else?' }).card;
  assert.equal(recordAnswer(q, search, 'Bleeding', { symptom: 'bleeding', label: 'Bleeding' }).level, 'see_today');
  const q2 = createTalkState(sunita);
  const s3 = handleTool(q2, 'ask_symptom_search', { question: 'Anything else?' }).card;
  assert.equal(recordAnswer(q2, s3, 'my knee').level, 'none');

  // Duration never sets a sign
  const d = createTalkState(sunita);
  const dc = handleTool(d, 'ask_duration', { question: 'Since when?' }).card;
  assert.deepEqual(dc.options, ['lt_day', 'day_week', 'week_month', 'gt_month']);
  assert.equal(recordAnswer(d, dc, 'gt_month').level, 'none');

  // Severity on an unknown sign is ignored (the model cannot invent a sign)
  assert.equal(handleTool(d, 'ask_severity', { question: 'q', sign: 'fever' }).card.sign, undefined);
});

test('"Previous": changing a tapped answer re-derives the signs; model-raised levels stay', () => {
  const s = createTalkState(sunita);
  const yn = handleTool(s, 'ask_yes_no', { question: 'Bleeding?', sign: 'bleeding' }).card;
  assert.equal(recordAnswer(s, yn, 'yes').level, 'see_today');
  const { before, referral: r } = changeAnswer(s, yn, 'no');
  assert.equal(before.answer, 'yes');
  assert.equal(r.level, 'none');
  assert.equal(s.answers.filter((a) => !a.changed).length, 1);
  // A sign she said in her own words (record_symptom) is not removed by changing a card.
  handleTool(s, 'record_symptom', { sign: 'bleeding', her_words: 'thoda khoon' });
  assert.equal(changeAnswer(s, yn, 'no').referral.level, 'see_today');
  // The model raised it: changing an answer never lowers that.
  const m = createTalkState(sunita);
  handleTool(m, 'add_referral', { level: 'see_today', reason: 'worried' });
  const c = handleTool(m, 'ask_yes_no', { question: 'Fever?', sign: 'fever' }).card;
  recordAnswer(m, c, 'yes');
  assert.equal(changeAnswer(m, c, 'no').referral.level, 'see_today');
  assert.equal(referral(m).raisedByModel, true);
});

test('lower_belly_pain alone is watch; with another sign it counts toward "two signs"', () => {
  assert.equal(evaluate({ signs: ['lower_belly_pain'], weeks: 28 }).level, 'watch');
  assert.equal(evaluate({ signs: ['lower_belly_pain', 'swelling_feet'], weeks: 28 }).level, 'see_today');
});

test('every app language: prompt names it, its script, and the opening nudge', () => {
  for (const [code, name] of Object.entries(LANG_NAME)) {
    const cfg = buildLiveConfig({ persona: sunita, lang: code });
    assert.match(cfg.systemInstruction, new RegExp(`She chose ${name} in the app`));
    if (code !== 'en') assert.match(cfg.systemInstruction, new RegExp(`in ${LANG_SCRIPT[code]} script`));
    assert.match(openingNudge(code), new RegExp(name));
  }
});
