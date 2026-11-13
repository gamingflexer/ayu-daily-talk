// All UI dictionaries. Non-English ones are drafts for native review.
import en from './en.js';
import hi from './hi.js';
import mr from './mr.js';
import bn from './bn.js';
import ta from './ta.js';
import te from './te.js';
import kn from './kn.js';
import gu from './gu.js';
import ml from './ml.js';

export const DICTS = { en, hi, mr, bn, ta, te, kn, gu, ml };

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
