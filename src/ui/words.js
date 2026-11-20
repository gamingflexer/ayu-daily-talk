// Words for question sets, reasons and dates.
// Built-in sets read from the i18n dictionaries; sets an ASHA made carry their own text.
import { BUILTIN_SETS, UNSURE } from '../../shared/question-sets.js';
import { LANG_LOCALE } from '../i18n/dicts.js';

/** Find a set by id among the built-in ones and the ones on this phone. */
export function findSet(id, sets = {}) {
  return BUILTIN_SETS[id] || sets[id] || null;
}

const own = (text, lang) => (typeof text === 'string' ? text : text?.[lang] || text?.en || '');

export function setTitle(set, t, lang) {
  if (!set) return '';
  return set.builtin ? t(`sets.${set.id}.title`) : own(set.title, lang);
}

export function questionText(set, q, t, lang) {
  return set.builtin ? t(`sets.${set.id}.${q.id}.q`) : own(q.text, lang);
}

export function optionText(set, q, o, t, lang) {
  return set.builtin ? t(`sets.${set.id}.${q.id}.${o.id}`) : own(o.text, lang);
}

/** The words for one reason item from shared/triage.js. */
export function reasonText(item, set, t, lang) {
  if (item.code?.startsWith('m:')) return t(`reasons.${item.code.slice(2)}`);
  if (item.q && set) {
    const q = set.questions.find((x) => x.id === item.q);
    if (q) {
      if (item.o === UNSURE) return t('check.unsureAbout', { question: questionText(set, q, t, lang).replace(/[?？।]\s*$/, '') });
      const o = q.options.find((x) => x.id === item.o);
      if (o) return optionText(set, q, o, t, lang);
    }
  }
  if (item.sign) return t(`signs.${item.sign}`);
  return item.text || '';
}

const fmt = (lang, opts) => new Intl.DateTimeFormat(LANG_LOCALE[lang] || 'en-IN', opts);

/** "Fri, 20 Nov" */
export function dayLabel(at, lang) {
  return fmt(lang, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(at));
}
/** "Fri" */
export function weekdayLabel(at, lang) {
  return fmt(lang, { weekday: 'short' }).format(new Date(at));
}
/** "9:41 am" */
export function timeLabel(at, lang) {
  return fmt(lang, { hour: 'numeric', minute: '2-digit' }).format(new Date(at));
}

/** Her stage in a few words: "Week 34" / "9 days after birth". */
export function stageLine(woman, ctx, t) {
  if (!woman) return '';
  if (woman.stage === 'postnatal') {
    const d = ctx?.daysAfterBirth;
    if (d === undefined) return t('stage.newMother');
    if (d === 0) return t('stage.bornToday');
    return d < 14 ? t('stage.daysAfter', { n: d }) : t('stage.weeksAfter', { n: Math.floor(d / 7) });
  }
  return ctx?.weeks ? t('stage.week', { n: ctx.weeks }) : t('stage.pregnant');
}

/** tel: / sms: links. Indian numbers typed as 10 digits get +91. */
export function dial(phone) {
  const d = String(phone || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  return d.startsWith('+') ? d : d.length === 10 ? `+91${d}` : d;
}
export const telHref = (phone) => (dial(phone) ? `tel:${dial(phone)}` : '');
export function smsHref(phone, body) {
  const n = dial(phone);
  if (!n) return '';
  // "?&body=" works on both Android and iOS.
  return `sms:${n}?&body=${encodeURIComponent(body || '')}`;
}
/** Directions to a place by name (opens the maps app). */
export const mapsHref = (place) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;

export const validPhone = (v) => /^[6-9]\d{9}$/.test(String(v || '').replace(/\D/g, ''));
