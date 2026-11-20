import test from 'node:test';
import assert from 'node:assert/strict';
import { assess, optionLevel } from '../shared/triage.js';
import { BUILTIN_SETS, UNSURE, setFor, sanitizeDraft, builtinFor } from '../shared/question-sets.js';
import { evaluate, SIGNS, LEVELS, levelIndex } from '../shared/red-flags.js';

const preg = BUILTIN_SETS.pregnancy;
const post = BUILTIN_SETS.postnatal;
const ctx = { stage: 'pregnant', weeks: 34 };
const fine = { swell: 'none', head: 'none', baby: 'usual', bleed: 'none', body: 'fine' };

test('all calm answers → none, no reasons', () => {
  const r = assess({ set: preg, answers: fine, ...ctx });
  assert.equal(r.level, 'none');
  assert.deepEqual(r.items, []);
});

test('a floor raises what the fixed rules say, and names the rule', () => {
  // The fixed rules alone leave a lone severe headache at none; Vrindar's set asks for a doctor today.
  assert.equal(evaluate({ signs: ['severe_headache'], ...ctx }).level, 'none');
  const r = assess({ set: preg, answers: { ...fine, head: 'stays' }, ...ctx });
  assert.equal(r.level, 'see_today');
  assert.equal(r.rule, 'set:floor');
  assert.deepEqual(r.signs, ['severe_headache']);
});

test('the fixed rules are never lowered by a set', () => {
  // "Feet a little swollen" has no floor in the set, but the rule says watch.
  const r = assess({ set: preg, answers: { ...fine, swell: 'feet' }, ...ctx });
  assert.equal(r.level, 'watch');
  assert.equal(r.rule, 'watch:swelling_feet');
  // A set that tries to mark a danger sign as fine still gets the rule's level.
  const lax = { questions: [{ id: 'q1', options: [{ id: 'o1', sign: 'bleeding', floor: 'none' }] }] };
  assert.equal(assess({ set: lax, answers: { q1: 'o1' }, ...ctx }).level, 'see_today');
  assert.equal(optionLevel({ sign: 'convulsions', floor: 'none' }, ctx), 'emergency');
});

test('every answer in the built-in sets ends at or above the rule level for its sign', () => {
  for (const set of [preg, post]) {
    const stage = set.stage;
    for (const q of set.questions) {
      for (const o of q.options) {
        const r = assess({ set, answers: { [q.id]: o.id }, stage, weeks: 34, daysAfterBirth: 5 });
        if (o.sign) {
          assert.ok(o.sign in SIGNS, `${set.id}.${q.id}.${o.id}: unknown sign ${o.sign}`);
          const rule = evaluate({ signs: [o.sign], stage, weeks: 34, daysAfterBirth: 5 }).level;
          assert.ok(levelIndex(r.level) >= levelIndex(rule), `${set.id}.${q.id}.${o.id} is below its rule`);
        }
        assert.ok(LEVELS.includes(r.level));
      }
    }
  }
});

test('swelling with a headache or blurry vision → emergency (the set combo)', () => {
  for (const [swell, head] of [['face', 'stays'], ['face', 'vision'], ['dent', 'stays'], ['dent', 'vision']]) {
    const r = assess({ set: preg, answers: { ...fine, swell, head }, ...ctx });
    assert.equal(r.level, 'emergency', `${swell}+${head}`);
    assert.equal(r.combo, true);
    assert.equal(r.rule, 'set:combo');
  }
  // Mild feet swelling with a headache that won't go: the fixed pair rule (see today), not the combo.
  const r = assess({ set: preg, answers: { ...fine, swell: 'feet', head: 'stays' }, ...ctx });
  assert.equal(r.level, 'see_today');
  assert.equal(r.combo, false);
});

test('"Not sure" is never treated as "no"', () => {
  const r = assess({ set: preg, answers: { ...fine, baby: UNSURE }, ...ctx });
  assert.equal(r.level, 'watch');
  assert.deepEqual(r.items.map((x) => x.code), ['baby:unsure']);
});

test('reasons are the answers that raised the level, most serious first', () => {
  const r = assess({ set: preg, answers: { ...fine, swell: 'dent', bleed: 'heavy', body: 'fever' }, ...ctx });
  assert.equal(r.level, 'emergency');
  assert.deepEqual(r.items.map((x) => x.code), ['bleed:heavy', 'body:fever', 'swell:dent']);
});

test('Tell Ayu signs go through the same rules, by stage', () => {
  assert.equal(assess({ set: null, extraSigns: ['bleeding'], ...ctx }).level, 'see_today');
  assert.equal(assess({ set: null, extraSigns: ['convulsions'], ...ctx }).level, 'emergency');
  // Something she said is never "all fine": a headache that won't go → doctor today, low mood → ASHA.
  assert.equal(assess({ set: null, extraSigns: ['severe_headache'], ...ctx }).level, 'see_today');
  assert.equal(assess({ set: null, extraSigns: ['very_low_mood'], stage: 'postnatal', daysAfterBirth: 3 }).level, 'watch');
  assert.equal(assess({ set: null, extraSigns: ['lower_belly_pain'], ...ctx }).level, 'watch');
  // Newborn signs do not apply to a pregnant woman.
  const nb = assess({ set: null, extraSigns: ['baby_yellow_skin'], ...ctx });
  assert.equal(nb.level, 'none');
  assert.deepEqual(nb.items, []);
  assert.equal(assess({ set: null, extraSigns: ['baby_yellow_skin'], stage: 'postnatal', daysAfterBirth: 3 }).level, 'see_today');
});

