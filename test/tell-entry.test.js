import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tellEntry } from '../src/tell/entry.js';
import { signsFor } from '../shared/talk-state.js';

const NOW = Date.UTC(2026, 10, 20, 9);
const DAY = 86_400_000;
const pregnant = { id: 'w1', name: 'Reena', stage: 'pregnant', weeksAtStart: 34, weeksSetAt: NOW, createdAt: NOW };
const postnatal = { id: 'w2', name: 'Sunita', stage: 'postnatal', birthAt: NOW - 5 * DAY, createdAt: NOW - 5 * DAY };

test('every sign she can confirm at her stage saves at least "watch", never all fine', () => {
  for (const woman of [pregnant, postnatal]) {
    for (const s of signsFor(woman.stage)) {
      const e = tellEntry(woman, { signs: [s], transcript: 'x' }, NOW);
      assert.notEqual(e.level, 'none', `${woman.stage} ${s}`);
      assert.ok(e.items.some((i) => i.sign === s), `${woman.stage} ${s} has a reason`);
    }
  }
});

test('the quick taps from the board, by stage', () => {
  assert.equal(tellEntry(pregnant, { signs: ['very_low_mood'] }, NOW).level, 'watch');
  assert.equal(tellEntry(pregnant, { signs: ['bleeding'] }, NOW).level, 'see_today');
  assert.equal(tellEntry(postnatal, { signs: ['heavy_bleeding'] }, NOW).level, 'emergency');
});

test('the fixed rules decide: headache + puffy feet at week 34 → see today', () => {
  const e = tellEntry(pregnant, { signs: ['severe_headache', 'swelling_feet'], transcript: 'My head hurts and my feet are swollen' }, NOW);
  assert.equal(e.level, 'see_today');
  assert.equal(e.kind, 'tell');
  assert.equal(e.womanId, 'w1');
  assert.deepEqual(e.signs, ['severe_headache', 'swelling_feet']);
});

test('words alone (nothing kept) → watch with her first 80 characters', () => {
  const words = 'Something feels strange in my stomach since last night and I am worried about it, please';
  const e = tellEntry(pregnant, { transcript: words }, NOW);
  assert.equal(e.level, 'watch');
  assert.deepEqual(e.items, [{ code: 'tell:other', level: 'watch', text: words.slice(0, 80) }]);
});

test('kept "other" rows go with the signs, at least watch', () => {
  const e = tellEntry(pregnant, { signs: [], others: ['itchy palms', 'cannot sleep'], transcript: 'itchy palms, cannot sleep' }, NOW);
  assert.equal(e.level, 'watch');
  assert.deepEqual(e.items.map((i) => i.code), ['tell:other', 'tell:other:2']);
  assert.equal(tellEntry(pregnant, { signs: ['fever'], others: ['itchy palms'] }, NOW).level, 'see_today');
});

test('nothing at all → nothing to raise (the screen never offers to save this)', () => {
  const e = tellEntry(pregnant, {}, NOW);
  assert.equal(e.level, 'none');
  assert.deepEqual(e.items, []);
});
