import { useEffect, useReducer, useRef, useState } from 'react';
import { Screen, Button, TextLink } from '../components/ui.jsx';
import { HerVideo, CallControls, QuestionCard, CameraTurnPanel, StateChip, Spinner } from '../components/call.jsx';
import { useT } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { go } from '../router.js';
import { createMockTalk } from '../live/mock-live.js';
import { checkLive } from '../live/server.js';
import { watchNetwork } from '../live/network.js';
import { beginTalkMedia, takeTalkMedia, openCamera, stopStream } from '../live/media.js';
import { cardQueue } from '../live/tool-flow.js';
import { nextPhase } from '../live/phase.js';
import { createTalkState, handleTool, recordAnswer, snapshotTalk, cameraPurposeFor, CAMERA_SETS } from '../../shared/talk-state.js';
import { PhotoView } from './Photo.jsx';

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const resultRoute = (level) => (level === 'none' || level === 'watch' ? '/fine' : '/next');
/** If Ayu has not started replying this long after a tap, the card goes anyway. */
const PENDING_MAX_MS = 9000;

/** Static Figma states S4–S7, for the screens map. */
function presetCard(demo, t) {
  if (demo === 'yesno' || demo === 'weak')
    return { id: 'p4', kind: 'yes_no', question: t('mock.qSwelling'), notSure: 'camera', pictureSet: 'feet_swelling', sign: 'swelling_feet', explain: t('mock.explainSwelling') };
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
      explain: t('mock.explainDanger'),
      options: ['severe_headache', 'blurred_vision', 'swelling_face_hands', 'bleeding', 'reduced_fetal_movement'].map((s) => ({
        label: t(`signs.${s}`),
        sign: s,
      })),
      noneOption: true,
    };
  if (demo === 'body') return { id: 'pb', kind: 'body', question: t('mock.qWhere'), explain: t('mock.explainWhere') };
  if (demo === 'duration') return { id: 'pd', kind: 'duration', question: t('mock.qSince'), options: ['lt_day', 'day_week', 'week_month', 'gt_month'], explain: t('mock.explainSince') };
  if (demo === 'severity') return { id: 'ps', kind: 'severity', question: t('mock.qSeverity'), options: ['mild', 'moderate', 'severe'], explain: t('mock.explainSeverity') };
  if (demo === 'search') return { id: 'pq', kind: 'search', question: t('mock.qAnything'), explain: t('mock.explainAnything') };
  return null;
}
const PRESET_TIME = { yesno: 102, followup: 150, danger: 185, weak: 200, body: 160, duration: 168, severity: 175, search: 190 };

