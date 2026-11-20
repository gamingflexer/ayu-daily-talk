import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, escalate, mentionsStoppingMedicine } from '../shared/red-flags.js';

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

test('two danger signs together → see today, whoever reported them', () => {
  assert.equal(evaluate({ signs: ['severe_headache', 'swelling_face_hands'], weeks: 34, stage: 'pregnant' }).level, 'see_today');
});

test('vomiting, can’t keep food down → see today (from elder.test.js)', () => {
  const r = evaluate({ signs: ['vomiting_no_food'] });
  assert.equal(r.level, 'see_today');
  assert.equal(r.rule, 'alone:vomiting_no_food');
});

test('dehydration or severe belly pain alone → see today; fever and fits apply at any stage (from elder.test.js)', () => {
  assert.equal(evaluate({ signs: ['dehydration'] }).level, 'see_today');
  assert.equal(evaluate({ signs: ['severe_abdominal_pain'], stage: 'postnatal' }).level, 'see_today');
  assert.equal(evaluate({ signs: ['fever'], stage: 'pregnant' }).level, 'see_today');
  assert.equal(evaluate({ signs: ['convulsions'], stage: 'postnatal' }).level, 'emergency');
});

test('week 34: puffy feet alone → watch; with a headache that won’t go → see today, the after-20-weeks pair', () => {
  assert.equal(evaluate({ signs: ['swelling_feet'], weeks: 34, stage: 'pregnant' }).level, 'watch');
  const r = evaluate({ signs: ['swelling_feet', 'severe_headache'], weeks: 34, stage: 'pregnant' });
  assert.equal(r.level, 'see_today');
  assert.ok(r.reasons.includes('severe_headache+swelling_feet'));
});

test('stage limits the rules: newborn signs do not apply in pregnancy', () => {
  assert.equal(evaluate({ signs: ['baby_yellow_skin'], stage: 'pregnant' }).level, 'none');
  assert.equal(evaluate({ signs: ['baby_yellow_skin'], stage: 'postnatal', daysAfterBirth: 5 }).level, 'see_today');
});

test('stop-medicine phrases are flagged, safe phrases are not', () => {
  assert.equal(mentionsStoppingMedicine('You can stop the iron tablets for now.'), true);
  assert.equal(mentionsStoppingMedicine('Don’t stop the tablet — take it at night.'), false);
  assert.equal(mentionsStoppingMedicine("Don't stop the tablet, take it after food."), false);
  assert.equal(mentionsStoppingMedicine('गोली बंद कर दो'), true);
  assert.equal(mentionsStoppingMedicine('गोली बंद मत करना'), false);
});
