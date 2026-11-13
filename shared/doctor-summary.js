// The 2-minute summary for her doctor (S13), built only from what the talk
// recorded plus her mock record. Deterministic: same talk in → same text out.
// It is written in English for the doctor; her own words stay as she said them.
// No diagnosis: it lists what she reported and what the fixed rules decided.

import en from '../src/i18n/en.js';
import { PLAN_ITEMS } from './talk-state.js';

const SIGN = en.signs;
const PICTURE = en.pictures;
const LEVEL_TEXT = {
  none: 'No danger sign by the fixed rules',
  watch: 'Watch — ask again at the next talk',
  see_today: 'SEE TODAY — fixed red-flag rule',
  emergency: 'EMERGENCY — told to call 108',
};
const PLAN_LABEL = {
  hospital: 'Hospital',
  transport: 'Transport',
  companion: 'Who comes',
  money: 'Money kept',
  documents_bag: 'Bag and documents',
  blood_donor: 'Blood donor',
};
const MAX_LINES = 14; // ~2 minutes of reading
const MAX_ANSWERS = 6;

const signText = (x) => (SIGN[x] ? SIGN[x].toLowerCase() : x.replace(/_/g, ' '));

/** Rule id → words a doctor reads at a glance. */
export function ruleText(rule) {
  if (!rule) return '';
  const [kind, what = '', extra] = rule.split(':');
  if (kind === 'pair') return `two signs together: ${what.split('+').map(signText).join(' + ')}${extra === 'after20w' ? ' (after 20 weeks)' : ''}`;
  if (kind === 'alone') return `${signText(what)} on its own`;
  if (kind === 'count') return 'two or more danger signs together';
  if (kind === 'emergency') return what === 'yellow_day0' ? 'yellow skin on the first day of life' : `${signText(what)} — emergency sign`;
  if (kind === 'mood') return 'low mood — check again';
  if (kind === 'watch') return `${signText(what)} — watch`;
  return rule;
}

/**
 * A model-written note must never soften what the fixed rules decided.
 * True when the note sounds routine/reassuring while the level is see_today or emergency.
 */
export function noteContradicts(level, note = '') {
  if (!['see_today', 'emergency'].includes(level)) return false;
  return /\b(routine|no (urgent|immediate|danger|concern|red flag)|non-?urgent|not urgent|normal|reassur|nothing to worry|all fine|stable)\b/i.test(note);
}

const yesNo = (a) => (a === 'yes' ? 'yes' : a === 'no' ? 'no' : a === 'not_sure' ? 'not sure' : a);

const CODES = {
  duration: { lt_day: 'less than a day', day_week: '1 day–1 week', week_month: '1 week–1 month', gt_month: 'more than a month', dont_know: 'does not know' },
  severity: { mild: 'mild (can do daily work)', moderate: 'moderate (daily work hard)', severe: 'SEVERE (cannot do anything)', dont_know: 'does not know' },
};

function answerLine(a) {
  let ans = Array.isArray(a.answer) ? a.answer.join(', ') || 'none of these' : CODES[a.kind]?.[a.answer] || yesNo(a.answer);
  if (a.kind === 'body') ans = `points to: ${String(a.answer).replace(/_/g, ' ')}`;
  if (a.kind === 'search') ans = a.symptom ? a.symptom.replace(/_/g, ' ') : `“${a.answer}” (her words)`;
  if (a.picture && a.pictureSet && PICTURE[a.pictureSet]?.[a.picture]) {
    ans = `${ans} (picked picture: ${PICTURE[a.pictureSet][a.picture]})`;
  }
  const via = a.via === 'camera' ? ' — showed it on camera' : a.via === 'keypad' ? ' — keypad, phone call' : '';
  return `${a.question} → ${ans}${via}`;
}

/**
 * @param {{persona: object, talk: object|null, now?: number}} input
 *   talk = snapshotTalk(...) (plain JSON), or null when no talk happened yet
 * @returns {{title: string, subtitle: string, sections: {id: string, title: string, lines: string[]}[], lines: string[], text: string}}
 *   lines are "mark|text" items (warn / dot / done) for the Checklist.
 */
