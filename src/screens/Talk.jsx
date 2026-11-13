import { useEffect, useRef, useState } from 'react';
import { Screen, Button, TextLink } from '../components/ui.jsx';
import { HerVideo, CallControls, QuestionCard, CameraTurnPanel, videoHeightFor } from '../components/call.jsx';
import { useT } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { go } from '../router.js';
import { createMockTalk } from '../live/mock-live.js';
import { checkLive } from '../live/server.js';
import { watchNetwork } from '../live/network.js';
import { createTalkState, handleTool, recordAnswer, snapshotTalk, cameraPurposeFor } from '../../shared/talk-state.js';
import { PhotoView } from './Photo.jsx';

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const resultRoute = (level) => (level === 'none' || level === 'watch' ? '/fine' : '/next');

/** Static Figma states S4–S7, for the screens map. */
function presetCard(demo, t) {
  if (demo === 'yesno' || demo === 'weak')
    return { id: 'p4', kind: 'yes_no', question: t('mock.qSwelling'), notSure: 'camera', pictureSet: 'feet_swelling', sign: 'swelling_feet' };
  if (demo === 'followup')
    return {
      id: 'p5',
      kind: 'single',
      question: t('mock.qPainKind'),
      herWords: t('mock.herPain'),
      options: [{ label: t('mock.painTight') }, { label: t('mock.painSharp') }, { label: t('mock.painBurning') }],
      somethingElse: true,
    };
  if (demo === 'danger')
    return {
      id: 'p6',
      kind: 'multi',
      question: t('mock.qDanger'),
      options: ['severe_headache', 'blurred_vision', 'swelling_face_hands', 'bleeding', 'reduced_fetal_movement'].map((s) => ({
        label: t(`signs.${s}`),
        sign: s,
      })),
      noneOption: true,
    };
  return null;
}
const PRESET_TIME = { yesno: 102, followup: 150, danger: 185, weak: 200 };

