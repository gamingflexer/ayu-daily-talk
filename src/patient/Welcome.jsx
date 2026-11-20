import { useState } from 'react';
import { Screen, Mono } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { LangPill, LangSheet } from '../ui/lang.jsx';
import { useT } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { go } from '../router.js';

/**
 * First open: pick a language, then say whose phone this is.
 * [Inferred — not on Vrindar's boards] Built from the Home board: same top bar,
 * hero and white cards; the question is the heading (rule 1), actions sit low (rule 2).
 */
export function WelcomeScreen() {
  const { t } = useT();
  const { langChosen } = useStore();
  const [langOpen, setLangOpen] = useState(!langChosen);
  return (
    <Screen aura={{ tone: 'home', pos: 'top' }}>
      <div className="top">
        <span className="circle" style={{ width: 44, height: 44 }}>
          <Icon name="heart" color="var(--coral)" />
        </span>
        <LangPill onClick={() => setLangOpen(true)} />
      </div>
      <div className="hero">
        <Mono>Ayu</Mono>
        <h1 className="h-xl">{t('welcome.title')}</h1>
        <p className="body-lg">{t('welcome.lead')}</p>
      </div>
      <div className="grow" />
      <div className="dock last">
        <button type="button" className="tell" onClick={() => go('/start/woman')}>
          <span className="tell-mic">
            <Icon name="heart" size={34} weight={2} />
          </span>
          <span className="tell-text">
            <span className="tell-title" style={{ fontSize: 21 }}>{t('welcome.woman')}</span>
            <span className="tell-sub">{t('welcome.womanSub')}</span>
          </span>
        </button>
        <button type="button" className="tell" style={{ boxShadow: 'none' }} onClick={() => go('/start/asha')}>
          <span className="tell-mic" style={{ background: 'var(--ink)' }}>
            <Icon name="people" size={32} weight={2} />
          </span>
          <span className="tell-text">
            <span className="tell-title" style={{ fontSize: 21 }}>{t('welcome.asha')}</span>
            <span className="tell-sub">{t('welcome.ashaSub')}</span>
          </span>
        </button>
        <p className="small" style={{ padding: '4px 8px 0' }}>{t('welcome.private')}</p>
      </div>
      {langOpen && <LangSheet onClose={() => setLangOpen(false)} />}
    </Screen>
  );
}
