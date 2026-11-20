import { Sheet } from './kit.jsx';
import { useT } from '../i18n/index.jsx';
import { LANG_LABELS, LANG_ORDER } from '../i18n/dicts.js';

/** Language picker. Each language is written in its own script. */
export function LangSheet({ onClose }) {
  const { t, lang, setLang } = useT();
  return (
    <Sheet title={t('common.language')} onClose={onClose} closeLabel={t('common.close')}>
      <div className="langs">
        {LANG_ORDER.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={lang === l}
            onClick={() => {
              setLang(l);
              onClose();
            }}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/** The language pill from the Home board. */
export function LangPill({ onClick }) {
  const { t, lang } = useT();
  return (
    <button type="button" className="pill" onClick={onClick} aria-label={t('common.languageNow', { lang: LANG_LABELS[lang] })}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
      </svg>
      <span lang={lang}>{LANG_LABELS[lang]}</span>
    </button>
  );
}