export function TalkScreen({ demo, forceMock, net }) {
  const { t, lang } = useT();
  const { persona, update } = useApp();
  const [card, setCard] = useState(() => presetCard(demo, t));
  const [caption, setCaption] = useState(null);
  const [status, setStatus] = useState(demo ? 'live' : 'connecting');
  const [mode, setMode] = useState(demo ? 'demo' : null);
  const [paused, setPaused] = useState(false);
  const [cam, setCam] = useState(null); // her own (front) camera, from the control bar
  const [camTurn, setCamTurn] = useState(null); // {purpose, stream} — "Not sure" → back camera
  const [weak, setWeak] = useState(demo === 'weak' || net === 'weak');
  const [secs, setSecs] = useState(PRESET_TIME[demo] || 0);
  const [level, setLevel] = useState(0);
  const [photo, setPhoto] = useState(null); // {purpose, cardId}
  const [notice, setNotice] = useState('');
  const engineRef = useRef(null);
  const turnRef = useRef({ who: null, done: true });
  const finishedRef = useRef(false);
  const urgentTimer = useRef(null);
  const camTurnRef = useRef(null);
  camTurnRef.current = camTurn;

  // Live or mock engine.
  useEffect(() => {
    if (demo) return;
    let alive = true;
    let off = null;
    (async () => {
      const live = forceMock ? { live: false } : await checkLive();
      if (!alive) return;
      // The Gemini SDK is loaded only when live mode is on (keeps the mock app small).
      const gemini = live.live ? await import('../live/gemini-live.js') : null;
      if (!alive) return;
      const mk = (useLive) => (useLive ? gemini.createGeminiTalk({ persona, lang }) : createMockTalk({ persona, lang, t }));
      let engine = mk(live.live);
      engineRef.current = engine;
      setMode(engine.mode);
      off = engine.on(onEvent);
      try {
        await engine.start();
      } catch (err) {
        if (!alive) return;
        // Live failed (no key, cap reached, no mic, network) → keep going in mock mode.
        off?.();
        engine.end();
        setNotice(t('call.fellBackToMock', { reason: err.message }));
        engine = mk(false);
        engineRef.current = engine;
        setMode('mock');
        off = engine.on(onEvent);
        await engine.start();
      }
    })();
    return () => {
      alive = false;
      clearTimeout(urgentTimer.current);
      off?.();
      engineRef.current?.end();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, persona.id, lang]);

  // Talk clock (and the 5-minute limit, which the engine enforces).
  useEffect(() => {
    if (demo || status !== 'live' || paused) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [demo, status, paused]);
  useEffect(() => {
    if (!demo) engineRef.current?.timeCheck?.(secs);
  }, [demo, secs]);

  // Weak network → offer a phone call (S7): connection info, offline, RTT probe (live only).
  useEffect(() => {
    if (demo || !mode) return;
    return watchNetwork({ onWeak: () => setWeak(true), probe: mode === 'gemini' });
  }, [demo, mode]);

  // Stop cameras when leaving.
  useEffect(() => () => cam?.getTracks().forEach((x) => x.stop()), [cam]);
  useEffect(() => () => camTurnRef.current?.stream?.getTracks().forEach((x) => x.stop()), []);

  function saveTalk(extra) {
    const engine = engineRef.current;
    if (!engine) return null;
    const snap = snapshotTalk(engine.state, extra);
    update((prev) => ({
      lastTalk: snap,
      plans: { ...prev.plans, [persona.id]: { ...(prev.plans?.[persona.id] || {}), ...snap.plan } },
    }));
    return snap;
  }

  function onEvent(e) {
    // Dev only: a log the browser tests read (tool calls, cards, referral, finish).
    if (import.meta.env.DEV && e.type !== 'level' && e.type !== 'caption') {
      (window.__ayuTalkLog ||= []).push({ t: Date.now(), type: e.type, name: e.name, args: e.args, card: e.card?.kind, level: e.referral?.level, status: e.status, detail: e.detail });
    }
    if (import.meta.env.DEV && e.type === 'caption') (window.__ayuCaptions ||= []).push(`${e.who}:${e.text}`);
    switch (e.type) {
      case 'status':
        setStatus(e.status);
        // The socket dropped before the talk was done → offer the phone call (S7).
        if (e.unexpected && !finishedRef.current) {
          setWeak(true);
          setNotice(t('call.weakSocket'));
        }
        break;
      case 'caption': {
        const turn = turnRef.current;
        if (e.who === 'her' && !e.partial) {
          setCaption({ who: 'her', text: e.text });
          turnRef.current = { who: 'her', done: true };
          break;
        }
        setCaption((prev) => {
          const append = prev && turn.who === e.who && !turn.done;
          return { who: e.who, text: append ? prev.text + e.text : e.text.trimStart() };
        });
        turnRef.current = { who: e.who, done: false };
        break;
      }
      case 'turn-complete':
        turnRef.current = { ...turnRef.current, done: true };
        break;
      case 'card':
        setCard(e.card);
        break;
      case 'referral':
        // The rules said see today / call 108: if the model has not finished 25 s later, the app does.
        if ((e.referral.level === 'see_today' || e.referral.level === 'emergency') && !urgentTimer.current) {
          urgentTimer.current = setTimeout(() => {
            if (!finishedRef.current) engineRef.current?.finishLocal('rules');
          }, 25000);
        }
        break;
      case 'tool-cancel':
        setCard((c) => (c?.callId && e.ids.includes(c.callId) ? null : c));
        break;
      case 'level':
        setLevel(e.rms);
        break;
      case 'finish': {
        if (finishedRef.current) break;
        finishedRef.current = true;
        const snap = saveTalk();
        stopCamTurn(false);
        // Let Ayu finish the sentence she is saying (max 8 s), then show S10 / S11.
        const t0 = Date.now();
        const tick = () => {
          const speaking = engineRef.current?.speaking;
          if ((speaking && Date.now() - t0 < 8000) || Date.now() - t0 < 1400) return setTimeout(tick, 300);
          go(resultRoute(snap?.referral.level || e.referral.level));
        };
        setTimeout(tick, 300);
        break;
      }
      default:
    }
  }

  function answer(a, meta = {}) {
    if (!card) return;
    if (demo) return answerDemo(a, meta);
    engineRef.current?.answer(card.id, a, { yes: t('common.yes'), no: t('common.no'), not_sure: t('common.notSure') }, meta);
    setCard(null);
    if (camTurn) stopCamTurn();
  }

  // Screens-map mode: walk S4 → S5 → S6 → S10 / S11 without an engine.
  function answerDemo(a, meta) {
    if (demo === 'yesno' || demo === 'weak') return go('/talk?demo=followup');
    if (demo === 'followup') return go('/talk?demo=danger');
    if (demo === 'danger') {
      const s = createTalkState(persona);
      const { card: c } = handleTool(s, 'ask_multi_choice', { question: card.question, options: card.options });
      recordAnswer(s, c, a, meta);
      handleTool(s, 'finish_talk', { by: 'demo' });
      const snap = snapshotTalk(s);
      update({ lastTalk: snap });
      return go(resultRoute(snap.referral.level));
    }
  }

  /** "Not sure" → camera turn: back camera on, frames ≤1 fps to the model, Ayu says what she sees. */
  async function startCamTurn() {
    const purpose = cameraPurposeFor(card);
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 } },
        audio: false,
      });
    } catch {
      setNotice(t('call.noCamera'));
      return answer('not_sure');
    }
    if (cam) {
      cam.getTracks().forEach((x) => x.stop());
      setCam(null);
    }
    setCamTurn({ purpose, stream });
    if (!demo) engineRef.current?.startCameraTurn(card.id, stream, purpose);
    setCard(null);
  }

  function stopCamTurn(tellEngine = true) {
    const ct = camTurnRef.current;
    if (!ct) return;
    ct.stream.getTracks().forEach((x) => x.stop());
    setCamTurn(null);
    if (tellEngine) engineRef.current?.endCameraTurn();
    if (demo) go('/talk?demo=followup');
  }

  async function toggleCamera() {
    if (cam) {
      cam.getTracks().forEach((x) => x.stop());
      setCam(null);
      engineRef.current?.setCamera(null);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } } });
      setCam(s);
      engineRef.current?.setCamera(s);
    } catch {
      setNotice(t('call.noCamera'));
    }
  }

  function onCamera() {
    // A photo card asks for a still photo (S9); everything else is a live camera turn.
    if (card?.kind === 'photo') return setPhoto({ purpose: card.purpose, cardId: card.id });
    startCamTurn();
  }

  function end() {
    const engine = engineRef.current;
    const said = engine && (engine.state.answers.length || engine.state.symptoms.length);
    if (said && !finishedRef.current) return engine.finishLocal('ended');
    engine?.end();
    go('/today');
  }

  function toPhone() {
    if (engineRef.current && !finishedRef.current) saveTalk({ partial: true });
    stopCamTurn(false);
    engineRef.current?.end();
    go('/phone?from=talk');
  }

  if (photo) {
    return (
      <PhotoView
        purpose={photo.purpose}
        mockRead={mode !== 'gemini'}
        onSkip={() => setPhoto(null)}
        onPhoto={(b64, result) => {
          if (b64) engineRef.current?.sendPhoto(b64, photo.purpose);
          if (photo.cardId && engineRef.current) {
            engineRef.current.answer(photo.cardId, result === 'not_this' ? 'photo: not this tablet' : 'photo sent');
            setCard(null);
          }
          setPhoto(null);
          if (demo) go('/talk?demo=followup');
        }}
      />
    );
  }

  const postnatal = persona.stage === 'postnatal';
  const pill = postnatal
    ? t('call.pillPostnatal', { days: persona.daysAfterBirth, time: fmt(secs) })
    : t('call.pill', { weeks: persona.weeks, time: fmt(secs) });
  const modeTag = mode === 'gemini' ? t('call.liveMode') : mode === 'mock' ? t('call.mockMode') : null;
  const videoH = weak ? 360 : camTurn && !card ? 330 : videoHeightFor(card);
  // Captions sit on the video; on the small tile (long answer lists) the question card says it already.
  const showCaption = caption && videoH >= 200 && (!card || caption.who === 'ayu') ? caption : null;

  return (
    <Screen dark>
      <HerVideo
        height={videoH}
        stream={camTurn?.stream || cam}
        back={Boolean(camTurn)}
        pill={pill}
        live={status === 'live' && !paused}
        modeTag={modeTag}
        caption={showCaption}
      >
        {weak && (
          <div className="sheet" role="dialog" aria-label={t('s7.title')}>
            <h3>{t('s7.title')}</h3>
            <p>{t('s7.body')}</p>
            <Button onClick={toPhone}>{t('s7.cta')}</Button>
            <TextLink onClick={() => setWeak(false)}>{t('s7.keepVideo')}</TextLink>
          </div>
        )}
      </HerVideo>

      {card?.herWords && <p className="her-words">“{card.herWords}”</p>}

      <div className={`call-body ${card?.kind === 'multi' ? 'compact' : ''}`} aria-live="polite">
        {weak ? null : card ? (
          <QuestionCard key={card.id} card={card} onAnswer={answer} onCamera={onCamera} />
        ) : camTurn ? (
          <CameraTurnPanel purpose={camTurn.purpose} onDone={() => stopCamTurn()} />
        ) : (
          <p className="hint" style={{ fontSize: 15, paddingTop: 8 }}>
            {status === 'connecting' ? t('call.connecting') : paused ? t('call.paused') : status === 'ended' ? t('call.ended') : t('call.listening')}
          </p>
        )}
        {notice && <p className="hint" style={{ color: '#f5b041' }}>{notice}</p>}
        {!demo && !weak && !card && !camTurn && (
          <button className="hint" style={{ textAlign: 'left', textDecoration: 'underline' }} onClick={() => setWeak(true)}>
            {t('s7.simulate')}
          </button>
        )}
      </div>

      <CallControls
        onEnd={end}
        paused={paused}
        level={level}
        onPause={() => {
          setPaused((p) => !p);
          engineRef.current?.pause(!paused);
        }}
        cameraOn={Boolean(cam)}
        onCamera={toggleCamera}
      />
    </Screen>
  );
}