export function buildDoctorSummary({ persona: p, talk, now = Date.now() }) {
  const title = p.stage === 'postnatal' ? `${p.name}, ${p.age} · day ${p.daysAfterBirth} after birth` : `${p.name}, ${p.age} · ${p.weeks} weeks`;
  const subtitle = [p.stage === 'pregnant' ? `pregnancy ${p.pregnancy}` : null, `${p.village}, ${p.district}`, `ASHA ${p.asha}`]
    .filter(Boolean)
    .join(' · ');

  const sections = [];
  const push = (id, sectionTitle, lines) => lines.length && sections.push({ id, title: sectionTitle, lines });

  // 1. Today's result (fixed rules first).
  if (talk) {
    const r = talk.referral || { level: 'none', reasons: [] };
    const when = new Date(talk.at || now).toISOString().slice(0, 16).replace('T', ' ');
    const lines = [`${r.level === 'none' ? 'dot' : r.level === 'watch' ? 'dot' : 'warn'}|${LEVEL_TEXT[r.level] || r.level} (talk ${when} UTC)`];
    const ruleSigns = (talk.signs || []).filter((s) => SIGN[s]);
    if (ruleSigns.length) lines.push(`warn|Danger signs reported: ${ruleSigns.map((s) => SIGN[s].toLowerCase()).join(', ')}`);
    if (r.rule) lines.push(`dot|Rule: ${ruleText(r.rule)}`);
    for (const why of (r.reasons || []).filter((x) => x.startsWith('model:'))) lines.push(`dot|Ayu raised it: ${why.slice(7).trim()}`);
    push('today', 'Today', lines);
  } else {
    push('today', 'Today', ['dot|No talk recorded yet today']);
  }

  // 2. In her words.
  if (talk) {
    const lines = [];
    for (const s of talk.symptoms || []) {
      const bits = [s.since, s.severity && s.severity !== 'unknown' ? s.severity : null].filter(Boolean).join(', ');
      lines.push(`${s.sign && s.sign !== 'other' ? 'warn' : 'dot'}|“${s.her_words}”${bits ? ` (${bits})` : ''}`);
    }
    const answers = (talk.answers || []).filter((a) => a.kind !== 'photo' && !a.changed);
    for (const a of answers.slice(-MAX_ANSWERS)) lines.push(`dot|${answerLine(a)}`);
    if (answers.length > MAX_ANSWERS) lines.unshift(`dot|${answers.length - MAX_ANSWERS} earlier answers not shown`);
    push('words', 'What she said', lines);
    const shown = (talk.photos || []).map((x) => `dot|${x.kind === 'video' ? 'Showed on camera' : 'Photo'}: ${x.purpose.replace('_', ' ')} (not stored)`);
    push('photos', 'Shown to Ayu', shown);
  }

  // 3. Background from her record (mock).
  const bg = [];
  if (p.bp?.length) {
    const first = p.bp[0];
    const last = p.bp[p.bp.length - 1];
    bg.push(`${last.sys >= 140 || last.dia >= 90 ? 'warn' : 'dot'}|BP ${first.sys}/${first.dia} (${first.label}) → ${last.sys}/${last.dia} (${last.label}), ${p.bp.length} readings`);
  }
  if (p.hb) bg.push(`${p.hb.value < 11 ? 'warn' : 'dot'}|Hb ${p.hb.value} g/dL at week ${p.hb.week}`);
  for (const m of p.medicines || []) bg.push(`dot|${m.name}: taken ${m.takenLast7}/7 days${m.note ? ` — ${m.note}` : ''}`);
  push('record', 'Her record', bg);

  // 4. Plan changed today, and her questions.
  if (talk) {
    const plan = PLAN_ITEMS.filter((k) => talk.plan?.[k]).map((k) => `${talk.plan[k].ready ? 'done' : 'dot'}|${PLAN_LABEL[k]}: ${talk.plan[k].value}`);
    push('plan', 'Birth plan (updated today)', plan);
    push('questions', 'Her questions for you', (talk.questionsForDoctor || []).map((q) => `dot|${q}`));
  }

  const lines = sections.flatMap((s) => s.lines).slice(0, MAX_LINES);
  const text = [
    `Ayu summary for the doctor — ${title}`,
    subtitle,
    ...sections.flatMap((s) => [``, `${s.title}:`, ...s.lines.map((l) => `• ${l.replace(/^\w+\|/, '')}`)]),
    ``,
    `Built from her daily talk by fixed rules. Not a diagnosis. Demo — mock data.`,
  ].join('\n');
  return { title, subtitle, sections, lines, text };
}
