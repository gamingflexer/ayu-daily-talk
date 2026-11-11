import { Screen, Header, Card, Checklist, Eyebrow, Button, Steps, PhoneIcon, TextLink } from '../components/ui.jsx';
import { HerVideo, CallControls } from '../components/call.jsx';
import { useT } from '../i18n/index.jsx';
import { go, href } from '../router.js';
import { FLOWS, FLOW_IDS } from '../data/flows.js';
import { getPersona } from '../../shared/personas.js';
import cameraUrl from '../assets/figma/icon-camera.svg';

export function FlowsIndex() {
  const { t } = useT();
  return (
    <Screen>
      <div className="body" style={{ paddingTop: 40 }}>
        <Eyebrow>{t('flows.eyebrow')}</Eyebrow>
        <h1 className="h1">{t('flows.title')}</h1>
        <p className="lead">{t('flows.lead')}</p>
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
        </ul>
      </div>
      <div className="foot">
        <TextLink href={href('/screens')}>{t('app.demoMap')}</TextLink>
      </div>
    </Screen>
  );
}

export function FlowPlayer({ id, step }) {
  const { t } = useT();
  const flow = FLOWS[id];
  if (!flow) return <FlowsIndex />;
  const i = Math.min(Math.max(step - 1, 0), flow.steps.length - 1);
  const s = flow.steps[i];
  const p = getPersona(flow.persona);
  const k = (x) => `flows.${id}.s${i + 1}.${x}`;
  const has = (x) => t(k(x)) !== k(x);
  const next = () => go(i + 1 < flow.steps.length ? `/flows/${id}/${i + 2}` : '/flows');
  const dark = ['call', 'network', 'phone', 'photo'].includes(s.kind);
  const nav = (
    <>
      <Steps count={flow.steps.length} at={i} />
      <p className="flow-note">
        <b>{i + 1} · </b>
        {t(k('note'))}
      </p>
    </>
  );

  if (s.kind === 'call') {
    const opts = t(k('options'));
    return (
      <Screen dark>
        <HerVideo height={s.options > 3 ? 150 : 200} pill={t(k('pill'))} />
        {s.herWords && <p className="her-words">“{t(k('herWords'))}”</p>}
        <div className="call-body">
          <h2 className="question">{t(k('question'))}</h2>
          {s.yesNo ? (
            <>
              <button className="answer" onClick={next}>
                {t('common.yes')}
              </button>
              <button className="answer" onClick={next}>
                {t('common.no')}
              </button>
            </>
          ) : (
            opts.map((o, n) => (
              <button key={o} className="answer" onClick={s.nextOn === 'any' || s.nextOn === n ? next : undefined}>
                {o}
              </button>
            ))
          )}
          {s.somethingElse && (
            <button className="answer" onClick={next}>
              {t('common.somethingElse')}
            </button>
          )}
          {(s.camera || s.yesNo) && (
            <button className="answer camera" onClick={next}>
              <img src={cameraUrl} alt="" width="30" height="26" />
              {has('camera') ? t(k('camera')) : t('common.notSure')}
            </button>
          )}
          {s.support && (
            <div className="dark-card">
              <p>{t(k('support'))}</p>
              <Button href="tel:14416">{t(k('supportCta'))}</Button>
            </div>
          )}
        </div>
        {nav}
        <CallControls onEnd={() => go('/flows')} onPause={() => {}} onCamera={() => {}} />
      </Screen>
    );
  }

  if (s.kind === 'network') {
    return (
      <Screen dark>
        <HerVideo height={420} pill={t(k('pill'))} live={false}>
          <div className="sheet">
            <h3>{t('s7.title')}</h3>
            <p>{t(k('body'))}</p>
            <Button onClick={next}>{t('s7.cta')}</Button>
          </div>
        </HerVideo>
        {nav}
        <CallControls onEnd={() => go('/flows')} onPause={() => {}} onCamera={() => {}} />
      </Screen>
    );
  }

  if (s.kind === 'phone') {
    return (
      <Screen dark>
        <div className="ring" aria-hidden="true" style={{ marginTop: 28 }}>
          <div>
            <PhoneIcon size={40} />
          </div>
        </div>
        <div className="call-body">
          <div className="dark-card">
            <p style={{ color: '#fff' }}>
              <strong>{t(k('question'))}</strong>
            </p>
            <p>{t(k('answer'))}</p>
            <div className="keypad">
              {['1', '2', '3'].map((n) => (
                <button key={n} onClick={n === '1' ? next : undefined}>
                  <b>{n}</b>
                  {t(`s8.key${n}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="dark-card" style={{ background: 'rgba(241,92,62,0.18)' }}>
            <strong>{t(k('rule'))}</strong>
            <p>{t(k('ruleBody'))}</p>
          </div>
        </div>
        {nav}
        <CallControls phone onEnd={() => go('/flows')} onPause={() => {}} />
      </Screen>
    );
  }

  if (s.kind === 'photo') {
    return (
      <Screen dark>
        <div className="viewfinder" style={{ minHeight: 380 }}>
          <div className="instr">
            <strong>{t(k('title'))}</strong>
            <span>{t(k('body'))}</span>
          </div>
          <div className="frame-box" style={{ aspectRatio: 1.2, width: '60%' }} />
          <p className="frame-label" style={{ top: 'calc(52% + 26%)' }}>
            {t(k('frame'))}
          </p>
        </div>
        <div className="shutter-row">
          <span style={{ width: 90 }} />
          <button className="shutter" onClick={next} aria-label={t('s9.shutter')} />
          <span style={{ width: 90 }} />
        </div>
        {nav}
      </Screen>
    );
  }

  // light screens
  return (
    <Screen className={dark ? 'dark' : ''}>
      <Header name={p.name} />
      <div className="body">
        <Eyebrow green={s.tone === 'tips'}>{t(k('eyebrow'))}</Eyebrow>
        <h1 className="h1">{t(k('title'))}</h1>
        {s.kind === 'today' && (
          <>
            <Card tone="dark">
              <h3>{t('s3.talkTitle')}</h3>
              <p>{t(k('talkBody'))}</p>
              <Button onClick={next}>{t('s3.start')}</Button>
            </Card>
            <Card>
              <h3>{t('s3.journey')}</h3>
              <Checklist items={t(k('items'))} />
            </Card>
          </>
        )}
        {s.kind === 'twoTalks' && (
          <>
            <Card tone="dark">
              <h3>{t('p.anita.babyTalk')}</h3>
              <p>{t('p.anita.babyTalkBody')}</p>
              <Button onClick={next}>{t('s3.start')}</Button>
            </Card>
            <Card tone="dark" style={{ background: 'var(--call-card)' }}>
              <h3>{t('p.anita.yourTalk')}</h3>
              <p>{t('p.anita.yourTalkBody')}</p>
            </Card>
          </>
        )}
        {s.kind === 'next' && (
          <>
            {has('why') && (
              <Card tone="wash">
                <p>{t(k('why'))}</p>
              </Card>
            )}
            <Card>
              <Checklist items={t(k('items'))} />
            </Card>
            {has('extra') && (
              <Card tone={s.tone === 'tips' ? 'muted' : 'green'}>
                <p>{t(k('extra'))}</p>
              </Card>
            )}
          </>
        )}
        {s.kind === 'list' && (
          <>
            <Card>
              <Checklist items={t(k('items'))} />
            </Card>
            {has('extra') && (
              <Card tone="plain">
                <p>{t(k('extra'))}</p>
              </Card>
            )}
          </>
        )}
      </div>
      {nav}
      <div className="foot">
        {s.kind !== 'today' && s.kind !== 'twoTalks' && (
          <Button onClick={next}>
            {has('cta') ? t(k('cta')) : i + 1 < flow.steps.length ? t('common.next') : t('common.done')}
          </Button>
        )}
      </div>
    </Screen>
  );
}
