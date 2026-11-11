import { useState } from 'react';
import { Screen, Header, Card, Checklist, Eyebrow, Button, TextLink } from '../components/ui.jsx';
import { useT } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { href } from '../router.js';

/** S10 · Next step — see someone today. Decided by fixed rules, not the model. */
export function NextStepScreen({ openMenu }) {
  const { t } = useT();
  const { persona: p, lastTalk } = useApp();
  const [reminded, setReminded] = useState(null);
  const fresh = lastTalk && lastTalk.persona === p.id && lastTalk.referral;
  const level = fresh ? lastTalk.referral.level : 'see_today';
  const emergency = level === 'emergency';
  const signs = fresh ? (lastTalk.signs || []).filter((s) => s !== 'swelling_feet' || p.weeks >= 20) : [];
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
          >{t('s10.remind')}</TextLink>
        )}
      </div>
    </Screen>
  );
}

/** S11 · All fine today. */
export function AllFineScreen({ openMenu }) {
  const { t } = useT();
  const { persona: p, lastTalk } = useApp();
  const fresh = lastTalk && lastTalk.persona === p.id;
  const watch = fresh && lastTalk.referral?.level === 'watch';
  const items = t(`p.${p.id}.noted`);
  return (
    <Screen>
      <Header name={p.name} onSwitch={openMenu} onProfile={openMenu} />
      <div className="body">
        <Eyebrow green>{t('s10.eyebrow')}</Eyebrow>
        <h1 className="h1">{t('s11.title')}</h1>
        <Card>
          <h3>{t('s11.noted')}</h3>
          <Checklist items={watch ? [...items, `warn|${t('s11.watch')}`] : items} />
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
