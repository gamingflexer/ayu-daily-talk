// ASHA · Make a new set with Ayu: who is it for? Ayu drafts, the ASHA checks every question.
import { useState } from 'react';
import { useT, LANG_LABELS } from '../i18n/index.jsx';
import { useStore, newId } from '../store.jsx';
import { back, swap } from '../router.js';
import { Screen, Circle, Mono, Btn } from '../ui/kit.jsx';
import { sanitizeDraft } from '../../shared/question-sets.js';
import { draftQuestions } from './api.js';

/** At most English + 4 languages, so the draft comes back inside the server's time limit. */
const MAX_LANGS = 5;

export function AshaNewSet() {
  const { t, lang } = useT();
  const { womenList, saveSet } = useStore();
  const [stage, setStage] = useState('postnatal');
  const [about, setAbout] = useState('');
  const [state, setState] = useState('idle'); // idle | writing | failed

  // English, then the languages of the women at this stage, then the ASHA's own.
  const langs = [...new Set(['en', ...womenList.filter((w) => w.stage === stage).map((w) => w.lang), lang].filter(Boolean))].slice(0, MAX_LANGS);
  const ready = about.trim().length >= 3;

  async function write() {
    if (!ready || state === 'writing') return;
    setState('writing');
    try {
      const raw = await draftQuestions({ stage, about: about.trim().slice(0, 300), langs });
      const draft = sanitizeDraft({ ...raw, stage }, { id: newId('set') });
      if (!draft) throw new Error('empty draft');
      saveSet(draft);
      swap(`/asha/review/${encodeURIComponent(draft.id)}/1`);
    } catch {
      setState('failed');
    }
  }

  return (
    <Screen>
      <div className="top">
        <Circle icon="back" label={t('asha.back')} onClick={() => back('/asha/questions')} />
        <Mono className="strong">{t('asha.new.meta')}</Mono>
      </div>
      <div className="hero tight">
        <h1 className="h-lg">{t('asha.new.title')}</h1>
      </div>
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          write();
        }}
      >
        <div className="field">
          <span className="field-label">{t('asha.new.stage')}</span>
          <div className="choice">
            {['pregnant', 'postnatal'].map((s) => (
              <button key={s} type="button" aria-pressed={stage === s} disabled={state === 'writing'} onClick={() => setStage(s)}>
                {t(`asha.new.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="field-label">{t('asha.new.about')}</span>
          <textarea value={about} onChange={(e) => setAbout(e.target.value)} placeholder={t('asha.new.aboutPh')} maxLength={300} disabled={state === 'writing'} />
          <span className="field-hint">{t('asha.new.aboutHint', { langs: langs.map((l) => LANG_LABELS[l]).join(', ') })}</span>
        </label>
      </form>
      <div className="grow" />
      <div className="dock last">
        <p className={`a-status ${state}`} role="status" aria-live="polite">
          {state === 'writing' && <span className="a-spin" aria-hidden="true" />}
          {state === 'writing' ? t('asha.new.writing') : state === 'failed' ? t('asha.new.failed') : ''}
        </p>
        <Btn onClick={write} disabled={!ready || state === 'writing'}>
          {state === 'failed' ? t('asha.new.retry') : t('asha.new.write')}
        </Btn>
      </div>
    </Screen>
  );
}
