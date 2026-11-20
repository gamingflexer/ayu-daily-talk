import { useEffect, useRef, useState } from 'react';
import { Screen, Circle, Mono, Btn } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { useT } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { go, swap } from '../router.js';
import { assess } from '../../shared/triage.js';
import { UNSURE } from '../../shared/question-sets.js';
import { questionText, optionText } from '../ui/words.js';
import { speak, hush } from '../ui/speak.js';
import { picFor, hasPictures } from './pics.jsx';
import { HelpBar } from './Home.jsx';

/** 2 · Daily check — one question a screen, read aloud, answers she can tap. */
export function CheckScreen() {
  const { t, lang } = useT();
  const { woman, ctx, qset, addEntry, role } = useStore();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const timer = useRef(null);
  const Q = qset.questions;
  const q = Q[i];
  const cur = answers[q.id];

  const say = (n) => {
    const x = Q[n];
    speak(`${questionText(qset, x, t, lang)} ${x.options.map((o) => optionText(qset, x, o, t, lang)).join('. ')}`, lang);
  };
  // Read each question as it appears (many of the women read with difficulty).
  useEffect(() => {
    say(i);
    return hush;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, lang]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const finish = (all) => {
    const r = assess({ set: qset, answers: all, ...ctx });
    const e = addEntry({ womanId: woman.id, kind: 'check', setId: qset.id, setVersion: qset.version, answers: all, signs: r.signs, level: r.level, items: r.items, rule: r.rule, combo: r.combo, by: role === 'asha' ? 'asha' : 'self' });
    swap(`/result/${e.id}`);
  };
  const answer = (val) => {
    const all = { ...answers, [q.id]: val };
    setAnswers(all);
    clearTimeout(timer.current);
    // A short beat so she sees her tap land before the next question.
    timer.current = setTimeout(() => (i >= Q.length - 1 ? finish(all) : setI(i + 1)), 380);
  };
  const goBack = () => {
    clearTimeout(timer.current);
    if (i === 0) go(role === 'asha' ? `/asha/w/${woman.id}` : '/home');
    else setI(i - 1);
  };

  const pics = hasPictures(qset, q);
  return (
    <Screen aura={{ tone: 'none' }}>
      <div className="top">
        <Circle icon="back" label={t('common.back')} onClick={goBack} iconSize={22} />
        <Mono>{t('check.counter', { n: i + 1, total: Q.length })}</Mono>
        <Circle icon="speaker" tone="coral" label={t('check.hear')} onClick={() => say(i)} iconSize={22} />
      </div>
      <div className="segs" aria-hidden="true">
        {Q.map((x, n) => (
          <span key={x.id} className={n <= i ? 'on' : ''} />
        ))}
      </div>
      {role === 'asha' && <p className="small" style={{ padding: '14px 24px 0' }}>{t('check.forName', { name: woman.name })}</p>}
      <h1 className="h-lg question">{questionText(qset, q, t, lang)}</h1>

      <div className={`opts ${pics ? '' : 'list'}`}>
        {q.options.map((o, n) => {
          const on = cur === o.id;
          const wide = pics && q.options.length % 2 === 1 && n === q.options.length - 1;
          return (
            <button key={o.id} type="button" className={`opt ${wide ? 'wide' : ''}`} aria-pressed={on} onClick={() => answer(o.id)}>
              {pics && <span className="opt-pic">{picFor(qset, q, o)}</span>}
              <span className="opt-label">{optionText(qset, q, o, t, lang)}</span>
              {(on || !pics) && (
                <span className="opt-tick">
                  <Icon name="check" size={18} weight={2.6} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grow" />
      <div className="dock">
        <Btn kind="ghost" aria-pressed={cur === UNSURE} onClick={() => answer(UNSURE)}>
          {t('common.notSure')}
        </Btn>
      </div>
      <HelpBar />
    </Screen>
  );
}
