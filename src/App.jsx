import { useCallback, useState } from 'react';
import { I18nProvider, useT } from './i18n/index.jsx';
import { AppProvider, useApp } from './state.jsx';
import { useRoute, href, go } from './router.js';
import { EntryScreen, OtpScreen } from './screens/Onboarding.jsx';
import { TodayScreen } from './screens/Today.jsx';
import { TalkScreen } from './screens/Talk.jsx';
import { PhoneScreen } from './screens/Phone.jsx';
import { PhotoView } from './screens/Photo.jsx';
import { NextStepScreen, AllFineScreen } from './screens/Outcomes.jsx';
import { BirthPlanScreen, ShareDoctorScreen } from './screens/Plans.jsx';
import { AshaScreen } from './screens/Asha.jsx';
import { FlowsIndex, FlowPlayer } from './screens/Flows.jsx';
import { ScreensIndex, SCREENS } from './screens/Index.jsx';
import { CallTest } from './screens/CallTest.jsx';
import { Chip, Button } from './components/ui.jsx';
import { PERSONA_IDS, getPersona } from '../shared/personas.js';
import { FLOW_IDS } from './data/flows.js';

export default function App() {
  return (
    <AppProvider>
      <WithLang />
    </AppProvider>
  );
}

function WithLang() {
  const { lang, update } = useApp();
  const setLang = useCallback((l) => update({ lang: l }), [update]);
  return (
    <I18nProvider lang={lang} setLang={setLang}>
      <Shell />
    </I18nProvider>
  );
}

/** Which note (from the Figma captions) belongs to the current route. */
function noteId(path, query) {
  if (path.startsWith('/flows/')) return null;
  if (path === '/talk') return { yesno: 's4', followup: 's5', danger: 's6', weak: 's7' }[query.demo] || 'talk';
  const s = SCREENS.find((x) => x.path === path);
  if (s) return s.id;
  return { '/asha': 'asha', '/flows': 'flows', '/screens': 'index' }[path] || null;
}

