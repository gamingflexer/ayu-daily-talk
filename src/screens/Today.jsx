import { useEffect, useState } from 'react';
import { Screen, Header, Card, Checklist, Chip, Eyebrow, Button } from '../components/ui.jsx';
import { Spinner } from '../components/call.jsx';
import { checkLive } from '../live/server.js';
import { useT } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { href, go } from '../router.js';
import { beginTalkMedia } from '../live/media.js';
import { InstallPrompt } from '../components/install.jsx';
import { DemoBar } from '../components/demo.jsx';

/** S3 · Today — her journey home. One primary action: today's talk. */
export function TodayScreen({ openMenu }) {
  const { t } = useT();
  const { persona: p } = useApp();
  const vars = { name: p.name, weeks: p.weeks, day: p.day, days: p.daysAfterBirth, age: p.age };
  const postnatal = p.stage === 'postnatal';
  // Mic + front camera are asked for inside this tap (iOS Safari needs a user gesture), then the talk opens.
  // Get today's talk ready while she reads: ask the server whether live talk is on and preload the
  // Live engine, so "Start talking" opens straight into the talk. Shown as a state (rule 4).
  const [warming, setWarming] = useState(true);
  useEffect(() => {
    let alive = true;
    checkLive()
      .then((h) => (h.live ? import('../live/gemini-live.js') : null))
      .catch(() => null)
      .finally(() => alive && setWarming(false));
    return () => {
      alive = false;
    };
  }, []);
  const ready = warming ? (
    <p className="busy-line light" role="status">
      <Spinner light /> {t('s3.loading')}
    </p>
  ) : null;
  const startTalk = () => {
    beginTalkMedia();
    go('/talk');
  };

  return (
    <Screen>
      <DemoBar />
      <Header name={p.name} onSwitch={openMenu} onProfile={openMenu} />
      <div className="body">
        <Eyebrow>{postnatal ? t('s3.eyebrowPostnatal', vars) : p.stage === 'elder' ? t('s3.eyebrowElder', vars) : t('s3.eyebrow', vars)}</Eyebrow>
        <h1 className="h1">{t(`p.${p.id}.hello`, vars)}</h1>

        {postnatal ? (
          <>
            <Card tone="dark">
              <h3>{t('p.anita.babyTalk')}</h3>
              <p>{t('p.anita.babyTalkBody')}</p>
              <Button onClick={startTalk}>{t('s3.start')}</Button>
              {ready}
            </Card>
            <Card tone="dark" style={{ background: 'var(--call-card)' }}>
              <h3>{t('p.anita.yourTalk')}</h3>
              <p>{t('p.anita.yourTalkBody')}</p>
            </Card>
          </>
        ) : (
          <Card tone="dark">
            <h3>{t('s3.talkTitle')}</h3>
            <p>{t(`p.${p.id}.talkBody`)}</p>
            <Button onClick={startTalk}>{t('s3.start')}</Button>
            {ready}
            <a className="note" href={href('/phone')}>
              {t('s3.weak')}
            </a>
          </Card>
        )}

        <Card>
          <h3>{t('s3.journey')}</h3>
          <Checklist items={t(`p.${p.id}.journey`, vars)} />
        </Card>

        <div className="chips">
          <Chip href={href('/share')}>{t('s3.share')}</Chip>
          {p.stage === 'pregnant' && <Chip href={href('/plan')}>{t('s3.birthPlan')}</Chip>}
          <Chip href={href('/photo?purpose=document')}>{t('s3.addReport')}</Chip>
        </div>
      </div>
      <div className="foot" />
      <InstallPrompt />
    </Screen>
  );
}
