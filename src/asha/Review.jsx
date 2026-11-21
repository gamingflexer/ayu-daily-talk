// ASHA · Review a draft (AshaReview board): one question at a time, words and levels checked by the ASHA.
import { useEffect, useState } from 'react';
import { useT, LANG_LABELS } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { go, swap } from '../router.js';
import { Screen, Circle, Mono, Btn, Field, Sheet } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { speak } from '../ui/speak.js';
import { optionLevel } from '../../shared/triage.js';
import { levelIndex } from '../../shared/red-flags.js';
import { LevelPicker } from './parts.jsx';
import { DictateField } from '../ui/dictate.jsx';

const pick = (text, lang) => text?.[lang] || text?.en || '';

/** The level an answer reaches: never below what the fixed rule for its sign says. */
const ruleMin = (o, stage) => (o.sign ? optionLevel({ sign: o.sign }, { stage }) : 'none');
const shown = (o, stage) => optionLevel(o, { stage });

export function AshaReview({ setId, n }) {
  const { t, lang } = useT();
  const { sets, saveSet, removeSet } = useStore();
  const set = sets[setId];
  const idx = Math.max(0, Number(n) - 1 || 0);
  const q = set?.questions[idx];
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!set) swap('/asha/questions');
    else if (set.status !== 'draft') swap(`/asha/set/${encodeURIComponent(set.id)}`);
    else if (!q) swap(`/asha/review/${encodeURIComponent(set.id)}/1`);
  }, [set, q]);
  if (!set || set.status !== 'draft' || !q) return null;

  const total = set.questions.length;
  const voiceLang = q.text[lang] ? lang : 'en';
  const main = pick(q.text, lang);
  const mainLang = q.text[lang] ? lang : 'en';
  const secondLang = Object.keys(q.text).find((l) => l !== mainLang && l !== 'en') || (mainLang !== 'en' ? 'en' : null);
  const title = pick(set.title, lang);

  const putQuestion = (next) => saveSet({ ...set, questions: set.questions.map((x, i) => (i === idx ? next : x)) });

  function setLevel(o, lv) {
    const floor = levelIndex(lv) < levelIndex(ruleMin(o, set.stage)) ? ruleMin(o, set.stage) : lv;
    putQuestion({ ...q, options: q.options.map((x) => (x.id === o.id ? { ...x, floor } : x)) });
  }

  function looksRight() {
    const questions = set.questions.map((x, i) => (i === idx ? { ...x, checked: true } : x));
    saveSet({ ...set, questions });
    const order = [...questions.keys()].slice(idx + 1).concat([...questions.keys()].slice(0, idx));
    const next = order.find((i) => !questions[i].checked);
    if (next === undefined) go(`/asha/send/${encodeURIComponent(set.id)}`);
    else go(`/asha/review/${encodeURIComponent(set.id)}/${next + 1}`);
  }

  function removeQuestion() {
    setConfirm(false);
    const questions = set.questions.filter((_, i) => i !== idx);
    if (!questions.length) {
      removeSet(set.id);
      swap('/asha/questions');
      return;
    }
    saveSet({ ...set, questions });
    swap(`/asha/review/${encodeURIComponent(set.id)}/${Math.min(idx, questions.length - 1) + 1}`);
  }

  function hear() {
    const words = [pick(q.text, voiceLang), ...q.options.map((o) => pick(o.text, voiceLang))];
    speak(words.join('. '), voiceLang);
  }

  return (
    <Screen className="a-review">
      <div className="top">
        <Circle icon="back" label={t('asha.back')} onClick={() => go('/asha/questions')} />
        <Mono className="a-review-meta">{t('asha.review.meta', { title, n: idx + 1, total })}</Mono>
        <Circle icon="speaker" tone="coral" label={t('asha.review.hear', { lang: LANG_LABELS[voiceLang] })} onClick={hear} />
      </div>

      <div className="segs a-segs" aria-hidden="true">
        {set.questions.map((x, i) => (
          <span key={x.id} className={i === idx ? 'now' : x.checked ? 'on' : ''} />
        ))}
      </div>

      <div className="a-review-q">
        <span className="small">{t('asha.review.ask')}</span>
        <h1 className="a-review-h">{main}</h1>
        {secondLang && q.text[secondLang] && (
          <span className="a-review-second" lang={secondLang}>
            {q.text[secondLang]}
          </span>
        )}
      </div>

      <div className="a-opts">
        {q.options.map((o, i) => {
          const words = pick(o.text, lang);
          const min = ruleMin(o, set.stage);
          return (
            <div key={o.id} className="a-opt">
              <span className="a-opt-top">
                <span className="a-opt-n" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="a-opt-text">{words}</span>
              </span>
              <LevelPicker value={shown(o, set.stage)} min={min} label={t('asha.review.levelFor', { option: words })} onPick={(lv) => setLevel(o, lv)} />
              {min !== 'none' && <span className="a-opt-rule">{t('asha.review.ruleMin')}</span>}
            </div>
          );
        })}
        <button type="button" className="add-link" onClick={() => setAdding(true)}>
          <Icon name="plus" size={20} />
          {t('asha.review.addQuestion')}
        </button>
        <button type="button" className="a-side-link" onClick={() => setConfirm(true)}>
          <Icon name="trash" size={18} />
          {t('asha.review.remove')}
        </button>
      </div>

      <div className="grow" />
      <div className="a-review-dock">
        <Btn kind="ghost" onClick={() => setEditing(true)}>
          {t('asha.review.change')}
        </Btn>
        <Btn onClick={looksRight}>{t('asha.review.right')}</Btn>
      </div>

      {editing && <WordsSheet q={q} onClose={() => setEditing(false)} onSave={(next) => (putQuestion(next), setEditing(false))} />}
      {adding && (
        <WordsSheet
          q={blankQuestion(set)}
          isNew
          onClose={() => setAdding(false)}
          onSave={(next) => {
            const questions = [...set.questions, next];
            saveSet({ ...set, questions });
            setAdding(false);
            go(`/asha/review/${encodeURIComponent(set.id)}/${questions.length}`);
          }}
        />
      )}
      {confirm && (
        <Sheet title={t('asha.review.removeTitle')} onClose={() => setConfirm(false)} closeLabel={t('asha.close')}>
          <p className="body a-sheet-body">{t('asha.review.removeBody')}</p>
          <Btn onClick={() => setConfirm(false)}>{t('asha.review.keep')}</Btn>
          <Btn kind="ghost" onClick={removeQuestion}>
            {t('asha.review.removeYes')}
          </Btn>
        </Sheet>
      )}
    </Screen>
  );
}

