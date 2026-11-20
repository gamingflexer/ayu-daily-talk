// What the ASHA screens read out of the store. Pure functions over real entries:
// nothing here invents data, and nothing here sets a level (shared/triage.js does).
import { DAY, dayKey, entriesOn, bpHistory, answerHistory, ruleContext, weeksNow } from '../../shared/journal.js';
import { levelIndex, maxLevel } from '../../shared/red-flags.js';
import { optionLevel } from '../../shared/triage.js';
import { UNSURE } from '../../shared/question-sets.js';
import { findSet, reasonText, stageLine, questionText, optionText } from '../ui/words.js';

/** Tone of a Today row from her real level today. */
export function toneOf(level, handled) {
  if (handled) return 'plain';
  const i = levelIndex(level);
  return i >= 2 ? 'care' : i === 1 ? 'watch' : 'fine';
}

/** The level an answer really reaches: its floor, raised by the fixed rule for its sign. */
export const effectiveLevel = (o, stage) => optionLevel(o, { stage });

export const firstName = (name = '') => name.trim().split(/\s+/)[0] || name;

/**
 * Entry shapes this file reads (written by the patient app, Tell Ayu and this app):
 *   { id, womanId, at, kind: 'check'|'help'|'tell'|'bp', level, items?: [{code,q,o,sign,level}],
 *     signs?: string[], setId?, answers?: {qId: oId|'unsure'}, bp?: {sys, dia}, handledAt? }
 * Every field except id/womanId/at/kind is read defensively.
 */

/** Her day: real level of everything today, what is still open, what was handled. */
export function dayState(entries, womanId, now = Date.now()) {
  // A Help now press is always an emergency, whatever level the entry carries.
  const list = entriesOn(entries, womanId, now).map((e) => (e.kind === 'help' ? { ...e, level: maxLevel(e.level || 'none', 'emergency') } : e));
  const level = list.reduce((m, e) => maxLevel(m, e.level || 'none'), 'none');
  const flagged = list.filter((e) => levelIndex(e.level) > 0);
  const open = flagged.filter((e) => !e.handledAt);
  return {
    list,
    level,
    any: list.length > 0,
    check: list.find((e) => e.kind === 'check') || null,
    help: list.find((e) => e.kind === 'help' && !e.handledAt) || null,
    open,
    handled: flagged.length > 0 && open.length === 0,
    top: [...flagged].sort((a, b) => levelIndex(b.level) - levelIndex(a.level) || b.at - a.at)[0] || null,
    bp: list.find((e) => e.kind === 'bp' && e.bp) || null,
  };
}

const bpText = (bp) => `${bp.sys}/${bp.dia}`;

/** The first reason of an entry in words ("Face or hands swollen", "BP 152/100"). */
export function entryReason(entry, sets, t, lang) {
  if (!entry) return '';
  if (entry.kind === 'bp' && entry.bp) return t('asha.today.bp', { bp: bpText(entry.bp) });
  if (entry.kind === 'help') return t('asha.today.helpReason');
  const item = (entry.items || [])[0];
  if (item) return reasonText(item, findSet(entry.setId, sets), t, lang);
  const sign = (entry.signs || [])[0];
  if (sign) return t(`signs.${sign}`);
  return t(`asha.badge.${entry.level || 'none'}`);
}

/** One line for a Today row: the top reason, plus today's BP when it is a different entry. */
export function todayReason(state, sets, t, lang) {
  const parts = [entryReason(state.top, sets, t, lang)];
  if (state.bp && state.bp !== state.top) parts.push(t('asha.today.bp', { bp: bpText(state.bp.bp) }));
  return parts.filter(Boolean).join(' · ');
}

/** "Week 34" / "9 days after birth" for any woman. */
export function stageOf(woman, t) {
  return stageLine(woman, ruleContext(woman), t);
}

/** "24 · Week 34 · Jambhulni" (only the parts we know). */
export function profileLine(woman, t) {
  return [woman.age ? String(woman.age) : '', stageOf(woman, t), woman.village || ''].filter(Boolean).join(' · ');
}

/** "2 min ago" */
export function agoText(at, t, now = Date.now()) {
  const min = Math.max(0, Math.floor((now - at) / 60000));
  if (min < 1) return t('asha.today.justNow');
  if (min < 60) return t('asha.today.minAgo', { n: min });
  return t('asha.today.hoursAgo', { n: Math.floor(min / 60) });
}

/** Week to start the form stepper from: today's week, never the week she gave months ago. */
export function weekForForm(woman) {
  return weeksNow(woman) || woman?.weeksAtStart || 20;
}

// ---- "Check when you see her" ---------------------------------------------

