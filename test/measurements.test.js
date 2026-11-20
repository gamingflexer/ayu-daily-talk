import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CITATIONS,
  TRUSTED_SOURCES,
  citationFor,
  combineRules,
  evaluateMeasurements,
} from '../shared/measurements.js';
import { evaluate } from '../shared/red-flags.js';

const m = (key, value, source = 'family') => ({ key, value, source });

test('no measurements → none', () => {
  assert.equal(evaluateMeasurements({}).level, 'none');
  assert.equal(evaluateMeasurements({ measurements: [] }).level, 'none');
});

test('BP 140/90 → see today', () => {
  const r = evaluateMeasurements({
    measurements: [m('systolic_bp', 142), m('diastolic_bp', 88)],
    stage: 'pregnant',
  });
  assert.equal(r.level, 'see_today');
  assert.equal(r.rule, 'measurement:bp>=140/90');
});

test('BP 160/110 → emergency, and the severe rule wins the slot', () => {
  const r = evaluateMeasurements({
    measurements: [m('systolic_bp', 165), m('diastolic_bp', 95)],
    stage: 'pregnant',
  });
  assert.equal(r.level, 'emergency');
  assert.equal(r.rule, 'measurement:bp>=160/110');
});

test('stage 1 hypertension does NOT fire (Bone 2021)', () => {
  // 130/80 is hypertension by US guidelines but was not associated with
  // adverse outcomes in the CLIP cohorts. Firing here would flood the ASHA.
  const r = evaluateMeasurements({
    measurements: [m('systolic_bp', 135), m('diastolic_bp', 85)],
    stage: 'pregnant',
  });
  assert.equal(r.level, 'none');
});

test('either arm of the BP pair can fire it alone', () => {
  assert.equal(
    evaluateMeasurements({ measurements: [m('diastolic_bp', 92)], stage: 'pregnant' }).level,
    'see_today',
  );
  assert.equal(
    evaluateMeasurements({ measurements: [m('systolic_bp', 161)], stage: 'pregnant' }).level,
    'emergency',
  );
});

test('SpO2 below 90 → emergency; 90–93 → see today; 94+ → none', () => {
  const at = (n) => evaluateMeasurements({ measurements: [m('spo2', n)], stage: 'pregnant' }).level;
  assert.equal(at(88), 'emergency');
  assert.equal(at(92), 'see_today');
  assert.equal(at(97), 'none');
});

test('MUAC: a mother may fire a referral (Ale 2016)', () => {
  const r = evaluateMeasurements({
    measurements: [m('muac_child_mm', 110, 'family')],
    stage: 'postnatal',
  });
  assert.equal(r.level, 'emergency');
  assert.equal(r.contextOnly.length, 0);
});

test('MUAC 115–124 is the moderate band', () => {
  const r = evaluateMeasurements({
    measurements: [m('muac_child_mm', 118, 'family')],
    stage: 'postnatal',
  });
  assert.equal(r.level, 'see_today');
});

test('foot length from a family member is context only (Hodgins 2020)', () => {
  // The cluster RCT: a family card misclassified 84.5% of babies under 2000 g.
  const r = evaluateMeasurements({
    measurements: [m('foot_length_mm', 70, 'family')],
    stage: 'postnatal',
  });
  assert.equal(r.level, 'none');
  assert.equal(r.contextOnly.length, 1);
  assert.match(r.contextOnly[0].why, /not validated/);
});

test('the same foot length from an ASHA does fire (Tikmani 2024)', () => {
  const r = evaluateMeasurements({
    measurements: [m('foot_length_mm', 70, 'asha')],
    stage: 'postnatal',
  });
  assert.equal(r.level, 'see_today');
  assert.equal(r.contextOnly.length, 0);
});

test('chest circumference needs a frontline measurer too', () => {
  assert.equal(
    evaluateMeasurements({ measurements: [m('chest_circumference_cm', 28, 'family')], stage: 'postnatal' }).level,
    'none',
  );
  assert.equal(
    evaluateMeasurements({ measurements: [m('chest_circumference_cm', 28, 'asha')], stage: 'postnatal' }).level,
    'see_today',
  );
});

test('a measurement outside its stage is ignored, not applied', () => {
  // An elder has no newborn rules.
  const r = evaluateMeasurements({ measurements: [m('muac_child_mm', 100)], stage: 'elder' });
  assert.equal(r.level, 'none');
  assert.match(r.contextOnly[0].why, /stage elder/);
});

test('unknown keys and non-numbers are dropped silently', () => {
  const r = evaluateMeasurements({
    measurements: [m('made_up', 1), m('systolic_bp', 'high'), m('spo2', NaN)],
    stage: 'pregnant',
  });
  assert.equal(r.level, 'none');
});

test('combineRules takes the higher of signs and measurements', () => {
  const signs = evaluate({ signs: ['swelling_feet'], weeks: 34, stage: 'pregnant' });
  const meas = evaluateMeasurements({
    measurements: [m('systolic_bp', 150), m('diastolic_bp', 95)],
    stage: 'pregnant',
  });
  const r = combineRules(signs, meas);
  assert.equal(r.level, 'see_today');
  assert.equal(r.rule, 'measurement:bp>=140/90');
  assert.ok(r.reasons.includes('swelling_feet'));
  assert.ok(r.reasons.includes('bp_high'));
});

test('combineRules keeps the sign rule when signs are more urgent', () => {
  const signs = evaluate({ signs: ['convulsions'], stage: 'pregnant' });
  const meas = evaluateMeasurements({ measurements: [m('systolic_bp', 145)], stage: 'pregnant' });
  const r = combineRules(signs, meas);
  assert.equal(r.level, 'emergency');
  assert.match(r.rule, /^emergency:convulsions/);
});

test('combineRules tolerates either side being absent', () => {
  assert.equal(combineRules(null, null).level, 'none');
  assert.equal(combineRules(evaluate({ signs: ['bleeding'], stage: 'pregnant' }), null).level, 'see_today');
});

test('every reason a rule can emit has a citation', () => {
  const emitted = new Set();
  const cases = [
    [[m('systolic_bp', 170)], 'pregnant'],
    [[m('systolic_bp', 145)], 'pregnant'],
    [[m('spo2', 85)], 'pregnant'],
    [[m('spo2', 92)], 'pregnant'],
    [[m('muac_child_mm', 110)], 'postnatal'],
    [[m('muac_child_mm', 120)], 'postnatal'],
    [[m('chest_circumference_cm', 28, 'asha')], 'postnatal'],
    [[m('foot_length_mm', 70, 'asha')], 'postnatal'],
  ];
  for (const [measurements, stage] of cases) {
    for (const reason of evaluateMeasurements({ measurements, stage }).reasons) emitted.add(reason);
  }
  assert.ok(emitted.size >= 8, `expected every rule to be exercised, got ${emitted.size}`);
  for (const reason of emitted) {
    assert.ok(citationFor(reason), `no citation for ${reason}`);
    assert.match(CITATIONS[reason], /doi:/, `citation for ${reason} has no DOI`);
  }
});

test('every trusted-source list is non-empty and uses known roles', () => {
  const roles = new Set(['self', 'family', 'asha', 'clinician']);
  for (const [key, sources] of Object.entries(TRUSTED_SOURCES)) {
    assert.ok(sources.length > 0, key);
    for (const s of sources) assert.ok(roles.has(s), `${key}: unknown role ${s}`);
  }
});
