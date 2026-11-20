// ASHA · Approve and send (AshaSend board): pick the women, approve the set.
import { useEffect, useState } from 'react';
import { useT, LANG_LABELS } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { back, swap } from '../router.js';
import { Screen, Circle, Mono, Btn } from '../ui/kit.jsx';
import { initials } from '../../shared/journal.js';
import { optionLevel } from '../../shared/triage.js';
import { hasVoice } from '../ui/speak.js';
import { useVoices } from './hooks.js';
import { stageOf } from './look.js';

export function AshaSend({ setId }) {
  const { t, lang } = useT();
  const { sets, womenList, saveSet } = useStore();
  useVoices();
  const set = sets[setId];
  const firstOpen = set ? set.questions.findIndex((q) => !q.checked) : -1;
  const match = set ? womenList.filter((w) => w.stage === set.stage) : [];
  const [chosen, setChosen] = useState(() => new Set(match.map((w) => w.id)));

  useEffect(() => {
    if (!set || set.status !== 'draft') swap('/asha/questions');
    else if (firstOpen !== -1) swap(`/asha/review/${encodeURIComponent(set.id)}/${firstOpen + 1}`);
  }, [set, firstOpen]);
  if (!set || set.status !== 'draft' || firstOpen !== -1) return null;

  const total = set.questions.length;
  const picked = match.filter((w) => chosen.has(w.id));
  const toggle = (id) =>
    setChosen((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Notes that are true on this phone, for the women picked.
  // A language counts as written when every question and answer has it.
  const written = new Set(
    Object.keys(set.title || {}).filter((l) => set.questions.every((q) => q.text[l] && q.options.every((o) => o.text[l]))),
  );
  const wanted = [...new Set(picked.map((w) => w.lang).filter(Boolean))];
  const voiced = wanted.filter((l) => written.has(l) && hasVoice(l));
  const missing = wanted.filter((l) => !written.has(l));
  const levels = set.questions.flatMap((q) => q.options.map((o) => optionLevel(o, { stage: set.stage })));
  const n108 = levels.filter((l) => l === 'emergency').length;
  const nDoc = levels.filter((l) => l === 'see_today').length;
  const names = (ls) => ls.map((l) => LANG_LABELS[l]).join(', ');

  function approve() {
    if (!picked.length) return;
    saveSet({ ...set, status: 'approved', approvedAt: Date.now(), assignedTo: picked.map((w) => w.id) });
    swap('/asha/questions');
  }

  return (
    <Screen aura={{ tone: 0, pos: 'topLeft' }}>
      <div className="top">
        <Circle icon="back" label={t('asha.back')} onClick={() => back(`/asha/review/${encodeURIComponent(set.id)}/${total}`)} />
        <Mono className="strong">{t('asha.send.meta', { n: total })}</Mono>
      </div>
      <div className="hero tight">
        <h1 className="a-send-h">{t('asha.send.title')}</h1>
        <p className="a-lead">{t('asha.send.lead', { title: set.title[lang] || set.title.en })}</p>
      </div>

      {match.length === 0 ? (
        <p className="a-note a-pad">{t('asha.send.noneMatch')}</p>
      ) : (
        <div className="card a-pick">
          {match.map((w, i) => (
            <div key={w.id}>
              {i > 0 && <div className="sep" />}
              <label className="a-pick-row">
                <span className="a-av soft" aria-hidden="true">
                  {initials(w.name)}
                </span>
                <span className="a-card-text">
                  <span className="a-pick-name">{w.name}</span>
                  <span className="a-pick-sub">{[stageOf(w, t), LANG_LABELS[w.lang]].filter(Boolean).join(' · ')}</span>
                </span>
                <input type="checkbox" checked={chosen.has(w.id)} onChange={() => toggle(w.id)} aria-label={t('asha.send.sendTo', { name: w.name })} />
              </label>
            </div>
          ))}
        </div>
      )}

      <div className="card glass a-notes">
        {voiced.length > 0 && (
          <span className="a-note-line">
            <span className="dot" data-level="0" aria-hidden="true" />
            {t('asha.send.voice', { langs: names(voiced) })}
          </span>
        )}
        {missing.length > 0 && (
          <span className="a-note-line">
            <span className="dot" data-level="1" aria-hidden="true" />
            {t('asha.send.english', { langs: names(missing) })}
          </span>
        )}
        {n108 > 0 && (
          <span className="a-note-line">
            <span className="dot" data-level="3" aria-hidden="true" />
            {t('asha.send.levels108', { n: n108 })}
          </span>
        )}
        {nDoc > 0 && (
          <span className="a-note-line">
            <span className="dot" data-level="2" aria-hidden="true" />
            {t('asha.send.levelsDoctor', { n: nDoc })}
          </span>
        )}
        <span className="a-note-line">
          <span className="dot" data-level="0" aria-hidden="true" />
          {t('asha.send.offline')}
        </span>
      </div>

      <div className="grow" />
      <div className="dock last">
        <Btn onClick={approve} disabled={!picked.length}>
          {t('asha.send.approve', { n: picked.length })}
        </Btn>
      </div>
    </Screen>
  );
}
