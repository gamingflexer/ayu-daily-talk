import test from 'node:test';
import assert from 'node:assert/strict';
import { EN as en, LOADERS, LANG_LABELS, LANG_ORDER, LANG_LOCALE } from '../src/i18n/dicts.js';
import { flatKeys } from '../src/i18n/keys.js';
import { LANG_NAME } from '../shared/live-config.js';
import { BUILTIN_SETS } from '../shared/question-sets.js';
import { SIGNS } from '../shared/red-flags.js';

const get = (o, k) => k.split('.').reduce((x, p) => (x == null ? undefined : x[p]), o);
const vars = (s) => (typeof s === 'string' ? (s.match(/\{\w+\}/g) || []).sort().join(',') : '');
const ALL = ['bn', 'en', 'gu', 'hi', 'kn', 'ml', 'mr', 'ta', 'te'];

test('the 9 app languages are everywhere they need to be', () => {
  assert.deepEqual(['en', ...Object.keys(LOADERS)].sort(), ALL);
  assert.deepEqual([...LANG_ORDER].sort(), ALL);
  for (const l of ALL) {
    assert.ok(LANG_NAME[l], `LANG_NAME.${l}`);
    assert.ok(LANG_LABELS[l], `LANG_LABELS.${l}`);
    assert.ok(LANG_LOCALE[l], `LANG_LOCALE.${l}`);
  }
});

test('English has words for every built-in question, answer and danger sign', () => {
  for (const set of Object.values(BUILTIN_SETS)) {
    assert.ok(get(en, `sets.${set.id}.title`), `${set.id} title`);
    for (const q of set.questions) {
      assert.ok(get(en, `sets.${set.id}.${q.id}.q`), `${set.id}.${q.id}.q`);
      for (const o of q.options) assert.ok(get(en, `sets.${set.id}.${q.id}.${o.id}`), `${set.id}.${q.id}.${o.id}`);
    }
  }
  for (const s of Object.keys(SIGNS)) assert.ok(get(en, `signs.${s}`), `signs.${s}`);
});

for (const [lang, load] of Object.entries(LOADERS)) {
  test(`${lang}: same keys as English, same placeholders, nothing empty`, async () => {
    const dict = (await load()).default;
    const have = new Set(flatKeys(dict));
    const missing = flatKeys(en).filter((k) => !have.has(k));
    assert.deepEqual(missing, [], `${lang} is missing keys`);
    const extra = [...have].filter((k) => get(en, k) === undefined);
    assert.deepEqual(extra, [], `${lang} has keys English does not`);
    for (const k of have) {
      const a = get(en, k);
      const b = get(dict, k);
      if (Array.isArray(a)) {
        assert.ok(Array.isArray(b) && b.length === a.length, `${lang}.${k} list length`);
        a.forEach((x, i) => assert.equal(vars(b[i]), vars(x), `${lang}.${k}[${i}] placeholders`));
      } else {
        assert.equal(typeof b, 'string', `${lang}.${k} should be text`);
        assert.ok(b.trim().length, `${lang}.${k} is empty`);
        assert.equal(vars(b), vars(a), `${lang}.${k} placeholders`);
      }
    }
  });
}
