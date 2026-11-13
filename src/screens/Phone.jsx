import { useEffect, useState } from 'react';
import { Screen, PhoneIcon } from '../components/ui.jsx';
import { CallControls } from '../components/call.jsx';
import { useT } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { go } from '../router.js';
import { handleTool, recordAnswer, restoreTalkState, snapshotTalk } from '../../shared/talk-state.js';

// S8 · Phone-call mode — no data needed. MOCK: the real PSTN bridge is a stub
// (server/phone/README.md). What IS real: keypad answers go through the same
// talk state and fixed red-flag rules as the video talk, and a talk that
// started on video (S7 → S8) keeps everything she already said.
//
// One keypad answer per question: 1 yes · 2 no · 3 not sure. A real bridge
// would ask follow-ups; here question 4 maps to "swelling of face or hands".
const QUESTIONS = {
  pregnant: [
    { key: 's8.q1' },
    { key: 's8.q2', signOnNo: 'reduced_fetal_movement' },
    { key: 's8.q3', sign: 'severe_headache' },
    { key: 's8.q4', sign: 'swelling_face_hands' },
  ],
  postnatal: [
    { key: 's8.q1' },
    { key: 's8.pnQ2', signOnNo: 'baby_poor_feeding' },
    { key: 's8.pnQ3', sign: 'baby_yellow_skin' },
    { key: 's8.pnQ4', sign: 'heavy_bleeding' },
  ],
};
const KEY_ANSWER = { 1: 'yes', 2: 'no', 3: 'not_sure' };

export function PhoneScreen({ fromTalk = false }) {
  const { t } = useT();
  const { persona, lastTalk, update } = useApp();
  const [secs, setSecs] = useState(() => (fromTalk && lastTalk?.startedAt ? Math.round((Date.now() - lastTalk.startedAt) / 1000) : 0));
  const [q, setQ] = useState(0);
  const [pressed, setPressed] = useState(null);
  const [paused, setPaused] = useState(false);
  // One talk state for the whole call (mutable, like the engines' state).
  const [talkState] = useState(() => restoreTalkState(persona, fromTalk && lastTalk?.partial ? lastTalk : null));
  const questions = QUESTIONS[persona.stage === 'postnatal' ? 'postnatal' : 'pregnant'];
  const continued = fromTalk && lastTalk?.partial && lastTalk.persona === persona.id;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [paused]);

  const press = (n) => {
    if (pressed) return;
    setPressed(n);
    const spec = questions[q];
    const state = talkState;
    const answer = KEY_ANSWER[n];
    // The keypad answer goes through the same card + rules path as a tap in the video talk.
    const { card } = handleTool(state, 'ask_yes_no', { question: t(spec.key), sign: spec.sign, not_sure_action: 'none' });
    recordAnswer(state, card, answer, { via: 'keypad' });
    if (spec.signOnNo && answer === 'no') handleTool(state, 'record_symptom', { sign: spec.signOnNo, her_words: `${t(spec.key)} — ${t('s8.key2')}` });
    setTimeout(() => {
      setPressed(null);
      if (q < questions.length - 1) return setQ(q + 1);
      const { finish } = handleTool(state, 'finish_talk', { by: 'phone' });
      const snap = snapshotTalk(state, { channel: 'phone' });
      update((prev) => ({ lastTalk: snap, plans: { ...prev.plans, [persona.id]: { ...(prev.plans?.[persona.id] || {}), ...snap.plan } } }));
      go(finish.referral.level === 'none' || finish.referral.level === 'watch' ? '/fine' : '/next');
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
          {continued ? t('s8.continued') : t('s8.stub')}
        </p>
      </div>
      <div className="call-body">
        <div className="dark-card">
          <p style={{ color: '#fff', fontSize: 15 }}>
            <strong>“{t(questions[q].key)}”</strong>
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
