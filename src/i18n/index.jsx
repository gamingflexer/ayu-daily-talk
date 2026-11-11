import { createContext, useContext, useMemo } from 'react';
import en from './en.js';
import hi from './hi.js';

// Every UI string comes from these files. Missing Hindi keys fall back to
// English (reviewer-only notes are English for now).
export const LANGS = { en, hi };
export const LANG_LABELS = { hi: 'हिंदी', mr: 'मराठी', en: 'English' };

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
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  return useContext(I18nCtx);
}