export function TalkScreen({ demo, forceMock, net, drop }) {
  const { t, lang } = useT();
  const { persona, update } = useApp();
  const [queue, dispatch] = useReducer(cardQueue, null, () => {
    const c = presetCard(demo, t);
    return c ? [c] : [];
  });
  const card = queue[0] || null;
  const [phase, setPhase] = useState(demo ? 'listening' : 'ready');
  const [attempt, setAttempt] = useState(0); // "Start again" after an error
  const [media, setMedia] = useState(null); // promise from her tap
  const [caption, setCaption] = useState(null);
  const [mode, setMode] = useState(demo ? 'demo' : null);
  const [paused, setPaused] = useState(false);
  const [front, setFront] = useState(null); // her own (front) camera
  const [back, setBack] = useState(null); // back camera: a picture card or "Not sure"
  const [camState, setCamState] = useState('off'); // off | blocked | starting
  const [camTurn, setCamTurn] = useState(null); // {purpose} — "Not sure" → back camera
  const [weak, setWeak] = useState(demo === 'weak' || net === 'weak');
  const [secs, setSecs] = useState(PRESET_TIME[demo] || 0);
  const [micLevel, setMicLevel] = useState(0);
  const [outLevel, setOutLevel] = useState(0);
  const [photo, setPhoto] = useState(null); // {purpose, cardId}
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(null); // {cardId, key}
  const [answered, setAnswered] = useState([]); // cards she answered, for "Previous"
  const [editing, setEditing] = useState(null); // a card she went back to
  const [done, setDone] = useState(null); // finish → "That's all for today"
  const [micError, setMicError] = useState(false);
  const engineRef = useRef(null);
  const turnRef = useRef({ who: null, done: true });
  const finishedRef = useRef(false);
  const urgentTimer = useRef(null);
  const pendingTimer = useRef(null);
  const live = useRef({ front: null, back: null, card: null, pending: null });
  live.current = { front, back, card, pending, camTurn };

  // The tap on Today ("Start talking") already asked for mic + camera; pick that up.
  useEffect(() => {
    if (demo) return;
    const p = takeTalkMedia();
    if (p) setMedia(p);
  }, [demo]);

  // Start the engine once mic (+ camera) are settled.
  useEffect(() => {
    if (demo || !media) return;
    let alive = true;
    let off = null;
    setPhase('permissions');
    setMicError(false);
    (async () => {
      const m = await media;
      if (!alive) return stopAll(m);
      if (!m.audio) {
        setMicError(true);
        setPhase('error');
        return;
      }
      // Camera refused or missing → voice-only, with "Camera off — Ayu can only hear you" and a button to try again.
      if (m.video) setFront(m.video);
      setCamState('off');
      setPhase('connecting');
      const liveOn = forceMock ? { live: false } : await checkLive();
      if (!alive) return;
      // The Gemini SDK is loaded only when live mode is on (keeps the mock app small).
      const gemini = liveOn.live ? await import('../live/gemini-live.js') : null;
      if (!alive) return;
      const mk = (useLive) => (useLive ? gemini.createGeminiTalk({ persona, lang }) : createMockTalk({ persona, lang, t }));
      let engine = mk(liveOn.live);
      engineRef.current = engine;
      setMode(engine.mode);
      off = engine.on(onEvent);
      try {
        await engine.start({ stream: m.audio });
      } catch (err) {
        if (!alive) return;
        // Live failed (no key, cap reached, network) → keep going in mock mode.
        off?.();
        engine.end();
        setNotice(t('call.fellBackToMock', { reason: err.message }));
        engine = mk(false);
        engineRef.current = engine;
        setMode('mock');
        off = engine.on(onEvent);
        await engine.start({ stream: m.audio });
      }
      // Frames go to the model (≤1 fps) only while a camera is on.
      if (alive) engine.setCamera(live.current.back || live.current.front || null);
      if (alive && drop) setTimeout(() => engineRef.current?.simulateDrop?.(), 6000);
    })();
    return () => {
      alive = false;
      clearTimeout(urgentTimer.current);
      clearTimeout(pendingTimer.current);
      off?.();
      engineRef.current?.end();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, media, attempt, persona.id, lang]);

  function stopAll(m) {
    stopStream(m?.audio);
    stopStream(m?.video);
  }

  // Talk clock (and the 5-minute limit, which the engine enforces).
  const running = !demo && !paused && ['listening', 'speaking', 'thinking', 'checking'].includes(phase);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (!demo) engineRef.current?.timeCheck?.(secs);
  }, [demo, secs]);

  // Weak network → offer a phone call (S7): connection info, offline, RTT probe (live only).
  useEffect(() => {
    if (demo || !mode) return;
    return watchNetwork({ onWeak: () => setWeak(true), probe: mode === 'gemini' });
  }, [demo, mode]);

  // Stop cameras when leaving.
  useEffect(() => () => stopStream(front), [front]);
  useEffect(() => () => stopStream(back), [back]);

  // A card that needs a look turns the right camera on by itself (no extra tap).
  useEffect(() => {
    if (demo || !card || done) return;
    if (card.kind === 'photo') {
      setPhoto({ purpose: card.purpose, cardId: card.id });
      return;
    }
    if (CAMERA_SETS.has(card.pictureSet) && !live.current.back) switchToBack(cameraPurposeFor(card), { tell: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id]);

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

  /** Ayu started replying (voice, a new card, or the camera turn): the tapped card can go. */
  function settlePending() {
    const p = live.current.pending;
    if (!p) return;
    clearTimeout(pendingTimer.current);
    setPending(null);
    dispatch({ type: 'answered', id: p.cardId });
  }

  function onEvent(e) {
    // Dev only: a log the browser tests read (tool calls, cards, referral, finish, phases).
    if (import.meta.env.DEV && !['level', 'out-level', 'caption'].includes(e.type)) {
      (window.__ayuTalkLog ||= []).push({ t: Date.now(), type: e.type, name: e.name, args: e.args, card: e.card?.kind, level: e.referral?.level, status: e.status, on: e.on, question: e.question });
    }
    if (import.meta.env.DEV && e.type === 'caption') (window.__ayuCaptions ||= []).push(`${e.who}:${e.text}`);
    setPhase((p) => nextPhase(p, e));
    switch (e.type) {
      case 'status':
        // The socket dropped for good before the talk was done → offer the phone call (S7).
        if (e.status === 'ended' && e.unexpected && !finishedRef.current) {
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
      case 'speaking':
        if (e.on) settlePending();
        break;
      case 'card':
        settlePending();
        dispatch({ type: 'add', card: e.card });
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
        dispatch({ type: 'cancel', ids: e.ids });
        break;
      case 'level':
        setMicLevel(e.rms);
        break;
      case 'out-level':
        setOutLevel(e.rms);
        break;
      case 'finish': {
        if (finishedRef.current) break;
        finishedRef.current = true;
        const snap = saveTalk();
        settlePending();
        dispatch({ type: 'clear' });
        stopCamTurn(false);
        const level = snap?.referral.level || e.referral.level;
        setDone({ level });
        // Let Ayu finish the sentence she is saying (max 8 s), and give her time to read "That's all for today".
        const t0 = Date.now();
        const tick = () => {
          if (!engineRef.current) return;
          const speaking = engineRef.current.speaking;
          if ((speaking && Date.now() - t0 < 8000) || Date.now() - t0 < 2600) return setTimeout(tick, 300);
          go(resultRoute(level));
        };
        setTimeout(tick, 300);
        break;
      }
      default:
    }
  }

  function answer(a, meta = {}) {
    if (!card || pending) return;
    if (demo) return answerDemo(a, meta);
    const key = meta.picture || (Array.isArray(a) ? (a.length ? '__done' : '__none') : a);
    engineRef.current?.answer(card.id, a, { yes: t('common.yes'), no: t('common.no'), not_sure: t('common.notSure') }, meta);
    setAnswered((h) => [...h.filter((x) => x.id !== card.id), card].slice(-10));
    setPending({ cardId: card.id, key: matchKey(card, a, meta, key) });
    clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(settlePending, PENDING_MAX_MS);
    if (live.current.back && !camTurn) switchToFront();
  }

  function changeAnswer(a, meta = {}) {
    const c = editing;
    setEditing(null);
    if (!c) return;
    if (demo) return;
    engineRef.current?.changeAnswer(c.id, a, { yes: t('common.yes'), no: t('common.no'), not_sure: t('common.notSure') }, meta);
  }

  // Screens-map mode: walk S4 → S5 → S6 → S10 / S11 without an engine.
  function answerDemo(a, meta) {
    if (demo === 'yesno' || demo === 'weak') return go('/talk?demo=followup');
    if (demo === 'followup') return go('/talk?demo=body');
    if (demo === 'body') return go('/talk?demo=duration');
    if (demo === 'duration') return go('/talk?demo=severity');
    if (demo === 'severity') return go('/talk?demo=search');
    if (demo === 'search') return go('/talk?demo=danger');
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

  /** Back camera on (a picture card, or "Not sure"). Front goes off: phones run one camera at a time. */
  async function switchToBack(purpose, { tell = false } = {}) {
    const f = live.current.front;
    if (f) {
      stopStream(f);
      setFront(null);
    }
    setCamState('starting');
    try {
      const s = await openCamera('environment');
      setBack(s);
      setCamState('off');
      engineRef.current?.setCamera(s);
      if (tell) engineRef.current?.cameraFor?.(purpose);
      return s;
    } catch {
      // Blocked without a tap (iOS) or refused: one big button in the tile, then carry on.
      setCamState('blocked');
      engineRef.current?.setCamera(null);
      return null;
    }
  }

  async function switchToFront() {
    const b = live.current.back;
    if (b) {
      stopStream(b);
      setBack(null);
    }
    try {
      const s = await openCamera('user');
      setFront(s);
      setCamState('off');
      engineRef.current?.setCamera(s);
    } catch {
      setCamState('blocked');
      engineRef.current?.setCamera(null);
    }
  }

  /** "Not sure" → camera turn: back camera on, frames ≤1 fps to the model, Ayu says what she sees. */
  async function startCamTurn() {
    const purpose = cameraPurposeFor(card);
    const s = live.current.back || (await switchToBack(purpose));
    if (!s) {
      setNotice(t('call.noCamera'));
      return answer('not_sure', { label: t('common.notSure') });
    }
    setCamTurn({ purpose });
    if (!demo) engineRef.current?.startCameraTurn(card.id, s, purpose);
    setAnswered((h) => [...h.filter((x) => x.id !== card.id), card].slice(-10));
    dispatch({ type: 'answered', id: card.id });
  }

  function stopCamTurn(tellEngine = true) {
    if (!live.current.camTurn) return;
    setCamTurn(null);
    if (tellEngine) engineRef.current?.endCameraTurn();
    if (demo) return go('/talk?demo=followup');
    switchToFront();
  }

  /** The camera button: her front camera on/off. From a tap, so iOS allows it. */
  async function toggleCamera() {
    if (front || back) {
      stopStream(front);
      stopStream(back);
      setFront(null);
      setBack(null);
      setCamState('off');
      engineRef.current?.setCamera(null);
      return;
    }
    if (camTurn || CAMERA_SETS.has(card?.pictureSet)) return switchToBack(cameraPurposeFor(card));
    setCamState('starting');
    try {
      const s = await openCamera('user');
      setFront(s);
      setCamState('off');
      engineRef.current?.setCamera(s);
    } catch {
      setCamState('off');
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

  /** The talk starts from her tap, so the browser lets us ask for mic + camera (iOS Safari). */
  function startFromTap() {
    setMedia(beginTalkMedia());
    setAttempt((n) => n + 1);
  }

  if (photo) {
    return (
      <PhotoView
        purpose={photo.purpose}
        mockRead={mode !== 'gemini'}
        onSkip={() => {
          setPhoto(null);
          if (photo.cardId && engineRef.current) {
            engineRef.current.answer(photo.cardId, 'skip_photo');
            dispatch({ type: 'answered', id: photo.cardId });
          }
        }}
        onPhoto={(b64, result) => {
          if (b64) engineRef.current?.sendPhoto(b64, photo.purpose);
          if (photo.cardId && engineRef.current) {
            engineRef.current.answer(photo.cardId, result === 'not_this' ? 'photo: not this tablet' : 'photo sent');
            dispatch({ type: 'answered', id: photo.cardId });
          }
          setPhoto(null);
          if (!demo) switchToFront();
          if (demo) go('/talk?demo=followup');
        }}
      />
    );
  }

  const postnatal = persona.stage === 'postnatal';
  const pill = postnatal
    ? t('call.pillPostnatal', { days: persona.daysAfterBirth, time: fmt(secs) })
    : persona.stage === 'elder'
      ? t('call.pillElder', { time: fmt(secs) })
      : t('call.pill', { weeks: persona.weeks, time: fmt(secs) });
  // What Ayu already knows (a new medicine), shown on the call so she sees why Ayu asks.
  const knows = persona.medicines?.some((m) => m.isNew) ? t('call.knows', { what: t(`p.${persona.id}.knows`) }) : null;
  const modeTag = mode === 'gemini' ? t('call.liveMode') : mode === 'mock' ? t('call.mockMode') : null;
  const stream = back || front;
  const shownCard = editing || card;
  const showCaption = caption && !shownCard && !done && phase !== 'ready' ? caption : null;
  const lastAnswered = answered.filter((c) => c.id !== shownCard?.id).slice(-1)[0];
  const needsStart = !demo && !media;
  const sheetOpen = Boolean(weak || shownCard || camTurn || done || needsStart || phase === 'error');

  return (
    <Screen dark className="talk">
      <div className="talk-stage">
        <HerVideo
          stream={stream}
          back={Boolean(back)}
          pill={needsStart ? null : pill}
          live={phase !== 'reconnecting' && phase !== 'error' && !paused}
          modeTag={modeTag}
          caption={showCaption}
          illustration={Boolean(demo)}
          camState={needsStart ? 'idle' : camState}
          onCamera={needsStart ? null : camState === 'blocked' && (CAMERA_SETS.has(card?.pictureSet) || camTurn) ? () => switchToBack(cameraPurposeFor(card)) : toggleCamera}
          knows={needsStart || done ? null : knows}
          status={demo || needsStart || done ? null : <StateChip phase={phase} outLevel={outLevel} micLevel={micLevel} paused={paused} />}
        />

        <div className={`card-sheet ${sheetOpen ? 'open' : ''} ${shownCard?.kind === 'multi' ? 'compact' : ''}`} aria-live="polite">
          {shownCard?.herWords && !weak && <p className="her-words">“{shownCard.herWords}”</p>}
          {weak ? (
            <div className="sheet-light" role="dialog" aria-label={t('s7.title')}>
              <h3>{t('s7.title')}</h3>
              <p>{t('s7.body')}</p>
              <Button onClick={toPhone}>{t('s7.cta')}</Button>
              <TextLink onClick={() => setWeak(false)}>{t('s7.keepVideo')}</TextLink>
            </div>
          ) : needsStart ? (
            <div className="start-panel">
              <h2 className="question">{t('call.start')}</h2>
              <p className="hint" style={{ fontSize: 15 }}>
                {t('call.startBody')}
              </p>
              <Button onClick={startFromTap}>{t('call.start')}</Button>
            </div>
          ) : phase === 'error' && !done ? (
            <div className="start-panel">
              <h2 className="question">{t('call.state.error')}</h2>
              <p className="hint" style={{ fontSize: 15 }}>
                {micError ? t('call.noMic') : t('call.errorBody')}
              </p>
              <Button onClick={startFromTap}>{t('call.restart')}</Button>
            </div>
          ) : done ? (
            <div className="start-panel">
              <h2 className="question">{t('call.allDone')}</h2>
              <p className="hint" style={{ fontSize: 15 }}>
                {t('call.allDoneBody', { name: persona.name })}
              </p>
              <p className="saving-line">
                <Spinner light /> {t('call.state.saving')}
              </p>
              <Button onClick={() => go(resultRoute(done.level))}>{t('call.seeNext')}</Button>
            </div>
          ) : shownCard ? (
            <QuestionCard
              key={`${shownCard.id}${editing ? '-edit' : ''}`}
              card={shownCard}
              onAnswer={editing ? changeAnswer : answer}
              onCamera={onCamera}
              editing={Boolean(editing)}
              pending={!editing && pending?.cardId === shownCard.id ? pending.key : null}
              onPrevious={!demo && !editing && lastAnswered ? () => setEditing(lastAnswered) : editing ? () => setEditing(null) : null}
            />
          ) : camTurn ? (
            <CameraTurnPanel purpose={camTurn.purpose} onDone={() => stopCamTurn()} />
          ) : null}
          {notice && <p className="hint notice">{notice}</p>}
        </div>

        {!demo && !weak && !shownCard && !camTurn && !done && !needsStart && phase !== 'error' && (
          <div className="idle-row">
            {lastAnswered && (
              <button className="prev-btn" onClick={() => setEditing(lastAnswered)}>
                ← {t('cards.previous')}
              </button>
            )}
            <button className="hint sim" onClick={() => setWeak(true)}>
              {t('s7.simulate')}
            </button>
          </div>
        )}
      </div>

      <CallControls
        onEnd={end}
        paused={paused}
        level={phase === 'listening' ? micLevel : 0}
        onPause={() => {
          setPaused((p) => !p);
          engineRef.current?.pause(!paused);
        }}
        cameraOn={Boolean(stream)}
        onCamera={toggleCamera}
      />
    </Screen>
  );
}

/** Which pill shows the spinner for an answer. */
function matchKey(card, a, meta, fallback) {
  if (meta.picture && a !== 'no') return meta.picture;
  if (card.kind === 'single' && !card.options.some((o) => o.label === a)) return '__else';
  if (card.kind === 'search') return meta.label;
  return fallback;
}
