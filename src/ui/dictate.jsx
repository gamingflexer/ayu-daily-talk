// Speak instead of typing: the phone's own speech-to-text (Web Speech API) fills a field.
// Shown only where the browser has it (Chrome on Android, Safari on iPhone); typing always works.
import { useEffect, useRef, useState } from 'react';
import { LANG_LOCALE } from '../i18n/dicts.js';
import { Icon } from './icons.jsx';

const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const canDictate = Boolean(Recognition);

/**
 * A text field with a mic button. What she says is added to what is already typed.
 * @param {{label: string, lang: string, value: string, onChange: (v: string) => void, maxLength?: number, micLabel: string, listeningLabel: string}} props
 */
export function DictateField({ label, lang, value, onChange, maxLength = 200, micLabel, listeningLabel, ...rest }) {
  const [on, setOn] = useState(false);
  const rec = useRef(null);
  const base = useRef('');
  useEffect(() => () => rec.current?.abort?.(), []);

  function toggle() {
    if (on) return rec.current?.stop();
    const r = new Recognition();
    r.lang = LANG_LOCALE[lang] || 'en-IN';
    r.interimResults = true;
    r.continuous = false;
    base.current = value ? `${value.trim()} ` : '';
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join(' ');
      onChange(`${base.current}${said}`.replace(/\s+/g, ' ').slice(0, maxLength));
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    try {
      r.start();
      setOn(true);
    } catch {
      setOn(false);
    }
  }

  return (
    <label className="field dictate">
      <span className="field-label">{label}</span>
      <span className="dictate-row">
        <input lang={lang} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} {...rest} />
        {canDictate && (
          <button type="button" className={`dictate-mic ${on ? 'on' : ''}`} aria-pressed={on} aria-label={on ? listeningLabel : micLabel} onClick={toggle}>
            <Icon name="mic" size={22} />
          </button>
        )}
      </span>
    </label>
  );
}
