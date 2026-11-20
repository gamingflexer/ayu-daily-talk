import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTellState, handleTellTool, recordedSigns, signsFor, appendHeard, resumeText } from '../shared/talk-state.js';
import { buildTellConfig, tellPrompt, openingNudge, STOP_NUDGE } from '../shared/live-config.js';

const pregnant = () => createTellState({ stage: 'pregnant' });

test('record_symptom: one entry per sign, in the order Ayu first noted it', () => {
  const s = pregnant();
  handleTellTool(s, 'record_symptom', { sign: 'severe_headache', her_words: 'sir mein dard' });
  handleTellTool(s, 'record_symptom', { sign: 'swelling_feet', her_words: 'pair suje hain' });
  const again = handleTellTool(s, 'record_symptom', { sign: 'severe_headache', her_words: 'sir dard subah se', since: 'since morning', severity: 'severe' });
  assert.equal(again.response.already_noted, true);
  assert.deepEqual(recordedSigns(s), ['severe_headache', 'swelling_feet']);
  assert.equal(s.symptoms[0].her_words, 'sir dard subah se');
  assert.equal(s.symptoms[0].since, 'since morning');
  assert.equal(s.symptoms[0].severity, 'severe');
});

test('record_symptom: the response never carries a level (the model does not decide one)', () => {
  const s = pregnant();
  const out = handleTellTool(s, 'record_symptom', { sign: 'bleeding', her_words: 'thoda khoon' });
  assert.deepEqual(Object.keys(out.response).sort(), ['saved']);
  assert.doesNotMatch(JSON.stringify(out.response), /level|see_today|emergency/);
});

test('a sign is recorded only by a tool call — never from her words or something she denied', () => {
  const s = pregnant();
  let heard = '';
  heard = appendHeard(heard, 'No bleeding, ', true);
  heard = appendHeard(heard, 'just my head hurts.');
  assert.equal(heard, 'No bleeding, just my head hurts.');
  assert.deepEqual(recordedSigns(s), []);
  handleTellTool(s, 'record_symptom', { sign: 'severe_headache', her_words: 'my head hurts' });
  assert.deepEqual(recordedSigns(s), ['severe_headache']);
  assert.ok(!recordedSigns(s).includes('bleeding'));
  // and the prompt tells the model the same
  assert.match(tellPrompt({ profile: { stage: 'pregnant' } }), /Never record something she says she does NOT have/);
});

test('unknown or other-stage signs become "other" (her words kept); "other" needs words', () => {
  const s = pregnant();
  handleTellTool(s, 'record_symptom', { sign: 'baby_yellow_skin', her_words: 'yellow eyes' });
  handleTellTool(s, 'record_symptom', { sign: 'made_up', her_words: 'itchy palms' });
  handleTellTool(s, 'record_symptom', { sign: 'other', her_words: 'Itchy palms' });
  assert.equal(handleTellTool(s, 'record_symptom', { sign: 'other' }).response.saved, false);
  assert.deepEqual(s.symptoms.map((x) => x.sign), ['other', 'other']);
  assert.deepEqual(recordedSigns(s), []);
  // after birth the newborn signs apply
  const p = createTellState({ stage: 'postnatal' });
  handleTellTool(p, 'record_symptom', { sign: 'baby_yellow_skin', her_words: 'baby is yellow' });
  assert.deepEqual(recordedSigns(p), ['baby_yellow_skin']);
});

test('sizes and enums are clamped', () => {
  const s = pregnant();
  handleTellTool(s, 'record_symptom', { sign: 'fever', her_words: 'x'.repeat(900), since: 'y'.repeat(200), severity: 'apocalyptic' });
  assert.equal(s.symptoms[0].her_words.length, 200);
  assert.equal(s.symptoms[0].since.length, 60);
  assert.equal(s.symptoms[0].severity, undefined);
});

test('finish_talk ends recording; unknown tools answer with an error', () => {
  const s = pregnant();
  assert.equal(handleTellTool(s, 'finish_talk', {}).finish, true);
  assert.equal(handleTellTool(s, 'record_symptom', { sign: 'fever', her_words: 'late' }).response.saved, false);
  assert.ok(handleTellTool(s, 'ask_yes_no', {}).response.error);
  assert.ok(handleTellTool(s, 'drop_table', null).response.error);
});

test('the tell config has only record_symptom and finish_talk, with a stage-limited sign list', () => {
  const cfg = JSON.parse(JSON.stringify(buildTellConfig({ profile: { name: 'Reena', stage: 'pregnant', weeks: 34 }, lang: 'hi' })));
  const decl = cfg.tools[0].functionDeclarations;
  assert.deepEqual(decl.map((d) => d.name), ['record_symptom', 'finish_talk']);
  const signs = decl[0].parameters.properties.sign.enum;
  assert.ok(signs.includes('reduced_fetal_movement') && signs.includes('other'));
  assert.ok(!signs.includes('baby_yellow_skin') && !signs.includes('heavy_bleeding'));
  assert.deepEqual(signsFor('postnatal').filter((x) => x.startsWith('baby_')).length > 0, true);
  assert.equal(cfg.inputAudioTranscription && cfg.outputAudioTranscription ? true : false, true);
});

test('prompt: greets by name in her language, talks with her, never decides a level, keeps the Never rules', () => {
  const p = tellPrompt({ profile: { name: 'Reena', stage: 'pregnant', weeks: 34 }, lang: 'hi' });
  assert.match(p, /Name: Reena/);
  assert.match(p, /She chose Hindi in the app. Speak Hindi/);
  assert.match(p, /in Devanagari script/);
  assert.match(p, /ONE short sentence/);
  assert.match(p, /real back-and-forth conversation/);
  assert.match(p, /one at a time/);
  assert.match(p, /Do not end the talk while she is still telling you things/);
  assert.match(p, /Never say whether it is serious/);
  assert.match(p, /Never diagnose/);
  assert.match(p, /Never tell her to take, stop or change any medicine/);
  assert.match(p, /No disclaimers/);
  assert.match(p, /point the camera away/);
  assert.doesNotMatch(p, /ask_yes_no|red_flag_check|update_plan|card/);
  assert.match(openingNudge('hi'), /in Hindi/);
  assert.match(STOP_NUDGE, /record_symptom/);
  assert.match(STOP_NUDGE, /finish_talk/);
});

test('appendHeard: a new turn of hers starts after a space; whitespace is tidied', () => {
  let h = appendHeard('', '  My head', true);
  h = appendHeard(h, ' hurts.');
  h = appendHeard(h, 'Since morning.', true);
  assert.equal(h, 'My head hurts. Since morning.');
  assert.equal(appendHeard(h, ''), h);
});

test('resumeText lists what was noted and does not greet again', () => {
  const s = pregnant();
  handleTellTool(s, 'record_symptom', { sign: 'fever', her_words: 'bukhar' });
  const t = resumeText(s, 'I have bukhar');
  assert.match(t, /Do not greet her again/);
  assert.match(t, /fever \("bukhar"\)/);
  assert.match(t, /I have bukhar/);
});
