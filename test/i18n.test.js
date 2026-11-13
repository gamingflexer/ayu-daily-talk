import test from 'node:test';
import assert from 'node:assert/strict';
import en from '../src/i18n/en.js';
import { DICTS } from '../src/i18n/dicts.js';
import { requiredKeys, flatKeys, isReviewerOnly } from '../src/i18n/keys.js';
import { LANG_NAME } from '../shared/live-config.js';

const get = (o, k) => k.split('.').reduce((x, p) => (x == null ? undefined : x[p]), o);
const vars = (s) => (typeof s === 'string' ? (s.match(/\{\w+\}/g) || []).sort().join(',') : '');

test('every language has the 9 app languages', () => {
  assert.deepEqual(Object.keys(DICTS).sort(), ['bn', 'en', 'gu', 'hi', 'kn', 'ml', 'mr', 'ta', 'te']);
  for (const l of Object.keys(DICTS)) assert.ok(LANG_NAME[l], `LANG_NAME.${l}`);
});

for (const [lang, dict] of Object.entries(DICTS)) {
  if (lang === 'en') continue;
  test(`${lang}: keys in parity with en`, () => {
    const have = new Set(flatKeys(dict));
    const missing = requiredKeys(en).filter((k) => !have.has(k));
    assert.deepEqual(missing, [], `${lang} is missing keys`);
    const extra = [...have].filter((k) => get(en, k) === undefined);
    assert.deepEqual(extra, [], `${lang} has keys English does not`);
  });
  test(`${lang}: same placeholders, list lengths and list marks`, () => {
    for (const k of flatKeys(dict)) {
      if (isReviewerOnly(k)) continue;
      const a = get(en, k);
      const b = get(dict, k);
      if (Array.isArray(a)) {
        assert.ok(Array.isArray(b), `${lang}.${k} should be a list`);
        assert.equal(b.length, a.length, `${lang}.${k} length`);
        a.forEach((x, i) => {
          if (typeof x === 'string') {
            assert.equal(b[i].split('|')[0] === x.split('|')[0] || !x.includes('|'), true, `${lang}.${k}[${i}] mark`);
            assert.equal(vars(b[i]), vars(x), `${lang}.${k}[${i}] placeholders`);
          } else {
            assert.deepEqual(Object.keys(b[i]).sort(), Object.keys(x).sort(), `${lang}.${k}[${i}] fields`);
          }
        });
      } else {
        assert.equal(typeof b, 'string', `${lang}.${k} should be text`);
        assert.ok(b.trim().length, `${lang}.${k} is empty`);
        assert.equal(vars(b), vars(a), `${lang}.${k} placeholders`);
      }
    }
  });
}
