// Facts worked out from what is saved on the phone: which week she is in, her
// last 7 days, who an ASHA should see first. Pure functions; no storage here.

import { levelIndex, maxLevel } from './red-flags.js';

export const DAY = 86_400_000;

/** Local calendar day, e.g. "2026-11-20". */
export function dayKey(at) {
  const d = new Date(at);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Week of pregnancy today, from the week she gave when she joined. Stops at 42. */
export function weeksNow(woman, now = Date.now()) {
  if (woman?.stage !== 'pregnant' || !woman.weeksAtStart) return undefined;
  const passed = Math.floor((now - (woman.weeksSetAt || woman.createdAt || now)) / (7 * DAY));
  return Math.min(42, Math.max(1, woman.weeksAtStart + Math.max(0, passed)));
}

/** Whole days since the birth (0 on the day itself). */
export function daysAfterBirth(woman, now = Date.now()) {
  if (woman?.stage !== 'postnatal' || !woman.birthAt) return undefined;
  return Math.max(0, Math.floor((now - woman.birthAt) / DAY));
}

/** What the rules need to know about her. */
export function ruleContext(woman, now = Date.now()) {
  return { stage: woman?.stage, weeks: weeksNow(woman, now), daysAfterBirth: daysAfterBirth(woman, now) };
}

const mine = (entries, womanId) => entries.filter((e) => e.womanId === womanId);

/** Her entries for one calendar day, newest first. */
export function entriesOn(entries, womanId, now = Date.now()) {
  const key = dayKey(now);
  return mine(entries, womanId)
    .filter((e) => dayKey(e.at) === key)
    .sort((a, b) => b.at - a.at);
}

/** Today's state: highest level of anything she did today, and whether the daily check is done. */
export function today(entries, womanId, now = Date.now()) {
  const list = entriesOn(entries, womanId, now);
  const level = list.reduce((m, e) => maxLevel(m, e.level || 'none'), 'none');
  const check = list.find((e) => e.kind === 'check') || null;
  const help = list.find((e) => e.kind === 'help' && !e.handledAt) || null;
  return { any: list.length > 0, level, check, help, latest: list[0] || null };
}

/** Seven days ending today, oldest first: `{key, level}` with level null when she did nothing that day. */
export function lastDays(entries, womanId, now = Date.now(), count = 7) {
  const byDay = new Map();
  for (const e of mine(entries, womanId)) {
    const k = dayKey(e.at);
    byDay.set(k, maxLevel(byDay.get(k) || 'none', e.level || 'none'));
  }
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const at = now - i * DAY;
    const k = dayKey(at);
    out.push({ key: k, at, level: byDay.has(k) ? byDay.get(k) : null });
  }
  return out;
}

/** One word for the 7-day row: 'new' (nothing yet) | 'steady' | 'watch' | 'care'. */
export function trend(days) {
  const done = days.filter((d) => d.level !== null);
  if (!done.length) return 'new';
  const last = done[done.length - 1].level;
  if (levelIndex(last) >= 2) return 'care';
  if (levelIndex(last) === 1 || done.slice(-3).some((d) => levelIndex(d.level) >= 2)) return 'watch';
  return 'steady';
}

/** Days in a row (ending today or yesterday) without any entry. */
export function silentDays(entries, womanId, now = Date.now()) {
  const last = mine(entries, womanId).reduce((m, e) => Math.max(m, e.at), 0);
  if (!last) return null;
  return Math.max(0, Math.round((new Date(dayKey(now)) - new Date(dayKey(last))) / DAY));
}

/**
 * The ASHA's Today list: women who need her first (open Help now, then by level), then the rest.
 * @returns {{woman: object, level: string, help: object|null, latest: object|null, silent: number|null}[]}
 */
export function ashaToday(women, entries, now = Date.now()) {
  return women
    .map((woman) => {
      const t = today(entries, woman.id, now);
      const open = t.latest && !t.latest.handledAt ? t.level : 'none';
      return { woman, level: t.help ? 'emergency' : open, help: t.help, latest: t.latest, any: t.any, silent: silentDays(entries, woman.id, now) };
    })
    .sort((a, b) => Number(Boolean(b.help)) - Number(Boolean(a.help)) || levelIndex(b.level) - levelIndex(a.level) || a.woman.name.localeCompare(b.woman.name));
}

/** How often each answer to one question was given in the last `count` days. */
export function answerHistory(entries, womanId, questionId, now = Date.now(), count = 14) {
  const from = now - count * DAY;
  const rows = mine(entries, womanId)
    .filter((e) => e.kind === 'check' && e.at >= from && e.answers && e.answers[questionId] !== undefined)
    .sort((a, b) => b.at - a.at);
  const counts = {};
  for (const e of rows) counts[e.answers[questionId]] = (counts[e.answers[questionId]] || 0) + 1;
  return { rows: rows.map((e) => ({ at: e.at, option: e.answers[questionId], setId: e.setId })), counts };
}

/** BP readings, newest first. */
export function bpHistory(entries, womanId, count = 4) {
  return mine(entries, womanId)
    .filter((e) => e.kind === 'bp' && e.bp)
    .sort((a, b) => b.at - a.at)
    .slice(0, count)
    .map((e) => ({ at: e.at, sys: e.bp.sys, dia: e.bp.dia, level: e.level }));
}

/** Two letters for the avatar circle. */
export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const chars = parts.length === 1 ? [...parts[0]].slice(0, 2) : [[...parts[0]][0], [...parts[parts.length - 1]][0]];
  return chars.join('').toLocaleUpperCase();
}
