import { useEffect, useState } from 'react';
import { Screen, PhoneIcon } from '../components/ui.jsx';
import { CallControls } from '../components/call.jsx';
import { useT } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { go } from '../router.js';

// S8 · Phone-call mode — no data needed. MOCK: the real PSTN bridge is a stub
// (server/phone/README.md). Keypad 1/2/3 answers the same questions.
const QUESTIONS = ['s8.q1', 's8.q2', 's8.q3'];

export function PhoneScreen() {
  const { t } = useT();
  const { persona } = useApp();
  const [secs, setSecs] = useState(252);
  const [q, setQ] = useState(0);
  const [pressed, setPressed] = useState(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [paused]);

  const press = (n) => {
    setPressed(n);
    setTimeout(() => {
      setPressed(null);
      if (q < QUESTIONS.length - 1) setQ(q + 1);
      else go('/fine');
    }, 900);
  };

  const time = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  return (
    <Screen dark>
      <div className="ring" aria-hidden="true">
        <div>
          <PhoneIcon size={44} />
        </div>
      </div>
      <div className="call-body" style={{ textAlign: 'center', paddingTop: 0 }}>
        <h1 className="question" style={{ margin: 0 }}>
          {t('s8.title')}
        </h1>
        <p className="hint" style={{ fontSize: 15 }}>
          {t('s8.meta', { time, language: persona.language })}
        </p>
        <p className="stub" style={{ margin: '4px 0 6px' }}>
          {t('s8.stub')}
        </p>
      </div>
      <div className="call-body">
        <div className="dark-card">
          <p style={{ color: '#fff', fontSize: 15 }}>
            <strong>“{t(QUESTIONS[q])}”</strong>
          </p>
          <p style={{ color: '#fff' }}>{t('s8.prompt')}</p>
          <div className="keypad">
            {['1', '2', '3'].map((n) => (
              <button key={n} onClick={() => press(n)} style={pressed === n ? { background: 'var(--coral)' } : undefined}>
                <b>{n}</b>
                {t(`s8.key${n}`)}
              </button>
            ))}
          </div>
          {pressed && <p>{t('s8.pressed', { n: pressed })}</p>}
          <p>{t('s8.note')}</p>
        </div>
      </div>
      <CallControls phone onEnd={() => go('/today')} paused={paused} onPause={() => setPaused((p) => !p)} />
    </Screen>
  );
}
