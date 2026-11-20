import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// research.js reads Vite env and a build-time constant; give it what Vite would.
globalThis.__APP_VERSION__ = 'test';

test('a research record carries no name, phone, village or ASHA details, and only fields the rules allow', async () => {
  const src = fs.readFileSync(new URL('../src/research.js', import.meta.url), 'utf8').replace(/import\.meta\.env\.\w+/g, "''");
  const mod = await import(`data:text/javascript,${encodeURIComponent(src)}`);
  const rec = mod.researchRecord(
    { kind: 'call', lang: 'hi', stage: 'pregnant', weeks: 34, name: 'Kavita', phone: '9800000002', village: 'Jambhulni', ashaPhone: '9800000001', level: 'see_today', turns: [{ who: 'her', text: 'sir dard', at: 1 }], answers: { swell: 'feet' } },
    { device: 'd_x', now: 5 },
  );
  const json = JSON.stringify(rec);
  for (const bad of ['Kavita', '9800000002', 'Jambhulni', '9800000001', 'name', 'phone', 'village']) assert.ok(!json.includes(bad), bad);
  const rules = fs.readFileSync(new URL('../firebase/firestore.rules', import.meta.url), 'utf8');
  const allowed = rules.match(/hasOnly\(\[([^\]]+)\]\)/)[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1));
  assert.deepEqual(Object.keys(rec).filter((k) => !allowed.includes(k)), []);
  assert.equal(rec.level, 'see_today');
  assert.equal(mod.researchRecord({ kind: 'tell', level: 'nonsense' }).level, 'unknown');
  assert.equal(mod.researchOn, false);
});
