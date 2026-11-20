import { useCallback, useEffect } from 'react';
import { I18nProvider } from './i18n/index.jsx';
import { StoreProvider, useStore } from './store.jsx';
import { useRoute, go, swap, match } from './router.js';
import { WelcomeScreen } from './patient/Welcome.jsx';
import { StartWoman, StartAsha } from './patient/Start.jsx';
import { HomeScreen } from './patient/Home.jsx';
import { CheckScreen } from './patient/Check.jsx';
import { ResultScreen } from './patient/Result.jsx';
import { HelpScreen } from './patient/Help.jsx';
import { MeScreen } from './patient/Me.jsx';
import { TellScreen } from './tell/Tell.jsx';
import { beginTell } from './live/media.js';
import { AshaRoutes } from './asha/index.jsx';

export default function App() {
  return (
    <StoreProvider>
      <WithLang />
    </StoreProvider>
  );
}

function WithLang() {
  const { lang, setLang } = useStore();
  const set = useCallback((l) => setLang(l), [setLang]);
  return (
    <I18nProvider lang={lang} setLang={set}>
      <div className="app">
        <Routes />
      </div>
    </I18nProvider>
  );
}

/** Send her to `to` after render (never navigate while rendering). */
function Redirect({ to }) {
  useEffect(() => {
    swap(to);
  }, [to]);
  return null;
}

function Routes() {
  const { path, query } = useRoute();
  const { role, woman, asha } = useStore();
  const homeOf = role === 'asha' && asha ? '/asha' : role === 'woman' && woman ? '/home' : null;

  if (path === '/' || path === '') return homeOf ? <Redirect to={homeOf} /> : <WelcomeScreen />;
  if (path === '/start/woman') return <StartWoman />;
  if (path === '/start/asha') return <StartAsha />;

  // The ASHA app needs an ASHA on this phone.
  if (path === '/asha' || path.startsWith('/asha/')) {
    if (!asha) return <Redirect to="/" />;
    return <AshaRoutes path={path} query={query} />;
  }

  if (path === '/me') return homeOf ? <MeScreen /> : <Redirect to="/" />;

  // Everything below is one woman's app (her own phone, or opened for her by the ASHA).
  if (!woman) return <Redirect to={homeOf || '/'} />;
  const result = match('/result/:id', path);
  if (result) return <ResultScreen key={result.id} id={result.id} />;
  if (path === '/home')
    return (
      <HomeScreen
        onTell={() => {
          // Ask for the mic inside her tap (iOS only grants it in a user gesture), then open the screen.
          beginTell();
          go('/tell');
        }}
      />
    );
  if (path === '/check') return <CheckScreen />;
  if (path === '/tell') return <TellScreen />;
  if (path === '/help') return <HelpScreen />;
  return <Redirect to="/home" />;
}
