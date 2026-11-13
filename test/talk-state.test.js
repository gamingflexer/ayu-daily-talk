import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTalkState,
  handleTool,
  recordAnswer,
  referral,
  snapshotTalk,
  restoreTalkState,
  notedFromTalk,
  cameraPurposeFor,
  cameraTurnText,
  answerText,
} from '../shared/talk-state.js';
import { getPersona } from '../shared/personas.js';
import { buildLiveConfig, openingNudge } from '../shared/live-config.js';

const sunita = getPersona('sunita');
const anita = getPersona('anita');

test('card tools return a card and a silent-able response', () => {
  const s = createTalkState(sunita);
  for (const [name, args, kind] of [
    ['ask_yes_no', { question: 'Swollen feet?', sign: 'swelling_feet' }, 'yes_no'],
    ['ask_single_choice', { question: 'Which?', options: ['a', 'b', 'c', 'd', 'e'] }, 'single'],
    ['ask_multi_choice', { question: 'Any?', options: [{ label: 'x', sign: 'fever' }, 'y'] }, 'multi'],
    ['ask_photo', { purpose: 'feet', instruction: 'Show feet' }, 'photo'],
  ]) {
    const out = handleTool(s, name, args);
    assert.equal(out.card.kind, kind);
    assert.equal(out.response.shown, true);
    assert.equal(out.response.card_id, out.card.id);
  }
});

test('ask_yes_no: "Not sure" is a camera button by default; bad picture sets are dropped', () => {
  const s = createTalkState(sunita);
  assert.equal(handleTool(s, 'ask_yes_no', { question: 'q' }).card.notSure, 'camera');
  assert.equal(handleTool(s, 'ask_yes_no', { question: 'q', not_sure_action: 'none' }).card.notSure, 'none');
  assert.equal(handleTool(s, 'ask_yes_no', { question: 'q', picture_set: 'faces' }).card.pictureSet, undefined);
});

test('single choice keeps at most 4 options; ask_photo refuses other purposes', () => {
  const s = createTalkState(sunita);
  assert.equal(handleTool(s, 'ask_single_choice', { question: 'q', options: ['1', '2', '3', '4', '5'] }).card.options.length, 4);
  assert.equal(handleTool(s, 'ask_photo', { purpose: 'face', instruction: 'x' }).card.purpose, 'medicine_strip');
});

test('yes on a yes/no card with a sign reaches the rules', () => {
  const s = createTalkState(getPersona('reena'));
  const a = handleTool(s, 'ask_yes_no', { question: 'Headache?', sign: 'severe_headache' }).card;
  const b = handleTool(s, 'ask_yes_no', { question: 'Face swelling?', sign: 'swelling_face_hands' }).card;
  recordAnswer(s, a, 'yes');
  assert.equal(recordAnswer(s, b, 'yes').level, 'see_today');
});

test('picture answers set signs: very yellow baby → see today; normal tile → nothing', () => {
  const s = createTalkState(anita);
  const card = handleTool(s, 'ask_single_choice', { question: 'Which?', picture_set: 'baby_skin_colour' }).card;
  assert.equal(recordAnswer(s, card, 'Not yellow', { picture: 'normal' }).level, 'none');
  assert.equal(recordAnswer(s, card, 'Very yellow', { picture: 'deep' }).level, 'see_today');
  assert.ok(s.signs.has('baby_yellow_skin'));
});

test('pale stool picture → see today', () => {
  const s = createTalkState(anita);
  const card = handleTool(s, 'ask_single_choice', { question: 'Stool?', picture_set: 'stool_colour' }).card;
  assert.equal(recordAnswer(s, card, 'Pale', { picture: 'pale' }).level, 'see_today');
});

test('record_symptom with a sign runs the rules and returns the referral', () => {
  const s = createTalkState(sunita);
  const out = handleTool(s, 'record_symptom', { sign: 'bleeding', her_words: 'thoda khoon' });
  assert.equal(out.referral.level, 'see_today');
  assert.equal(s.symptoms[0].her_words, 'thoda khoon');
});

test('red_flag_check: extra_signs count; the response tells the model to follow the rules', () => {
  const s = createTalkState(sunita);
  const out = handleTool(s, 'red_flag_check', { extra_signs: ['convulsions'] });
  assert.equal(out.response.level, 'emergency');
  assert.equal(out.response.decided_by, 'fixed_rules');
  assert.match(out.response.instruction, /108/);
});

test('add_referral ignores unknown levels and never lowers', () => {
  const s = createTalkState(sunita);
  handleTool(s, 'add_referral', { level: 'see_today', reason: 'BP rising' });
  handleTool(s, 'add_referral', { level: 'none', reason: 'changed my mind' });
  handleTool(s, 'add_referral', { level: 'banana', reason: 'x' });
  assert.equal(referral(s).level, 'see_today');
  assert.equal(referral(s).raisedByModel, true);
});

