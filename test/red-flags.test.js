import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, escalate, mentionsStoppingMedicine } from '../shared/red-flags.js';
import { createTalkState, handleTool, recordAnswer, referral } from '../shared/talk-state.js';
import { getPersona } from '../shared/personas.js';
import { buildLiveConfig } from '../shared/live-config.js';

test('no signs → none', () => {
  assert.equal(evaluate({ signs: [], weeks: 24 }).level, 'none');
});

test('headache + face swelling → see today (Flow B / S10)', () => {
  const r = evaluate({ signs: ['severe_headache', 'swelling_face_hands'], weeks: 34 });
  assert.equal(r.level, 'see_today');
  assert.match(r.rule, /^pair:/);
});

test('bleeding alone → see today', () => {
  assert.equal(evaluate({ signs: ['bleeding'], weeks: 12 }).level, 'see_today');
});

test('convulsions → emergency', () => {
  assert.equal(evaluate({ signs: ['convulsions'] }).level, 'emergency');
});

test('baby yellow skin day 5 → see today (Flow C)', () => {
  assert.equal(evaluate({ signs: ['baby_yellow_skin'], daysAfterBirth: 5 }).level, 'see_today');
});

test('low mood alone → watch, not a referral', () => {
  assert.equal(evaluate({ signs: ['very_low_mood'], daysAfterBirth: 5 }).level, 'watch');
});

test('unknown signs are ignored', () => {
  assert.equal(evaluate({ signs: ['made_up'] }).level, 'none');
});

test('the model can raise a level but never lower it', () => {
  assert.equal(escalate('see_today', 'none'), 'see_today');
  assert.equal(escalate('none', 'see_today'), 'see_today');
  assert.equal(escalate('see_today', 'emergency'), 'emergency');
  assert.equal(escalate('emergency', 'watch'), 'emergency');
  assert.equal(escalate('see_today', 'bogus'), 'see_today');
});

test('talk state: tapped danger signs reach the rules without the model', () => {
  const s = createTalkState(getPersona('sunita'));
  const { card } = handleTool(s, 'ask_multi_choice', {
    question: 'Any of these today?',
    options: [
      { label: 'Headache that won’t go', sign: 'severe_headache' },
      { label: 'Swelling of face or hands', sign: 'swelling_face_hands' },
    ],
  });
  const r = recordAnswer(s, card, ['Headache that won’t go', 'Swelling of face or hands']);
  assert.equal(r.level, 'see_today');
  // add_referral with a lower level changes nothing
  handleTool(s, 'add_referral', { level: 'watch', reason: 'test' });
  assert.equal(referral(s).level, 'see_today');
});

test('talk state: add_referral raises', () => {
  const s = createTalkState(getPersona('sunita'));
  handleTool(s, 'add_referral', { level: 'see_today', reason: 'BP trend rising' });
  const r = referral(s);
  assert.equal(r.level, 'see_today');
  assert.equal(r.raisedByModel, true);
});

test('stop-medicine phrases are flagged, safe phrases are not', () => {
  assert.equal(mentionsStoppingMedicine('You can stop the iron tablets for now.'), true);
  assert.equal(mentionsStoppingMedicine('Don’t stop the tablet — take it at night.'), false);
  assert.equal(mentionsStoppingMedicine("Don't stop the tablet, take it after food."), false);
  assert.equal(mentionsStoppingMedicine('गोली बंद कर दो'), true);
  assert.equal(mentionsStoppingMedicine('गोली बंद मत करना'), false);
});

test('live config is plain JSON with all tools', () => {
  const cfg = buildLiveConfig({ persona: getPersona('reena'), lang: 'hi' });
  const json = JSON.parse(JSON.stringify(cfg));
  const names = json.tools[0].functionDeclarations.map((f) => f.name);
  for (const n of ['ask_yes_no', 'ask_single_choice', 'ask_multi_choice', 'ask_photo', 'record_symptom', 'red_flag_check']) {
    assert.ok(names.includes(n), n);
  }
  assert.match(json.systemInstruction, /Reena/);
  assert.match(json.systemInstruction, /Never tell her to stop/);
});
