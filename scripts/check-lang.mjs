// node scripts/check-lang.mjs mr  → lists missing / extra keys, placeholder and list-length mismatches vs en.
import en from '../src/i18n/en.js';
import { requiredKeys, flatKeys } from '../src/i18n/keys.js';
const lang = process.argv[2];
const dict = (await import(`../src/i18n/${lang}.js`)).default;
const get = (o, k) => k.split('.').reduce((x, p) => (x == null ? undefined : x[p]), o);
const vars = (s) => (typeof s === 'string' ? (s.match(/\{\w+\}/g) || []).sort().join(',') : '');
const have = new Set(flatKeys(dict));
const problems = [];
for (const k of requiredKeys(en)) if (!have.has(k)) problems.push(`missing ${k}`);
for (const k of have) {
  const a = get(en, k), b = get(dict, k);
  if (a === undefined) { problems.push(`extra ${k}`); continue; }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) { problems.push(`list ${k}`); continue; }
    a.forEach((x, i) => { if (typeof x === 'string' && (vars(x) !== vars(b[i]) || (x.includes('|') && x.split('|')[0] !== String(b[i]).split('|')[0]))) problems.push(`item ${k}[${i}]`); });
  } else if (vars(a) !== vars(b)) problems.push(`placeholders ${k}`);
}
console.log(problems.length ? problems.join('\n') : `${lang}: OK (${have.size} keys)`);
process.exit(problems.length ? 1 : 0);