test('BP readings use the fixed measurement rules (140/90 fires, 130/80 does not)', () => {
  const bp = (sys, dia, source = 'asha') => [{ key: 'systolic_bp', value: sys, source }, { key: 'diastolic_bp', value: dia, source }];
  assert.equal(assess({ set: null, measurements: bp(130, 80), ...ctx }).level, 'none');
  const high = assess({ set: null, measurements: bp(152, 100), ...ctx });
  assert.equal(high.level, 'see_today');
  assert.deepEqual(high.items.map((x) => x.code), ['m:bp_high']);
  assert.equal(assess({ set: null, measurements: bp(164, 100), ...ctx }).level, 'emergency');
});

test('postnatal: clots or a soaked pad → emergency; low mood → watch', () => {
  const ok = { pbleed: 'less', pfever: 'none', feed: 'well', skin: 'normal', mood: 'fine' };
  const p = { stage: 'postnatal', daysAfterBirth: 9 };
  assert.equal(assess({ set: post, answers: ok, ...p }).level, 'none');
  assert.equal(assess({ set: post, answers: { ...ok, pbleed: 'soaked' }, ...p }).level, 'emergency');
  assert.equal(assess({ set: post, answers: { ...ok, mood: 'low' }, ...p }).level, 'watch');
  assert.equal(assess({ set: post, answers: { ...ok, pbleed: 'period', pfever: 'fever' }, ...p }).level, 'see_today');
  assert.equal(assess({ set: post, answers: { ...ok, skin: 'light' }, stage: 'postnatal', daysAfterBirth: 0 }).level, 'emergency');
});

test('setFor: built-in by stage until an ASHA approves and sends a set', () => {
  const w = { id: 'w1', stage: 'postnatal' };
  assert.equal(setFor(w, {}).id, 'postnatal');
  assert.equal(builtinFor('pregnant').id, 'pregnancy');
  const q = [{ id: 'q1', options: [{ id: 'o1' }, { id: 'o2' }] }];
  const sets = {
    a: { id: 'a', status: 'draft', assignedTo: ['w1'], questions: q },
    b: { id: 'b', status: 'approved', approvedAt: 1, assignedTo: ['w1'], questions: q },
    c: { id: 'c', status: 'approved', approvedAt: 2, assignedTo: ['w1'], questions: q },
    d: { id: 'd', status: 'approved', approvedAt: 3, assignedTo: ['w2'], questions: q },
  };
  assert.equal(setFor(w, sets).id, 'c');
});

test('sanitizeDraft: caps sizes, keeps only known levels and signs, never pre-checked or approved', () => {
  const d = sanitizeDraft({
    title: { en: 'New mother · first 6 weeks', mr: 'नवीन आई' },
    stage: 'postnatal',
    status: 'approved',
    assignedTo: ['w1'],
    questions: [
      { text: { en: 'How much are you bleeding today?' }, checked: true, options: [{ text: { en: 'Less than a period' }, level: 'none' }, { text: { en: 'A pad soaked in an hour' }, level: 'emergency', sign: 'heavy_bleeding' }, { text: { en: 'x' }, level: 'made_up', sign: 'not_a_sign' }] },
      { text: 'Any fever?', options: [{ label: 'No' }, { label: 'Yes', level: 'see_today', sign: 'fever' }] },
      { text: { en: 'only one option' }, options: [{ text: { en: 'a' } }] },
      { text: { hi: 'no english' }, options: [{ text: { en: 'a' } }, { text: { en: 'b' } }] },
    ],
  }, { id: 'set_x', now: 5 });
  assert.equal(d.id, 'set_x');
  assert.equal(d.status, 'draft');
  assert.deepEqual(d.assignedTo, []);
  assert.equal(d.stage, 'postnatal');
  assert.equal(d.questions.length, 2);
  assert.equal(d.questions[0].checked, false);
  assert.deepEqual(d.questions[0].options.map((o) => [o.floor, o.sign]), [['none', undefined], ['emergency', 'heavy_bleeding'], ['none', undefined]]);
  assert.deepEqual(d.questions[1].text, { en: 'Any fever?' });
  assert.equal(sanitizeDraft({ title: 'x', questions: [] }), null);
  assert.equal(sanitizeDraft(null), null);
  assert.equal(sanitizeDraft({ title: { en: 'a'.repeat(500) }, questions: d.questions.map((q) => ({ text: q.text, options: q.options.map((o) => ({ text: o.text })) })) }).title.en.length, 60);
});
