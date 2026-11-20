import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY, dayKey, weeksNow, daysAfterBirth, today, lastDays, trend, ashaToday, answerHistory, bpHistory, silentDays, initials } from '../shared/journal.js';

const NOW = new Date(2026, 10, 20, 14, 0).getTime(); // Fri 20 Nov 2026, 2 pm local
const e = (womanId, daysAgo, level, more = {}) => ({ id: `${womanId}-${daysAgo}-${level}-${more.kind || 'check'}`, womanId, at: NOW - daysAgo * DAY, kind: 'check', level, ...more });

test('week of pregnancy moves on with the calendar and stops at 42', () => {
  const w = { stage: 'pregnant', weeksAtStart: 34, weeksSetAt: NOW };
  assert.equal(weeksNow(w, NOW), 34);
  assert.equal(weeksNow(w, NOW + 6 * DAY), 34);
  assert.equal(weeksNow(w, NOW + 7 * DAY), 35);
  assert.equal(weeksNow(w, NOW + 200 * DAY), 42);
  assert.equal(weeksNow({ stage: 'postnatal' }, NOW), undefined);
});

test('days after birth', () => {
  const w = { stage: 'postnatal', birthAt: NOW - 9 * DAY };
  assert.equal(daysAfterBirth(w, NOW), 9);
  assert.equal(daysAfterBirth({ stage: 'postnatal', birthAt: NOW }, NOW), 0);
  assert.equal(daysAfterBirth({ stage: 'pregnant' }, NOW), undefined);
});

test('today: highest level of the day, whether the check is done, open Help now', () => {
  const entries = [e('a', 0, 'none'), e('a', 0, 'see_today', { kind: 'tell' }), e('a', 1, 'emergency'), e('b', 0, 'emergency', { kind: 'help' })];
  const a = today(entries, 'a', NOW);
  assert.equal(a.level, 'see_today');
  assert.equal(a.check.level, 'none');
  assert.equal(a.help, null);
  assert.equal(today(entries, 'b', NOW).help.kind, 'help');
  assert.equal(today(entries, 'nobody', NOW).any, false);
  assert.equal(today([{ ...e('b', 0, 'emergency', { kind: 'help' }), handledAt: NOW }], 'b', NOW).help, null);
});

test('last 7 days: one slot a day, null where she did nothing; trend in one word', () => {
  const entries = [e('a', 6, 'none'), e('a', 3, 'watch'), e('a', 3, 'none'), e('a', 0, 'none')];
  const days = lastDays(entries, 'a', NOW);
  assert.equal(days.length, 7);
  assert.equal(days[6].key, dayKey(NOW));
  assert.deepEqual(days.map((d) => d.level), ['none', null, null, 'watch', null, null, 'none']);
  assert.equal(trend(days), 'steady');
  assert.equal(trend(lastDays([], 'a', NOW)), 'new');
  assert.equal(trend(lastDays([e('a', 0, 'see_today')], 'a', NOW)), 'care');
  assert.equal(trend(lastDays([e('a', 0, 'watch')], 'a', NOW)), 'watch');
  assert.equal(trend(lastDays([e('a', 1, 'emergency'), e('a', 0, 'none')], 'a', NOW)), 'watch');
});

test('ASHA today: Help now first, then by level; handled entries drop to calm', () => {
  const women = [{ id: 'a', name: 'Anita' }, { id: 'b', name: 'Bina' }, { id: 'c', name: 'Chhaya' }, { id: 'd', name: 'Dipa' }];
  const entries = [e('a', 0, 'none'), e('b', 0, 'see_today'), e('c', 0, 'emergency', { kind: 'help' }), e('d', 2, 'watch')];
  const list = ashaToday(women, entries, NOW);
  assert.deepEqual(list.map((x) => x.woman.id), ['c', 'b', 'a', 'd']);
  assert.equal(list[0].help.kind, 'help');
  assert.equal(list[3].any, false);
  assert.equal(list[3].silent, 2);
  const handled = ashaToday(women, entries.map((x) => (x.womanId === 'b' ? { ...x, handledAt: NOW } : x)), NOW);
  assert.equal(handled.find((x) => x.woman.id === 'b').level, 'none');
});

test('answer history counts each answer over the window', () => {
  const entries = [0, 1, 2, 3, 20].map((d) => e('a', d, 'none', { answers: { swell: d === 0 ? 'face' : d < 3 ? 'dent' : 'feet' } }));
  const h = answerHistory(entries, 'a', 'swell', NOW, 14);
  assert.deepEqual(h.counts, { face: 1, dent: 2, feet: 1 });
  assert.deepEqual(h.rows.map((r) => r.option), ['face', 'dent', 'dent', 'feet']);
});

test('BP history newest first; silent days; initials', () => {
  const entries = [e('a', 2, 'none', { kind: 'bp', bp: { sys: 134, dia: 88 } }), e('a', 0, 'see_today', { kind: 'bp', bp: { sys: 152, dia: 100 } })];
  assert.deepEqual(bpHistory(entries, 'a').map((r) => r.sys), [152, 134]);
  assert.equal(silentDays([e('a', 3, 'none')], 'a', NOW), 3);
  assert.equal(silentDays([], 'a', NOW), null);
  assert.equal(initials('Kavita Uikey'), 'KU');
  assert.equal(initials('Rekha'), 'RE');
  assert.equal(initials(''), '?');
});
