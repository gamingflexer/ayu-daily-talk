import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { EN, dictNow, loadDict, LANG_LABELS, LANG_ORDER, LANG_LOCALE } from './dicts.js';

// Every UI string comes from the dictionaries; every key exists in every
// language (test/i18n.test.js). A key missing at run time falls back to English.
export { LANG_LABELS, LANG_ORDER, LANG_LOCALE };

function lookup(dict, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

function fill(str, vars) {
  if (typeof str !== 'string' || !vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}

export function makeT(dict = EN) {
  /** t('a.b', {name}) → string. Arrays/objects come back as they are (strings inside filled). */
  return (key, vars) => {
    let v = lookup(dict, key);
    if (v === undefined) v = lookup(EN, key);
    if (v === undefined) return key;
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? fill(x, vars) : x));
    return fill(v, vars);
  };
}

const I18nCtx = createContext({ lang: 'en', t: makeT(EN), setLang: () => {} });

export function I18nProvider({ lang, setLang, children }) {
  const [dict, setDict] = useState(() => dictNow(lang));
  useEffect(() => {
    let alive = true;
    const now = dictNow(lang);
    if (now) setDict(now);
    else loadDict(lang).then((d) => alive && setDict(d));
    return () => {
      alive = false;
    };
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t: makeT(dict || EN) }), [lang, setLang, dict]);
  // <html lang> drives the font stack and the type rules for Indic scripts.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.script = lang === 'en' ? 'latin' : 'indic';
  }, [lang]);
  // First paint of a saved non-English language waits for its words rather than flashing English.
  if (!dict) return null;
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  return useContext(I18nCtx);
}
