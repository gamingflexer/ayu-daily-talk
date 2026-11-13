import { createContext, useContext, useEffect, useMemo } from 'react';
import { DICTS, LANG_LABELS, LANG_ORDER, LANG_LOCALE } from './dicts.js';

// Every UI string comes from these files. Reviewer-only keys (src/i18n/keys.js)
// fall back to English; every other key exists in every language (test/i18n.test.js).
export const LANGS = DICTS;
export { LANG_LABELS, LANG_ORDER, LANG_LOCALE };
const en = DICTS.en;

function lookup(dict, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

function fill(str, vars) {
  if (typeof str !== 'string' || !vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}

export function makeT(lang) {
  const dict = LANGS[lang] || en;
  /** t('a.b', {name}) → string. Arrays/objects come back as they are (strings inside filled). */
  const t = (key, vars) => {
    let v = lookup(dict, key);
    if (v === undefined) v = lookup(en, key);
    if (v === undefined) return key;
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? fill(x, vars) : x));
    return fill(v, vars);
  };
  return t;
}

const I18nCtx = createContext({ lang: 'en', t: makeT('en'), setLang: () => {} });

export function I18nProvider({ lang, setLang, children }) {
  const value = useMemo(() => ({ lang, setLang, t: makeT(lang) }), [lang, setLang]);
  // <html lang> drives the font stack and the extra line height for Indic scripts.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.script = lang === 'en' ? 'latin' : 'indic';
  }, [lang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  return useContext(I18nCtx);
}
