// UI dictionaries. English ships with the app; every other language is its own
// file, fetched the first time it is chosen (and kept by the service worker), so
// a phone only downloads the language it uses. Non-English text is a draft for native review.
import en from './en.js';

export const EN = en;

/** Loaders for the other languages. */
export const LOADERS = {
  hi: () => import('./hi.js'),
  mr: () => import('./mr.js'),
  bn: () => import('./bn.js'),
  ta: () => import('./ta.js'),
  te: () => import('./te.js'),
  kn: () => import('./kn.js'),
  gu: () => import('./gu.js'),
  ml: () => import('./ml.js'),
};

const loaded = { en };

/** The dictionary for a language if it is already in memory. */
export const dictNow = (lang) => loaded[lang] || null;

/** Load a language (resolves to English if it cannot be fetched, e.g. offline before first use). */
export async function loadDict(lang) {
  if (loaded[lang]) return loaded[lang];
  if (!LOADERS[lang]) return en;
  try {
    loaded[lang] = (await LOADERS[lang]()).default;
    return loaded[lang];
  } catch {
    return en;
  }
}

/** Order in pickers: the three first languages, then the rest. */
export const LANG_ORDER = ['hi', 'mr', 'en', 'bn', 'ta', 'te', 'kn', 'gu', 'ml'];

/** Each language in its own script. */
export const LANG_LABELS = {
  en: 'English',
  hi: 'हिंदी',
  mr: 'मराठी',
  bn: 'বাংলা',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  kn: 'ಕನ್ನಡ',
  gu: 'ગુજરાતી',
  ml: 'മലയാളം',
};

/** BCP-47 tags for speech and the <html lang>. */
export const LANG_LOCALE = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', gu: 'gu-IN', ml: 'ml-IN' };
