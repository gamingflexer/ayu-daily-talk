import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDoctorSummary } from '../shared/doctor-summary.js';
import { createTalkState, handleTool, recordAnswer, snapshotTalk } from '../shared/talk-state.js';
import { getPersona } from '../shared/personas.js';

function sunitaTalk() {
  const p = getPersona('sunita');
  const s = createTalkState(p);
  handleTool(s, 'record_symptom', { sign: 'severe_headache', her_words: 'सिर में दर्द है सुबह से', since: 'since morning', severity: 'moderate' });
  const feet = handleTool(s, 'ask_single_choice', { question: 'Which looks like your feet?', picture_set: 'feet_swelling' }).card;
  recordAnswer(s, feet, 'Very swollen — a dent stays', { picture: 'pitting' });
  const danger = handleTool(s, 'ask_multi_choice', { question: 'Any of these today?', options: [{ label: 'Swelling of face or hands', sign: 'swelling_face_hands' }] }).card;
  recordAnswer(s, danger, ['Swelling of face or hands']);
  handleTool(s, 'update_plan', { item: 'documents_bag', value: 'MCP card, clothes', ready: true });
  s.photos.push({ purpose: 'feet', kind: 'video', at: 1 });
  handleTool(s, 'finish_talk', { questions_for_doctor: ['Is my BP okay?'] });
  const snap = snapshotTalk(s);
  snap.at = Date.UTC(2026, 10, 13, 9, 30);
  return { p, snap };
}

test('summary leads with the fixed-rule result and the danger signs', () => {
  const { p, snap } = sunitaTalk();
  const sum = buildDoctorSummary({ persona: p, talk: snap });
  assert.equal(sum.title, 'Sunita, 26 · 24 weeks');
  assert.equal(sum.sections[0].id, 'today');
  assert.match(sum.sections[0].lines[0], /^warn\|SEE TODAY/);
  assert.match(sum.sections[0].lines[1], /headache that won’t go/);
  assert.match(sum.sections[0].lines[1], /swelling of face or hands/);
});

test('her own words are kept verbatim; picture picks and camera are named', () => {
  const { p, snap } = sunitaTalk();
  const { text } = buildDoctorSummary({ persona: p, talk: snap });
  assert.match(text, /“सिर में दर्द है सुबह से” \(since morning, moderate\)/);
  assert.match(text, /picked picture: A dent stays when pressed/);
  assert.match(text, /Showed on camera: feet \(not stored\)/);
  assert.match(text, /Bag and documents: MCP card, clothes/);
  assert.match(text, /Is my BP okay\?/);
});

test('record background: BP trend, Hb, adherence; no diagnosis words', () => {
  const { p, snap } = sunitaTalk();
  const { text, lines } = buildDoctorSummary({ persona: p, talk: snap });
  assert.match(text, /BP 118\/76 \(3 wk ago\) → 138\/92 \(today\)/);
  assert.match(text, /Hb 9\.8 g\/dL at week 20/);
  assert.match(text, /Calcium: taken 4\/7 days — stopped 3 days/);
  assert.doesNotMatch(text, /pre-?eclampsia|diagnos(is|ed) of/i);
  assert.match(text, /Not a diagnosis/);
  assert.ok(lines.length <= 14, '2-minute read');
});

test('deterministic: the same talk gives the same text', () => {
  const { p, snap } = sunitaTalk();
  assert.equal(buildDoctorSummary({ persona: p, talk: snap }).text, buildDoctorSummary({ persona: p, talk: JSON.parse(JSON.stringify(snap)) }).text);
});

test('no talk → record only; postnatal title', () => {
  const sum = buildDoctorSummary({ persona: getPersona('anita'), talk: null });
  assert.equal(sum.title, 'Anita, 24 · day 5 after birth');
  assert.match(sum.text, /No talk recorded yet today/);
});

test('model-raised referral is shown as raised by Ayu', () => {
  const p = getPersona('meera');
  const s = createTalkState(p);
  handleTool(s, 'add_referral', { level: 'see_today', reason: 'vomiting every day for a week' });
  const sum = buildDoctorSummary({ persona: p, talk: snapshotTalk(s) });
  assert.match(sum.text, /Ayu raised it: vomiting every day for a week/);
});

test('rule ids are shown in words', async () => {
  const { ruleText } = await import('../shared/doctor-summary.js');
  assert.equal(ruleText('pair:severe_headache+swelling_face_hands:after20w'), 'two signs together: headache that won’t go + swelling of face or hands (after 20 weeks)');
  assert.equal(ruleText('alone:bleeding'), 'bleeding or fluid on its own');
});

test('a model note that softens a see-today referral is caught', async () => {
  const { noteContradicts } = await import('../shared/doctor-summary.js');
  assert.equal(noteContradicts('see_today', 'Routine referral level. Danger signs: headache.'), true);
  assert.equal(noteContradicts('emergency', 'No urgent concern.'), true);
  assert.equal(noteContradicts('see_today', 'She reports headache and face swelling at 34 weeks; BP rose to 138/92.'), false);
  assert.equal(noteContradicts('none', 'Routine check.'), false);
});
