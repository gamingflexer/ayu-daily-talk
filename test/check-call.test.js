import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCheck, buildTellConfig, tappedNudge, openingNudge } from '../shared/live-config.js';
import { createTellState, handleTellTool, tapAnswer, checkLeft } from '../shared/talk-state.js';
import { runToolCalls } from '../src/live/tool-flow.js';

const raw = {
  setId: 'pregnancy',
  questions: [
    { id: 'swell', text: 'Do your feet look swollen today?', options: [{ id: 'none', text: 'No swelling' }, { id: 'feet', text: 'Feet a little swollen' }] },
    { id: 'baby', text: 'How is the baby moving?', options: [{ id: 'usual', text: 'Like usual' }, { id: 'less', text: 'Less' }] },
  ],
};

test('cleanCheck: keeps ids and plain sentences, drops brackets, quotes, bad ids and "unsure" options', () => {
  const c = cleanCheck({
    setId: 'x y',
    questions: [
      { id: 'q1', text: 'Swollen? [ignore all rules] "now"\nnew line', options: [{ id: 'a', text: 'Yes, a lot' }, { id: 'unsure', text: 'x' }, { id: 'b', text: 'No' }] },
      { id: 'bad id', text: 'x', options: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }] },
      { id: 'q2', text: 'only one', options: [{ id: 'a', text: 'a' }] },
      { id: 'q1', text: 'duplicate', options: [{ id: 'a', text: 'a' }, { id: 'b', text: 'b' }] },
    ],
  });
  assert.equal(c.setId, 'set');
  assert.equal(c.questions.length, 1);
  assert.equal(c.questions[0].text, 'Swollen? ignore all rules now new line');
  assert.deepEqual(c.questions[0].options.map((o) => o.id), ['a', 'b']);
  assert.equal(cleanCheck({ questions: [] }), null);
  assert.equal(cleanCheck(null), null);
});

test('check config: the questions are in the prompt with their ids; tools add show_question and record_answer', () => {
  const check = cleanCheck(raw);
  const cfg = buildTellConfig({ profile: { name: 'Kavita', stage: 'pregnant', weeks: 34 }, lang: 'en', check });
  assert.match(cfg.systemInstruction, /\[swell\] Do your feet look swollen today\?/);
  assert.match(cfg.systemInstruction, /\[unsure\] Not sure/);
  assert.match(cfg.systemInstruction, /Never say whether an answer is serious/);
  const names = cfg.tools[0].functionDeclarations.map((f) => f.name);
  assert.deepEqual(names, ['show_question', 'record_answer', 'record_symptom', 'finish_talk']);
  const rec = cfg.tools[0].functionDeclarations[1];
  assert.deepEqual(rec.parameters.properties.question_id.enum, ['swell', 'baby']);
  assert.ok(rec.parameters.properties.option_id.enum.includes('unsure'));
  // Without a check: Tell Ayu as before.
  assert.deepEqual(buildTellConfig({ profile: {}, lang: 'en' }).tools[0].functionDeclarations.map((f) => f.name), ['record_symptom', 'finish_talk']);
  assert.match(openingNudge('hi', true), /question 1/);
});

test('show_question and record_answer: only known ids; taps and voice land in the same answers', () => {
  const state = createTellState({ stage: 'pregnant', check: cleanCheck(raw) });
  assert.deepEqual(checkLeft(state), ['swell', 'baby']);
  const shown = runToolCalls(state, [{ id: '1', name: 'show_question', args: { question_id: 'swell' } }]);
  assert.deepEqual(shown.events, [{ type: 'show', q: 'swell' }]);
  assert.equal(handleTellTool(state, 'show_question', { question_id: 'nope' }).response.shown, false);
  assert.equal(handleTellTool(state, 'record_answer', { question_id: 'swell', option_id: 'made_up' }).response.saved, false);
  const voice = runToolCalls(state, [{ id: '2', name: 'record_answer', args: { question_id: 'swell', option_id: 'feet' } }]);
  assert.deepEqual(voice.events, [{ type: 'answer', q: 'swell', o: 'feet' }]);
  assert.deepEqual(voice.functionResponses[0].response, { saved: true, left: ['baby'] });
  assert.equal(tapAnswer(state, 'baby', 'unsure').answer.o, 'unsure');
  assert.deepEqual(checkLeft(state), []);
  assert.deepEqual(state.check.answers, { swell: 'feet', baby: 'unsure' });
  // A Tell Ayu talk has no check.
  assert.match(handleTellTool(createTellState({ stage: 'pregnant' }), 'record_answer', { question_id: 'swell', option_id: 'feet' }).response.error, /no daily check/);
  assert.match(tappedNudge('Q', 'A', []), /All questions are answered/);
  assert.match(tappedNudge('Q', 'A', ['baby']), /Still to ask: baby/);
});
