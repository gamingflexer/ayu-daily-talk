// What Tell Ayu saves when she confirms (or taps a quick sign). Pure, so it is tested.
import { assess } from '../../shared/triage.js';
import { ruleContext } from '../../shared/journal.js';
import { maxLevel, levelIndex } from '../../shared/red-flags.js';

/**
 * The entry for what she confirmed. A sign she confirmed, or words she wants heard,
 * are never "all fine": at least her ASHA should hear them.
 */
export function tellEntry(woman, { signs = [], others = [], transcript = '' }, now = Date.now()) {
  const ctx = ruleContext(woman, now);
  const r = assess({ set: null, extraSigns: signs, ...ctx });
  let level = r.level;
  const items = [...r.items];
  // Guard: a confirmed sign that the rules skip for her stage still counts as "someone should hear it".
  for (const s of signs) if (!items.some((i) => i.sign === s)) items.push({ code: `sign:${s}`, sign: s, level: 'watch' });
  others.forEach((text, i) => items.push({ code: i ? `tell:other:${i + 1}` : 'tell:other', level: 'watch', text: text.slice(0, 80) }));
  if (!signs.length && !others.length && transcript) items.push({ code: 'tell:other', level: 'watch', text: transcript.slice(0, 80) });
  if (items.length) level = maxLevel(level, 'watch');
  items.sort((a, b) => levelIndex(b.level) - levelIndex(a.level));
  return { womanId: woman.id, kind: 'tell', transcript, signs: r.signs, level, items, rule: r.rule || (items.length ? 'tell:heard' : null), combo: r.combo };
}
