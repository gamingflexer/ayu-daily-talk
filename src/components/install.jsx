import { useEffect, useState } from 'react';
import { useT } from '../i18n/index.jsx';
import heartUrl from '../assets/brand/ayu-heart.svg';

// "Add to Home screen". Android Chrome fires beforeinstallprompt (captured in
// main.jsx); iPhone Safari has no prompt, so we show the Share-menu hint.
const DISMISS = 'ayu-install-dismissed';

function dismissed() {
  try {
    return localStorage.getItem(DISMISS) === '1';
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const { t } = useT();
  const [evt, setEvt] = useState(() => window.__ayuInstallEvent || null);
  const [hidden, setHidden] = useState(dismissed);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

  useEffect(() => {
    const on = () => setEvt(window.__ayuInstallEvent);
    window.addEventListener('ayu-install-ready', on);
    return () => window.removeEventListener('ayu-install-ready', on);
  }, []);

  if (hidden || standalone || (!evt && !ios)) return null;

  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS, '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className="install" role="dialog" aria-label={t('install.title')}>
      <img src={heartUrl} alt="" />
      <p>
        <strong>{t('install.title')}</strong>
        {ios && !evt ? t('install.iosHint') : t('install.body')}
      </p>
      {evt && (
        <button
          className="add"
          onClick={async () => {
            evt.prompt();
            await evt.userChoice.catch(() => null);
            window.__ayuInstallEvent = null;
            close();
          }}
        >
          {t('install.add')}
        </button>
      )}
      <button className="x" onClick={close} aria-label={t('common.close')}>
        ✕
      </button>
    </div>
  );
}
