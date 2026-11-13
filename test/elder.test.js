import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../shared/red-flags.js';
import { createTalkState, handleTool, recordAnswer, referral } from '../shared/talk-state.js';
import { getPersona, personaContext } from '../shared/personas.js';
import { buildLiveConfig } from '../shared/live-config.js';

const shanti = getPersona('shanti');

const stomachCard = (s) =>
  handleTool(s, 'ask_single_choice', {
    question: 'How is your stomach since the new tablet?',
    picture_set: 'stomach_upset',
    options: ['A little upset, loose motion', 'Vomiting, can’t keep food down', 'No problem'],
  }).card;

test('grandma on metformin: a little stomach upset → all fine', () => {
  const s = createTalkState(shanti);
  const r = recordAnswer(s, stomachCard(s), 'A little upset, loose motion', { picture: 'upset' });
  assert.equal(r.level, 'none');
  handleTool(s, 'record_symptom', { sign: 'other', her_words: 'thoda pet kharab', severity: 'mild' });
  assert.equal(referral(s).level, 'none');
});

test('grandma on metformin: vomiting / can’t keep food down → see today', () => {
  const s = createTalkState(shanti);
  const r = recordAnswer(s, stomachCard(s), 'Vomiting, can’t keep food down', { picture: 'vomiting' });
  assert.equal(r.level, 'see_today');
  assert.equal(r.rule, 'alone:vomiting_no_food');
});

test('grandma: dehydration → see today; severe belly pain → see today', () => {
  const s = createTalkState(shanti);
  const c = handleTool(s, 'ask_yes_no', { question: 'Very thirsty or dizzy?', sign: 'dehydration' }).card;
  assert.equal(recordAnswer(s, c, 'yes').level, 'see_today');
  const p = createTalkState(shanti);
  const sev = handleTool(p, 'ask_severity', { question: 'How bad is the belly pain?', sign: 'severe_abdominal_pain' }).card;
  assert.equal(recordAnswer(p, sev, 'severe').level, 'see_today');
  assert.equal(evaluate({ signs: ['severe_abdominal_pain'], stage: 'elder' }).level, 'see_today');
});

test('pregnancy rules never fire for someone who is not pregnant', () => {
  assert.equal(evaluate({ signs: ['swelling_feet'], stage: 'elder' }).level, 'none');
  assert.equal(evaluate({ signs: ['severe_headache', 'swelling_feet'], stage: 'elder' }).level, 'none');
  assert.equal(evaluate({ signs: ['reduced_fetal_movement', 'fluid_leak'], stage: 'elder' }).level, 'none');
  assert.equal(evaluate({ signs: ['baby_yellow_skin'], stage: 'elder', daysAfterBirth: 0 }).level, 'none');
  // Body map lower belly is a pregnancy sign only
  const s = createTalkState(shanti);
  const map = handleTool(s, 'ask_body_map', { question: 'Where?' }).card;
  assert.equal(recordAnswer(s, map, 'lower_belly_left').level, 'none');
  // Danger signs for anyone still apply
  assert.equal(evaluate({ signs: ['convulsions'], stage: 'elder' }).level, 'emergency');
  assert.equal(evaluate({ signs: ['fever'], stage: 'elder' }).level, 'see_today');
});

test('pregnant week 34: puffy feet + headache → see a doctor today (Flow B)', () => {
  const s = createTalkState(getPersona('reena'));
  const feet = handleTool(s, 'ask_yes_no', { question: 'Do your feet or face look like this today?', picture_set: 'feet_swelling', sign: 'swelling_feet' }).card;
  assert.equal(recordAnswer(s, feet, 'yes', { picture: 'puffy' }).level, 'watch');
  const head = handleTool(s, 'ask_yes_no', { question: 'Headache that won’t go?', sign: 'severe_headache' }).card;
  const r = recordAnswer(s, head, 'yes');
  assert.equal(r.level, 'see_today');
  assert.match(r.rule, /pair:severe_headache\+swelling_feet:after20w/);
});

test('the prompt knows the new medicine and never says stop', () => {
  const ctx = personaContext(shanti);
  assert.match(ctx, /NEW medicine: Metformin 500 mg, started 5 days ago/);
  assert.match(ctx, /Not pregnant/);
  assert.match(ctx, /Never tell her to stop the tablet/);
  const cfg = buildLiveConfig({ persona: shanti, lang: 'hi' });
  assert.match(cfg.systemInstruction, /older people on daily medicines/);
  const yesNo = cfg.tools[0].functionDeclarations.find((f) => f.name === 'ask_single_choice');
  assert.ok(yesNo.parameters.properties.picture_set.enum.includes('stomach_upset'));
});

test('demo personas: the opening goes straight to the focus question with a card', async () => {
  const { openingNudge } = await import('../shared/live-config.js');
  const { PERSONAS } = await import('../shared/personas.js');
  const list = Array.isArray(PERSONAS) ? PERSONAS : Object.values(PERSONAS);
  const grandma = list.find((p) => (p.medicines || []).some((m) => m.isNew));
  assert.match(openingNudge('en', grandma), /focus question/);
  assert.match(openingNudge('en', null), /voice only: no card/);
});
