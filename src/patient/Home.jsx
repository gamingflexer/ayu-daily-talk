import { useState } from 'react';
import { Screen, Circle, Mono, Rows, Row, LEVEL_N } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { LangPill, LangSheet } from '../ui/lang.jsx';
import { useT } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { go, href } from '../router.js';
import { today, lastDays, trend } from '../../shared/journal.js';
import { dayLabel, stageLine, telHref } from '../ui/words.js';

/** The bar that is on every calm screen: one tap to help, no questions. */
export function HelpBar() {
  const { t } = useT();
  return (
    <div className="helpbar-wrap">
      <a className="helpbar" href={href('/help')}>
        <span className="circle red" style={{ width: 48, height: 48 }}>
          <Icon name="plus" weight={2.4} />
        </span>
        <span className="helpbar-title">{t('home.helpNow')}</span>
        <span className="helpbar-note">{t('home.helpNote')}</span>
      </a>
    </div>
  );
}

/** 1 · Home — today's state as light, one coral action, three quiet rows. */
export function HomeScreen({ onTell, onCheck }) {
  const { t, lang } = useT();
  const { woman, ctx, qset, entries, role } = useStore();
  const [langOpen, setLangOpen] = useState(false);
  const now = Date.now();
  const td = today(entries, woman.id, now);
  const days = lastDays(entries, woman.id, now);
  const level = td.any ? td.level : null;
  const care = level !== null && LEVEL_N[level] >= 2;
  const ashaName = woman.ashaName || '';
  const ashaTel = telHref(woman.ashaPhone);

  return (
    <Screen aura={{ tone: level === null ? 'home' : LEVEL_N[level], pos: 'top' }}>
      <div className="top">
        {role === 'asha' ? (
          <Circle icon="back" size={44} label={t('me.backToAsha')} href={href(`/asha/w/${woman.id}`)} />
        ) : (
          <Circle icon="heart" size={44} iconSize={22} iconColor="var(--coral)" label={t('common.profile')} href={href('/me')} />
        )}
        <LangPill onClick={() => setLangOpen(true)} />
      </div>

      <div className="hero">
        <Mono>
          {stageLine(woman, ctx, t)} · {dayLabel(now, lang)}
        </Mono>
        <h1 className="h-xl">{t('home.hello', { name: woman.name })}</h1>
        <p className="lead">{care ? t('home.subCare') : t('home.sub')}</p>
      </div>

      <div className="grow" />

      <div className="dock">
        <button type="button" className="tell" onClick={onTell}>
          <span className="tell-mic">
            <Icon name="mic" size={34} weight={2} />
          </span>
          <span className="tell-text">
            <span className="tell-title">{t('home.tellTitle')}</span>
            <span className="tell-sub">{t('home.tellSub')}</span>
          </span>
        </button>

        <Rows>
          <Row
            label={t('home.check')}
            value={td.check ? t(`home.checkDone.${td.check.level}`) : t('home.checkTodo', { n: qset.questions.length })}
            onClick={onCheck}
            action={
              <span className={`circle ${td.check ? 'line' : 'dark'}`} style={{ width: 52, height: 52 }} role="img" aria-label={td.check ? t('home.checkAgain') : t('home.checkStart')}>
                <Icon name={td.check ? 'redo' : 'arrow'} />
              </span>
            }
          />
          <Row
            label={t('home.week')}
            value={t(`home.trend.${trend(days)}`)}
            action={
              <span className="dots" aria-hidden="true">
                {days.map((d, i) => (
                  <span key={d.key} className={`dot ${d.level === null ? (i === days.length - 1 ? 'todo' : 'none') : ''}`} data-level={d.level === null ? undefined : LEVEL_N[d.level]} />
                ))}
              </span>
            }
          />
          {ashaName && ashaTel ? (
            <Row label={t('home.asha')} value={ashaName} action={<Circle icon="phone" tone="line" size={52} weight={2} href={ashaTel} label={t('home.callName', { name: ashaName })} />} />
          ) : (
            <Row label={t('home.asha')} value={ashaName || t('home.ashaAdd')} onClick={() => go('/me')} action={<span className="circle line" style={{ width: 52, height: 52 }}><Icon name="plus" /></span>} />
          )}
        </Rows>
      </div>

      <HelpBar />
      {langOpen && <LangSheet onClose={() => setLangOpen(false)} />}
    </Screen>
  );
}