test('update_plan saves known items only', () => {
  const s = createTalkState(sunita);
  const ok = handleTool(s, 'update_plan', { item: 'documents_bag', value: 'MCP card, clothes', ready: true });
  assert.equal(ok.plan.documents_bag.ready, true);
  assert.equal(ok.response.ready_items_this_talk, 1);
  const bad = handleTool(s, 'update_plan', { item: 'aadhaar_number', value: '1234', ready: true });
  assert.ok(bad.response.error);
  assert.equal(s.plan.aadhaar_number, undefined);
});

test('finish_talk carries the referral; unknown tools answer with an error', () => {
  const s = createTalkState(sunita);
  const card = handleTool(s, 'ask_multi_choice', {
    question: 'Any?',
    options: [
      { label: 'H', sign: 'severe_headache' },
      { label: 'S', sign: 'swelling_face_hands' },
    ],
  }).card;
  recordAnswer(s, card, ['H', 'S']);
  const out = handleTool(s, 'finish_talk', { noted: ['Headache'], questions_for_doctor: ['BP?'] });
  assert.equal(out.finish.referral.level, 'see_today');
  assert.deepEqual(out.finish.questionsForDoctor, ['BP?']);
  assert.ok(handleTool(s, 'drop_table', {}).response.error);
});

test('snapshot → JSON → restore keeps signs, answers and a model raise', () => {
  const s = createTalkState(sunita);
  const card = handleTool(s, 'ask_yes_no', { question: 'Bleeding?', sign: 'bleeding' }).card;
  recordAnswer(s, card, 'yes');
  handleTool(s, 'add_referral', { level: 'emergency', reason: 'heavy' });
  const snap = JSON.parse(JSON.stringify(snapshotTalk(s, { partial: true })));
  assert.equal(snap.partial, true);
  const r = restoreTalkState(sunita, snap);
  assert.ok(r.signs.has('bleeding'));
  assert.equal(r.answers.length, 1);
  assert.equal(referral(r).level, 'emergency');
  // another persona's snapshot is ignored
  assert.equal(restoreTalkState(anita, snap).answers.length, 0);
});

test('notedFromTalk: model lines first, else built from answers', () => {
  assert.deepEqual(notedFromTalk({ noted: ['Slept well'] }), ['done|Slept well']);
  const lines = notedFromTalk(
    {
      noted: [],
      symptoms: [{ her_words: 'पेट में दर्द', since: 'sometimes' }],
      answers: [
        { kind: 'yes_no', question: 'Swollen feet?', answer: 'no' },
        { kind: 'yes_no', question: 'Yellow?', answer: 'not_sure', via: 'camera' },
        { kind: 'multi', question: 'Any?', answer: [] },
      ],
    },
    { no: 'नहीं', notSure: 'पक्का नहीं', none: 'कुछ नहीं', camera: 'कैमरे पर' },
  );
  assert.deepEqual(lines, ['warn|“पेट में दर्द” · sometimes', 'done|Swollen feet? — नहीं', 'warn|Yellow? — पक्का नहीं (कैमरे पर)', 'done|Any? — कुछ नहीं']);
});

test('camera turn: purpose never asks for a face; the cue keeps the photo rules', () => {
  assert.equal(cameraPurposeFor({ pictureSet: 'feet_swelling' }), 'feet');
  assert.equal(cameraPurposeFor({ pictureSet: 'baby_skin_colour' }), 'skin_patch');
  assert.equal(cameraPurposeFor({ sign: 'bleeding' }), 'medicine_strip');
  const cue = cameraTurnText({ question: 'Feet swollen?' }, 'feet');
  assert.match(cue, /feet and ankles/);
  assert.match(cue, /without naming a disease/);
  assert.match(cue, /face or a private body part/);
  assert.match(answerText({ question: 'Q', pictureSet: 'feet_swelling' }, 'yes', {}, { picture: 'pitting' }), /pitting/);
});

test('Hindi: prompt tells the model to speak Hindi and write cards in Hindi; opening nudge too', () => {
  const cfg = buildLiveConfig({ persona: getPersona('reena'), lang: 'hi' });
  assert.match(cfg.systemInstruction, /She chose Hindi in the app. Speak Hindi/);
  assert.match(cfg.systemInstruction, /in Devanagari script/);
  assert.match(cfg.systemInstruction, /Open questions .* have NO card/);
  assert.match(cfg.systemInstruction, /Write every card's question and options in the language you are speaking/);
  assert.match(openingNudge('hi'), /in Hindi/);
  const names = cfg.tools[0].functionDeclarations.map((f) => f.name);
  assert.ok(names.includes('update_plan'));
});
