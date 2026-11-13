import { useState } from 'react';
import { Screen, Header, Card, Checklist, Eyebrow, Button, TextLink } from '../components/ui.jsx';
import { useT } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { href } from '../router.js';
import { notedFromTalk } from '../../shared/talk-state.js';

/** The last talk, if it belongs to the persona on screen. */
function useTalk() {
  const { persona: p, lastTalk } = useApp();
  return lastTalk && lastTalk.persona === p.id && lastTalk.referral ? lastTalk : null;
}

/** S10 · Next step — see someone today / call 108. Decided by fixed rules, not the model. */
export function NextStepScreen({ openMenu }) {
  const { t } = useT();
  const { persona: p } = useApp();
  const talk = useTalk();
  const [reminded, setReminded] = useState(null);
  const level = talk ? talk.referral.level : 'see_today';
  const emergency = level === 'emergency';
  const signs = talk ? (talk.signs || []).filter((s) => s !== 'swelling_feet' || p.weeks >= 20) : [];
  const modelReasons = talk ? (talk.referral.reasons || []).filter((r) => r.startsWith('model:')).map((r) => r.slice(6).trim()) : [];
  const vars = { phc: p.phc.name, km: p.phc.km, till: p.phc.openTill, husband: p.husband || t('s10.family') };

  const why = signs.length
    ? t('s10.whyFromTalk', { list: signs.map((s) => t(`signs.${s}`).toLowerCase()).join(', ') })
    : t(`p.${p.id}.why`, vars);

  return (
    <Screen>
      <Header name={p.name} onSwitch={openMenu} onProfile={openMenu} />
      <div className="body">
        <Eyebrow>{t('s10.eyebrow')}</Eyebrow>
        <h1 className="h1">{emergency ? t('s10.titleEmergency') : t('s10.title')}</h1>
        <Card tone="wash">
          <p>{why}</p>
          {modelReasons.map((r) => (
            <p key={r} className="small" style={{ marginTop: 6 }}>
              {t('s10.ayuAdded', { reason: r })}
            </p>
          ))}
        </Card>
        <Card>
          <Checklist items={t('s10.where', vars).map((x) => ({ mark: 'next', text: x }))} />
        </Card>
        <Card tone="green">
          <p>{t('s10.keepTablets')}</p>
        </Card>
        <p className="small">{t('s10.decidedBy')}</p>
      </div>
      <div className="foot">
        <Button href="tel:108">{t('s10.cta')}</Button>
        {reminded ? (
          <p className="small">{t('s10.reminded', { time: reminded })}</p>
        ) : (
          <TextLink
            onClick={() =>
              setReminded(new Date(Date.now() + 3600_000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
            }
          >
            {t('s10.remind')}
          </TextLink>
        )}
      </div>
    </Screen>
  );
}

/** S11 · All fine today — "Ayu noted today" comes from what the talk recorded. */
export function AllFineScreen({ openMenu }) {
  const { t } = useT();
  const { persona: p } = useApp();
  const talk = useTalk();
  const fromTalk = notedFromTalk(talk, {
    yes: t('common.yes'),
    no: t('common.no'),
    notSure: t('common.notSure'),
    none: t('common.noneOfThese'),
    camera: t('s11.camera'),
  });
  let items = fromTalk.length ? fromTalk : t(`p.${p.id}.noted`);
  if (talk?.referral.level === 'watch') {
    const watchSigns = (talk.signs || []).filter((s) => s === 'swelling_feet' || s === 'very_low_mood');
    items = [...items, ...watchSigns.map((s) => `warn|${t(`signs.${s}`)} — ${t('s11.askAgain')}`)];
  }
  return (
    <Screen>
      <Header name={p.name} onSwitch={openMenu} onProfile={openMenu} />
      <div className="body">
        <Eyebrow green>{t('s10.eyebrow')}</Eyebrow>
        <h1 className="h1">{t('s11.title')}</h1>
        <Card>
          <h3>{t('s11.noted')}</h3>
          <Checklist items={items} />
        </Card>
        <Card tone="plain">
          <p>{t(`p.${p.id}.thisWeek`)}</p>
        </Card>
      </div>
      <div className="foot">
        <Button href={href('/today')}>{t('s11.cta')}</Button>
      </div>
    </Screen>
  );
}