/** Sign → line key under `asha.see.`. Several signs share one line. */
const SIGN_LINE = {
  swelling_face_hands: 'swelling',
  swelling_feet: 'swelling',
  severe_headache: 'head',
  blurred_vision: 'head',
  reduced_fetal_movement: 'baby',
  bleeding: 'bleeding',
  heavy_bleeding: 'bleeding',
  fluid_leak: 'fluid',
  fever: 'fever',
  convulsions: 'fits',
  breathlessness: 'breath',
  severe_abdominal_pain: 'belly',
  lower_belly_pain: 'belly',
  vomiting_no_food: 'vomit',
  dehydration: 'vomit',
  foul_discharge: 'discharge',
  very_low_mood: 'mood',
  baby_yellow_skin: 'babySkin',
  baby_pale_stool: 'babySkin',
  baby_poor_feeding: 'babyFeed',
  baby_fast_breathing: 'babyBreath',
  baby_cold_or_hot: 'babyWarm',
  baby_convulsions: 'babyFits',
};

/** Readings in a row that went up (newest first list). */
function risingRun(readings) {
  let n = 1;
  for (let i = 0; i < readings.length - 1; i++) {
    if (readings[i].sys > readings[i + 1].sys) n++;
    else break;
  }
  return n;
}

/**
 * Numbered lines for the ASHA, built only from her saved answers and BP (last 3 days).
 * @returns {string[]} lines in words
 */
export function checkLines({ woman, entries, sets, t, lang, now = Date.now() }) {
  const from = new Date(dayKey(now - 2 * DAY)).getTime();
  const recent = entries.filter((e) => e.womanId === woman.id && e.at >= from).sort((a, b) => b.at - a.at);
  const lines = [];
  const seen = new Set();
  const add = (key, text) => {
    if (seen.has(key) || !text) return;
    seen.add(key);
    lines.push(text);
  };

  // BP first: it is the one thing she can measure today.
  const readings = bpHistory(entries, woman.id, 6);
  const last = readings[0];
  if (last && last.at >= from) {
    // 140/90: the threshold in shared/measurements.js (bp_high).
    const high = last.sys >= 140 || last.dia >= 90;
    const run = risingRun(readings);
    if (high && run >= 3) add('bp', t('asha.see.bpRising', { n: run, bp: bpText(last) }));
    else if (high) add('bp', t('asha.see.bpHigh', { bp: bpText(last) }));
  }

  // Then her answers and signs, most serious first.
  const items = [];
  for (const e of recent) {
    for (const it of e.items || []) items.push({ ...it, setId: e.setId });
    for (const s of e.signs || []) items.push({ sign: s, level: e.level || 'watch' });
  }
  items.sort((a, b) => levelIndex(b.level) - levelIndex(a.level));
  for (const it of items) {
    if (it.sign && SIGN_LINE[it.sign]) {
      add(SIGN_LINE[it.sign], t(`asha.see.${SIGN_LINE[it.sign]}`));
      continue;
    }
    const set = findSet(it.setId, sets);
    const q = set?.questions.find((x) => x.id === it.q);
    if (!q) continue;
    if (it.o === UNSURE) {
      add(`u:${it.setId}:${q.id}`, t('asha.see.unsure', { question: questionText(set, q, t, lang) }));
      continue;
    }
    const o = q.options.find((x) => x.id === it.o);
    if (o) add(`a:${it.setId}:${q.id}:${o.id}`, t('asha.see.answer', { answer: optionText(set, q, o, t, lang) }));
  }
  return lines;
}

// ---- "Her answers" ----------------------------------------------------------

/** Start of the day `days - 1` days ago (Today = 1). */
export function rangeStart(days, now = Date.now()) {
  return new Date(dayKey(now - (days - 1) * DAY)).getTime();
}

/**
 * One question's answers in a range: newest answer per day (up to 4 tiles),
 * counts per answer, and the level of each answer.
 */
export function questionHistory({ entries, woman, set, q, days, ctx, now = Date.now() }) {
  const from = rangeStart(days, now);
  const rows = answerHistory(entries, woman.id, q.id, now, 15).rows.filter((r) => r.at >= from && (!r.setId || r.setId === set.id));
  if (!rows.length) return null;
  const levelOf = (oid) => (oid === UNSURE ? 'watch' : optionLevel(q.options.find((o) => o.id === oid), ctx));
  const tiles = [];
  const days_ = new Set();
  for (const r of rows) {
    const k = dayKey(r.at);
    if (days_.has(k)) continue;
    days_.add(k);
    tiles.push({ at: r.at, today: k === dayKey(now), option: r.option, level: levelOf(r.option) });
    if (tiles.length === 4) break;
  }
  const counts = {};
  for (const r of rows) counts[r.option] = (counts[r.option] || 0) + 1;
  const parts = Object.entries(counts)
    .map(([option, n]) => ({ option, n, level: levelOf(option) }))
    .sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || b.n - a.n);
  return { tiles, parts };
}
