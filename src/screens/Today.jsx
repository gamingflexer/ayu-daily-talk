import { Screen, Header, Card, Checklist, Chip, Eyebrow, Button } from '../components/ui.jsx';
import { useT } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { href } from '../router.js';
import { InstallPrompt } from '../components/install.jsx';

/** S3 · Today — her journey home. One primary action: today's talk. */
export function TodayScreen({ openMenu }) {
  const { t } = useT();
  const { persona: p } = useApp();
  const vars = { name: p.name, weeks: p.weeks, day: p.day, days: p.daysAfterBirth };
  const postnatal = p.stage === 'postnatal';

  return (
    <Screen>
      <Header name={p.name} onSwitch={openMenu} onProfile={openMenu} />
      <div className="body">
        <Eyebrow>{postnatal ? t('s3.eyebrowPostnatal', vars) : t('s3.eyebrow', vars)}</Eyebrow>
        <h1 className="h1">{t(`p.${p.id}.hello`, vars)}</h1>

        {postnatal ? (
          <>
            <Card tone="dark">
              <h3>{t('p.anita.babyTalk')}</h3>
              <p>{t('p.anita.babyTalkBody')}</p>
              <Button href={href('/talk')}>{t('s3.start')}</Button>
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
            <Button href={href('/talk')}>{t('s3.start')}</Button>
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