function Shell() {
  const { path, query } = useRoute();
  const { t } = useT();
  const [menu, setMenu] = useState(false);
  const openMenu = () => setMenu(true);

  if (path === '/call-test') return <CallTest />;

  let screen;
  let dark = false;
  const flow = path.match(/^\/flows\/([abc])\/(\d)$/);
  if (path === '/' || path === '') screen = <EntryScreen />;
  else if (path === '/otp') screen = <OtpScreen />;
  else if (path === '/today') screen = <TodayScreen openMenu={openMenu} />;
  else if (path === '/talk') {
    dark = true;
    screen = <TalkScreen key={query.demo || 'live'} demo={query.demo} forceMock={query.mode === 'mock'} />;
  } else if (path === '/phone') {
    dark = true;
    screen = <PhoneScreen />;
  } else if (path === '/photo') {
    dark = true;
    screen = <PhotoView purpose={query.purpose} onSkip={() => go('/today')} onPhoto={() => go('/today')} />;
  } else if (path === '/next') screen = <NextStepScreen openMenu={openMenu} />;
  else if (path === '/fine') screen = <AllFineScreen openMenu={openMenu} />;
  else if (path === '/plan') screen = <BirthPlanScreen openMenu={openMenu} />;
  else if (path === '/share') screen = <ShareDoctorScreen openMenu={openMenu} />;
  else if (path === '/asha') screen = <AshaScreen openMenu={openMenu} />;
  else if (path === '/flows') screen = <FlowsIndex />;
  else if (flow) screen = <FlowPlayer key={path} id={flow[1]} step={Number(flow[2])} />;
  else screen = <ScreensIndex />;

  if (flow) dark = ['call', 'network', 'phone', 'photo'].includes(flowKind(flow[1], Number(flow[2])));

  const nid = noteId(path, query);
  const flowNote = flow ? { title: t(`flows.${flow[1]}.title`), body: t(`flows.${flow[1]}.why`) } : null;

  return (
    <div className="stage">
      <nav className="stage-nav" aria-label={t('app.demoMap')}>
        <a href={href('/screens')} style={{ fontWeight: 700, color: 'var(--ink)' }}>
          {t('app.demoMap')}
        </a>
        <h2>{t('index.core')}</h2>
        {SCREENS.map((s) => (
          <a key={s.id} href={href(s.path)} className={nid === s.id ? 'on' : ''}>
            {s.id.toUpperCase()} · {t(`notes.${s.id}.title`)}
          </a>
        ))}
        <h2>{t('index.flows')}</h2>
        {FLOW_IDS.map((id) => (
          <a key={id} href={href(`/flows/${id}/1`)} className={flow?.[1] === id ? 'on' : ''}>
            {t(`flows.${id}.short`)}
          </a>
        ))}
        <a href={href('/asha')} className={path === '/asha' ? 'on' : ''}>
          {t('notes.asha.title')}
        </a>
        <h2>{t('index.live')}</h2>
        <a href={href('/talk')} className={path === '/talk' && !query.demo ? 'on' : ''}>
          {t('index.liveTalk')}
        </a>
        <a href={href('/call-test')}>{t('index.callTest')}</a>
      </nav>

      <div className={`device ${dark ? 'is-dark' : ''}`}>{screen}</div>

      <aside className="stage-notes">
        {flowNote ? (
          <>
            <h2>{flowNote.title}</h2>
            <p>{t(`flows.${flow[1]}.who`)}</p>
            <p>{flowNote.body}</p>
          </>
        ) : nid ? (
          <>
            <h2>{t(`notes.${nid}.title`)}</h2>
            <p>{t(`notes.${nid}.body`)}</p>
          </>
        ) : null}
        <span className="mock-tag">{t('app.mockBadge')}</span>
      </aside>

      {menu && <Menu close={() => setMenu(false)} />}
    </div>
  );
}

function flowKind(id, step) {
  const kinds = { a: ['today', 'call', 'call', 'next', 'list'], b: ['network', 'phone', 'next', 'list', 'list'], c: ['twoTalks', 'call', 'photo', 'next', 'call'] };
  return kinds[id]?.[step - 1];
}

/** Persona + language switcher, and links for reviewers. */
function Menu({ close }) {
  const { t, lang, setLang } = useT();
  const { personaId, update } = useApp();
  return (
    <div className="menu" onClick={close} role="dialog" aria-label={t('menu.title')}>
      <div onClick={(e) => e.stopPropagation()}>
        <h2 className="eyebrow">{t('menu.whose')}</h2>
        <div className="chips">
          {PERSONA_IDS.map((id) => (
            <Chip
              key={id}
              on={personaId === id}
              onClick={() => {
                update({ personaId: id, lastTalk: null });
                close();
              }}
            >
              {getPersona(id).name}
            </Chip>
          ))}
        </div>
        <h2 className="eyebrow">{t('common.language')}</h2>
        <div className="chips">
          <Chip on={lang === 'hi'} onClick={() => setLang('hi')}>
            हिंदी
          </Chip>
          <Chip on={lang === 'en'} onClick={() => setLang('en')}>
            English
          </Chip>
        </div>
        <h2 className="eyebrow">{t('menu.demo')}</h2>
        <div className="chips">
          <Chip href={href('/screens')} onClick={close}>
            {t('app.demoMap')}
          </Chip>
          <Chip href={href('/flows')} onClick={close}>
            {t('index.flows')}
          </Chip>
          <Chip href={href('/asha')} onClick={close}>
            ASHA
          </Chip>
          <Chip href={href('/call-test')} onClick={close}>
            {t('index.callTest')}
          </Chip>
        </div>
        <p className="small">{t('app.mockBadge')}</p>
        <Button onClick={close}>{t('common.close')}</Button>
      </div>
    </div>
  );
}
