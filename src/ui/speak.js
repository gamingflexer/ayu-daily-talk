// Read text aloud with the phone's own voice (works offline where the voice is installed).
import { LANG_LOCALE } from '../i18n/dicts.js';

const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : null);

/** Is there a voice for this language on this phone? (false while voices are still loading) */
export function hasVoice(lang) {
  const s = synth();
  if (!s) return false;
  const want = (LANG_LOCALE[lang] || 'en-IN').slice(0, 2);
  return s.getVoices().some((v) => v.lang?.toLowerCase().startsWith(want));
}

export function speak(text, lang = 'en') {
  const s = synth();
  if (!s || !text) return;
  try {
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG_LOCALE[lang] || 'en-IN';
    u.rate = 0.92;
    s.speak(u);
  } catch {
    // no voice — the words are on screen
  }
}

export function hush() {
  try {
    synth()?.cancel();
  } catch {
    // nothing to stop
  }
}
