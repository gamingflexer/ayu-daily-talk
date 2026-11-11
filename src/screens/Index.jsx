import { Screen, Eyebrow, Logo } from '../components/ui.jsx';
import { useT } from '../i18n/index.jsx';
import { href } from '../router.js';
import { FLOW_IDS } from '../data/flows.js';

// Screen map: every Figma screen and flow, one tap away (for reviewers).
export const SCREENS = [
  { id: 's1', path: '/' },
  { id: 's2', path: '/otp' },
  { id: 's3', path: '/today' },
  { id: 's4', path: '/talk?demo=yesno' },
  { id: 's5', path: '/talk?demo=followup' },
  { id: 's6', path: '/talk?demo=danger' },
  { id: 's7', path: '/talk?demo=weak' },
  { id: 's8', path: '/phone' },
  { id: 's9', path: '/photo' },
  { id: 's10', path: '/next' },
  { id: 's11', path: '/fine' },
  { id: 's12', path: '/plan' },
  { id: 's13', path: '/share' },
];

export function ScreensIndex() {
  const { t } = useT();
  return (
    <Screen>
      <div className="body" style={{ paddingTop: 40, paddingBottom: 30 }}>
        <Logo width={96} />
        <Eyebrow>{t('index.eyebrow')}</Eyebrow>
        <h1 className="h1">{t('index.title')}</h1>
        <p className="lead">{t('index.lead')}</p>
        <span className="badge">{t('app.mockBadge')}</span>

        <h2 className="eyebrow" style={{ marginTop: 10 }}>
          {t('index.live')}
        </h2>
        <ul className="index-list">
          <li>
            <a href={href('/talk')}>
              <span>
                {t('index.liveTalk')}
                <br />
                <small>{t('index.liveTalkSub')}</small>
              </span>
              <span aria-hidden="true">→</span>
            </a>
          </li>
          <li>
            <a href={href('/call-test')}>
              <span>
                {t('index.callTest')}
                <br />
                <small>{t('index.callTestSub')}</small>
              </span>
              <span aria-hidden="true">→</span>
            </a>
          </li>
        </ul>

        <h2 className="eyebrow" style={{ marginTop: 10 }}>
          {t('index.core')}
        </h2>
        <ul className="index-list">
          {SCREENS.map((s) => (
            <li key={s.id}>
              <a href={href(s.path)}>
                <span>
                  {s.id.toUpperCase()} · {t(`notes.${s.id}.title`)}
                </span>
                <span aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ul>

        <h2 className="eyebrow" style={{ marginTop: 10 }}>
          {t('index.flows')}
        </h2>
        <ul className="index-list">
          {FLOW_IDS.map((id) => (
            <li key={id}>
              <a href={href(`/flows/${id}/1`)}>
                <span>
                  {t(`flows.${id}.title`)}
                  <br />
                  <small>{t(`flows.${id}.who`)}</small>
                </span>
                <span aria-hidden="true">→</span>
              </a>
            </li>
          ))}
          <li>
            <a href={href('/asha')}>
              <span>{t('notes.asha.title')}</span>
              <span aria-hidden="true">→</span>
            </a>
          </li>
        </ul>
        <p className="small">{t('index.foot')}</p>
      </div>
    </Screen>
  );
}