/** A new, empty question in the set's languages (two answers to start, both "Fine"; the ASHA sets the levels). */
function blankQuestion(set) {
  const langs = Object.keys(set.questions[0]?.text || { en: '' });
  const empty = Object.fromEntries(langs.map((l) => [l, '']));
  let n = set.questions.length + 1;
  while (set.questions.some((x) => x.id === `q${n}`)) n++;
  return { id: `q${n}`, text: { ...empty }, options: [1, 2].map((i) => ({ id: `o${i}`, text: { ...empty }, floor: 'none' })), checked: false };
}

/** Edit (or write) a question and its answers in every language the draft has. Answers can be added (up to 5) and removed (down to 2). */
function WordsSheet({ q, onClose, onSave, isNew = false }) {
  const { t } = useT();
  const langs = Object.keys(q.text);
  const [text, setText] = useState(q.text);
  const [opts, setOpts] = useState(q.options.map((o) => ({ ...o, text: { ...Object.fromEntries(langs.map((l) => [l, ''])), ...o.text } })));
  const clean = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.replace(/\s+/g, ' ').trim()]).filter(([, v]) => v));
  const ok = text.en?.trim() && opts.length >= 2 && opts.every((o) => o.text.en?.trim());
  const mic = { micLabel: t('asha.review.dictate'), listeningLabel: t('asha.review.listening') };

  function addAnswer() {
    let n = opts.length + 1;
    while (opts.some((o) => o.id === `o${n}`)) n++;
    setOpts((p) => [...p, { id: `o${n}`, text: Object.fromEntries(langs.map((l) => [l, ''])), floor: 'none' }]);
  }

  function save() {
    if (!ok) return;
    onSave({ ...q, text: clean(text), options: opts.map((o) => ({ ...o, text: clean(o.text) })), checked: false });
  }

  return (
    <Sheet title={isNew ? t('asha.review.addQuestion') : t('asha.review.editTitle')} onClose={onClose} closeLabel={t('asha.close')}>
      <form
        className="a-words"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {langs.map((l) => (
          <DictateField key={`q-${l}`} lang={l} label={t('asha.review.questionIn', { lang: LANG_LABELS[l] })} value={text[l] || ''} maxLength={140} onChange={(v) => setText((p) => ({ ...p, [l]: v }))} {...mic} />
        ))}
        {opts.map((o, i) => (
          <div key={o.id} className="a-words-opt">
            {langs.map((l) => (
              <DictateField
                key={`${o.id}-${l}`}
                lang={l}
                label={t('asha.review.optionIn', { n: i + 1, lang: LANG_LABELS[l] })}
                value={o.text[l] || ''}
                maxLength={60}
                onChange={(v) => setOpts((p) => p.map((x, j) => (j === i ? { ...x, text: { ...x.text, [l]: v } } : x)))}
                {...mic}
              />
            ))}
            {opts.length > 2 && (
              <button type="button" className="a-side-link" onClick={() => setOpts((p) => p.filter((_, j) => j !== i))}>
                <Icon name="trash" size={18} />
                {t('asha.review.removeAnswer', { n: i + 1 })}
              </button>
            )}
          </div>
        ))}
        {opts.length < 5 && (
          <button type="button" className="add-link" onClick={addAnswer}>
            <Icon name="plus" size={20} />
            {t('asha.review.addAnswer')}
          </button>
        )}
        <Btn type="submit" disabled={!ok}>
          {t('asha.review.save')}
        </Btn>
      </form>
    </Sheet>
  );
}
