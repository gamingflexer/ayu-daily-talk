// ASHA · Questions (AshaQuestions board): drafts to review, sets in use, and a read-only view of a set.
import { useT } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { back, href } from '../router.js';
import { Screen, Circle, Mono } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { findSet, setTitle, questionText, optionText } from '../ui/words.js';
import { BUILTIN_SETS, setFor } from '../../shared/question-sets.js';
import { TabBar, LevelPicker } from './parts.jsx';
import { effectiveLevel } from './look.js';

/** Who answers each set today. */
function useCounts() {
  const { womenList, sets } = useStore();
  const counts = {};
  for (const w of womenList) {
    const id = setFor(w, sets).id;
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

export function AshaQuestions() {
  const { t, lang } = useT();
  const { sets } = useStore();
  const counts = useCounts();
  const all = Object.values(sets).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const drafts = all.filter((s) => s.status === 'draft');
  const used = [...Object.values(BUILTIN_SETS), ...all.filter((s) => s.status === 'approved')];

  const metaFor = (s) => {
    const w = counts[s.id] || 0;
    return t(w === 1 ? 'asha.questions.useMetaOne' : 'asha.questions.useMeta', { n: s.questions.length, w });
  };

  return (
    <Screen className="a-frame">
      <div className="a-list scroll a-q">
        <div className="a-page-head flush">
          <h1 className="a-h1 sm">{t('asha.questions.title')}</h1>
          <p className="a-lead">{t('asha.questions.lead')}</p>
        </div>

        <a className="a-make" href={href('/asha/new')}>
          <span className="a-make-plus" aria-hidden="true">
            <Icon name="plus" size={24} />
          </span>
          <span className="a-make-text">
            <span className="a-make-title">{t('asha.questions.make')}</span>
            <span className="a-make-sub">{t('asha.questions.makeSub')}</span>
          </span>
        </a>

        {drafts.map((s) => {
          const done = s.questions.filter((q) => q.checked).length;
          const next = s.questions.findIndex((q) => !q.checked);
          const to = next === -1 ? `/asha/send/${encodeURIComponent(s.id)}` : `/asha/review/${encodeURIComponent(s.id)}/${next + 1}`;
          return (
            <a key={s.id} className="a-set draft" href={href(to)}>
              <span className="a-chip amber">{t('asha.questions.draft')}</span>
              <span className="a-set-row">
                <span className="a-set-text">
                  <span className="a-set-title">{setTitle(s, t, lang)}</span>
                  <Mono>{t('asha.questions.draftMeta', { n: s.questions.length, k: done })}</Mono>
                </span>
                <span className="circle dark a-set-go" aria-hidden="true">
                  <Icon name="arrow" size={20} />
                </span>
              </span>
            </a>
          );
        })}

        {used.map((s) => (
          <a key={s.id} className="a-set" href={href(`/asha/set/${encodeURIComponent(s.id)}`)}>
            <span className="a-chip green">{t('asha.questions.inUse', { v: s.version || 1 })}</span>
            <span className="a-set-title">{setTitle(s, t, lang)}</span>
            <Mono>{metaFor(s)}</Mono>
          </a>
        ))}
      </div>
      <TabBar active="questions" />
    </Screen>
  );
}

/** Read-only view of a set in use: every question, every answer and the level it reaches. */
export function AshaSetView({ setId }) {
  const { t, lang } = useT();
  const { sets } = useStore();
  const counts = useCounts();
  const set = findSet(setId, sets);

  if (!set) {
    return (
      <Screen>
        <div className="top">
          <Circle icon="back" label={t('asha.back')} onClick={() => back('/asha/questions')} />
        </div>
        <div className="hero">
          <p className="body-lg">{t('asha.set.missing')}</p>
        </div>
      </Screen>
    );
  }

  const w = counts[set.id] || 0;
  return (
    <Screen>
      <div className="top">
        <Circle icon="back" label={t('asha.back')} onClick={() => back('/asha/questions')} />
        <Mono className="strong">{t('asha.set.meta', { v: set.version || 1 })}</Mono>
      </div>
      <div className="hero tight">
        <h1 className="h-lg">{setTitle(set, t, lang)}</h1>
        <p className="a-lead">{t(w === 1 ? 'asha.set.leadOne' : 'asha.set.lead', { n: set.questions.length, w })}</p>
        {set.builtin && <p className="small">{t('asha.set.builtinNote')}</p>}
      </div>
      <div className="a-stack a-set-qs">
        {set.questions.map((q, i) => (
          <section key={q.id} className="a-hist card">
            <Mono>{`${i + 1} / ${set.questions.length}`}</Mono>
            <h2 className="a-setq">{questionText(set, q, t, lang)}</h2>
            {q.options.map((o) => {
              const words = optionText(set, q, o, t, lang);
              return (
                <div key={o.id} className="a-setopt">
                  <span className="a-setopt-text">{words}</span>
                  <LevelPicker value={effectiveLevel(o, set.stage)} label={t('asha.review.levelFor', { option: words })} />
                </div>
              );
            })}
          </section>
        ))}
      </div>
      <div className="a-bottom-gap" />
    </Screen>
  );
}
