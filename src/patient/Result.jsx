import { useEffect } from 'react';
import { Screen, Circle, Mono, Btn, Rows, Row, ReasonChip, LEVEL_N } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { useT } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { go, swap } from '../router.js';
import { findSet, reasonText, timeLabel, stageLine, telHref, smsHref, mapsHref } from '../ui/words.js';
import { ruleContext } from '../../shared/journal.js';
import { speak, hush } from '../ui/speak.js';
import { HelpBar } from './Home.jsx';

/** The words for a result. Also used for the SMS she can send. */
export function resultWords(entry, woman, sets, t, lang) {
  const set = findSet(entry.setId, sets);
  const reasons = (entry.items || []).map((it) => ({ level: it.level, text: reasonText(it, set, t, lang) })).filter((r) => r.text);
  const asha = woman.ashaName || t('common.yourAsha');
  const lv = entry.level;
  let title = t(`result.${lv}.title`, { asha });
  let body;
  if (lv === 'none') body = t('result.none.body');
  else if (lv === 'watch') body = reasons.length > 1 ? t('result.watch.bodyMany', { n: reasons.length }) : t('result.watch.body');
  else if (lv === 'see_today') body = reasons.length > 1 ? t('result.see_today.bodyMany', { n: reasons.length }) : reasons[0] ? t('result.see_today.bodyOne', { reason: reasons[0].text }) : '';
  else body = entry.combo ? t('result.emergency.bodyCombo') : t('result.emergency.body');
  const explain = lv === 'emergency' ? '' : lv === 'see_today' && entry.combo ? t('result.explain.combo') : t(`result.explain.${lv}`);
  return { title, body, explain, reasons, asha };
}

/** 3 / 4 · Result — the room tells her how serious it is before she reads a word. */
export function ResultScreen({ id }) {
  const { t, lang } = useT();
  const { entries, women, sets, role } = useStore();
  const entry = entries.find((e) => e.id === id);
  const woman = entry ? women[entry.womanId] : null;
  const home = () => {
    hush();
    swap(role === 'asha' && woman ? `/asha/w/${woman.id}` : '/home');
  };

  const w = entry && woman ? resultWords(entry, woman, sets, t, lang) : null;
  useEffect(() => {
    if (!w) return undefined;
    const timer = setTimeout(() => speak(`${w.title}. ${w.body}`, lang), 250);
    return () => {
      clearTimeout(timer);
      hush();
    };
    // Speak once per result, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lang]);

  if (!w) {
    return (
      <Screen aura={{ tone: 'home' }}>
        <div className="top" />
        <div className="hero">
          <p className="body-lg">{t('result.missing')}</p>
        </div>
        <div className="grow" />
        <div className="dock last">
          <Btn onClick={() => go('/')}>{t('common.done')}</Btn>
        </div>
      </Screen>
    );
  }

  const lv = entry.level;
  const n = LEVEL_N[lv];
  const night = n === 3;
  const ashaTel = telHref(woman.ashaPhone);
  const ctx = ruleContext(woman, entry.at);
  const where = [stageLine(woman, ctx, t), woman.village].filter(Boolean).join(', ');
  const sms = smsHref(
    woman.ashaPhone,
    t('sms.check', { name: woman.name, stage: where ? `${where}` : '', village: '', level: t(`sms.level.${lv}`), reasons: w.reasons.map((r) => r.text).join('; ') }),
  );
  const centre = woman.centre || '';

  return (
    <Screen night={night} aura={{ tone: n, pos: night ? 'low' : 'topLeft' }}>
      <div className="top">
        <Mono className="strong">{night ? t('result.metaEmergency') : t('result.metaNow', { time: timeLabel(entry.at, lang) })}</Mono>
        <Circle icon="close" tone={night ? 'glass' : 'soft'} label={t('common.close')} onClick={home} />
      </div>

      <div className="hero" style={{ paddingTop: 40, gap: 12 }}>
        {n === 0 && (
          <span className="badge-ok">
            <Icon name="check" size={28} weight={2.6} />
          </span>
        )}
        <h1 className="h-xl">{w.title}</h1>
        <p className="body-lg">{w.body}</p>
      </div>

      {night ? (
        <div className="call108-wrap">
          <a className="call108 sm" href="tel:108" aria-label={t('result.call108')}>
            <span className="call108-num">108</span>
            <span className="call108-label">{t('result.callAmbulance')}</span>
          </a>
        </div>
      ) : (
        <div className="grow" />
      )}

      <div className="dock" style={{ gap: 10 }}>
        {n >= 1 && w.reasons.length > 0 && (
          <div className="reasons">
            {w.reasons.map((r, i) => (
              <ReasonChip key={i} level={r.level}>
                {r.text}
              </ReasonChip>
            ))}
          </div>
        )}

        {n === 2 && (
          <Rows>
            <Row
              label={t('result.goTo')}
              value={centre || t('result.centreUnknown')}
              note={t('result.centreFree')}
              action={<Circle icon="directions" tone="dark" size={52} href={mapsHref(centre || 'government health centre near me')} target="_blank" rel="noreferrer" label={t('result.directions')} />}
            />
            {ashaTel && (
              <Row label={t('result.tellAshaLabel')} value={t('result.tellAsha', { asha: w.asha })} action={<Circle icon="phone" tone="line" size={52} weight={2} href={ashaTel} label={t('home.callName', { name: w.asha })} />} />
            )}
            <Row label={t('result.noRide')} value={t('result.ambulance')} action={<Circle icon="phone" tone="line" size={52} weight={2} href="tel:108" label={t('result.call108')} />} />
          </Rows>
        )}

        {n === 1 && ashaTel && (
          <Rows>
            <Row
              label={t('result.ashaCardSub')}
              value={t('result.ashaCard', { asha: w.asha })}
              action={
                <>
                  <Circle icon="sms" tone="line" size={52} weight={2} href={sms} label={t('result.smsName', { name: w.asha })} />
                  <Circle icon="phone" tone="dark" size={52} weight={2} href={ashaTel} label={t('home.callName', { name: w.asha })} />
                </>
              }
            />
          </Rows>
        )}

        {night && ashaTel && (
          <div className="card dusk">
            <div className="row" style={{ padding: '12px 12px 12px 20px' }}>
              <span className="row-text">
                <span className="row-value" style={{ fontSize: 18 }}>{t('result.ashaCard', { asha: w.asha })}</span>
                <span className="row-label">{t('result.ashaCardSub')}</span>
              </span>
              <Circle icon="phone" tone="paper" weight={2} href={ashaTel} label={t('home.callName', { name: w.asha })} />
              <Circle icon="sms" tone="paper" weight={2} href={sms} label={t('result.smsName', { name: w.asha })} />
            </div>
          </div>
        )}

        {!night && w.explain && (
          <div className={`card pad explain ${n === 2 ? 'glass' : ''}`}>
            <p className="body">{w.explain}</p>
            <Circle icon="speaker" tone="coral" size={44} label={t('common.readAloud')} onClick={() => speak(w.explain, lang)} />
          </div>
        )}

        {n <= 1 && (
          <div className="watchline">
            <Icon name="alert" />
            <p>{t(`result.remind.${woman.stage === 'postnatal' ? 'postnatal' : 'pregnant'}`)}</p>
          </div>
        )}

        {n <= 1 && <Btn onClick={home}>{t('common.done')}</Btn>}
      </div>
      {n <= 1 ? <HelpBar /> : <div style={{ height: 'var(--bottom)' }} />}
    </Screen>
  );
}
