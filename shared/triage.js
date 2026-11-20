// Turn a finished daily check (or what she told Ayu) into a level.
//
// Order of authority:
//   1. shared/red-flags.js   fixed sign rules
//   2. shared/measurements.js fixed number rules (BP, SpO2 …)
//   3. answer floors and set combos — these can only RAISE the level, never lower it.
// Nothing here lets a set, an ASHA's edit or a model lower what a fixed rule says.

import { evaluate, maxLevel, levelIndex, LEVELS, SIGNS } from './red-flags.js';
import { evaluateMeasurements, combineRules } from './measurements.js';
import { UNSURE } from './question-sets.js';

/** Floors for signs she reports by voice (same as the daily check's answers). */
const TOLD_FLOOR = { severe_headache: 'see_today' };
/** Which sign groups apply to each stage (mirrors red-flags.js). */
const STAGE_GROUPS = { pregnant: ['pregnancy', 'any'], postnatal: ['pregnancy', 'postnatal', 'newborn', 'any'], elder: ['any'] };

const floorOf = (o) => (LEVELS.includes(o?.floor) ? o.floor : 'none');

/** The level one answer reaches by itself (its floor, or what the rules say about its sign alone). */
export function optionLevel(option, ctx = {}) {
  let level = floorOf(option);
  if (option?.sign) level = maxLevel(level, evaluate({ signs: [option.sign], ...ctx }).level);
  return level;
}

/**
 * @param {object} input
 * @param {object} input.set            question set (shared/question-sets.js)
 * @param {Record<string, string>} input.answers   questionId → optionId | 'unsure'
 * @param {string[]} [input.extraSigns] signs from Tell Ayu
 * @param {{key: string, value: number, source?: string}[]} [input.measurements]
 * @param {string} [input.stage] @param {number} [input.weeks] @param {number} [input.daysAfterBirth]
 * @returns {{level: string, rule: string|null, signs: string[], combo: boolean,
 *            items: {code: string, q?: string, o?: string, sign?: string, level: string}[]}}
 *   `items` are the answers that raised the level (for the reason chips), most serious first.
 */
export function assess({ set, answers = {}, extraSigns = [], measurements = [], stage, weeks, daysAfterBirth } = {}) {
  const ctx = { stage, weeks, daysAfterBirth };
  const signs = new Set(extraSigns);
  const items = [];
  const codes = new Set();
  let floor = 'none';

  for (const q of set?.questions || []) {
    const a = answers[q.id];
    if (a === undefined) continue;
    if (a === UNSURE) {
      // "Not sure" is never treated as "no": someone should look.
      floor = maxLevel(floor, 'watch');
      items.push({ code: `${q.id}:${UNSURE}`, q: q.id, o: UNSURE, level: 'watch' });
      continue;
    }
    const o = q.options.find((x) => x.id === a);
    if (!o) continue;
    codes.add(`${q.id}:${o.id}`);
    if (o.sign) signs.add(o.sign);
    floor = maxLevel(floor, floorOf(o));
    const level = optionLevel(o, ctx);
    if (level !== 'none') items.push({ code: `${q.id}:${o.id}`, q: q.id, o: o.id, sign: o.sign, level });
  }

  // What she told Ayu in her own words. A sign that applies to her stage is never
  // "all fine": at least her ASHA should hear it, and a headache that won't go
  // gets the same floor as in the daily check.
  for (const s of extraSigns) {
    const groups = STAGE_GROUPS[stage];
    if (groups && SIGNS[s] && !groups.includes(SIGNS[s].group)) continue;
    const level = maxLevel(maxLevel(evaluate({ signs: [s], ...ctx }).level, TOLD_FLOOR[s] || 'watch'), 'watch');
    floor = maxLevel(floor, level);
    items.push({ code: `sign:${s}`, sign: s, level });
  }

  let combo = false;
  for (const c of set?.combos || []) {
    if (c.any?.some((x) => codes.has(x)) && c.with?.some((x) => codes.has(x)) && LEVELS.includes(c.level)) {
      combo = true;
      floor = maxLevel(floor, c.level);
    }
  }

  const rules = combineRules(evaluate({ signs: [...signs], ...ctx }), evaluateMeasurements({ measurements, stage }));
  const level = maxLevel(rules.level, floor);
  const rule = levelIndex(floor) > levelIndex(rules.level) ? (combo ? 'set:combo' : 'set:floor') : rules.rule;

  for (const r of rules.reasons || []) {
    if (r.startsWith('bp_') || r.startsWith('spo2_')) items.push({ code: `m:${r}`, level: rules.level });
  }
  items.sort((a, b) => levelIndex(b.level) - levelIndex(a.level));
  return { level, rule, signs: [...signs], combo, items };
}
