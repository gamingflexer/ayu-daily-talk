import { useEffect, useRef, useState } from 'react';
import { Screen, Button, TextLink } from '../components/ui.jsx';
import { HerVideo, CallControls, QuestionCard, videoHeightFor } from '../components/call.jsx';
import { useT } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { go } from '../router.js';
import { createMockTalk } from '../live/mock-live.js';
import { checkLive } from '../live/server.js';
import { createTalkState, handleTool, recordAnswer } from '../../shared/talk-state.js';
import { PhotoView } from './Photo.jsx';

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Static Figma states S4–S7, for the screens map. */
function presetCard(demo, t) {
  if (demo === 'yesno' || demo === 'weak')
    return { id: 'p4', kind: 'yes_no', question: t('mock.qSwelling'), notSure: 'camera', sign: 'swelling_feet' };
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

export function TalkScreen({ demo, forceMock }) {
  const { t, lang } = useT();
  const { persona, update } = useApp();
  const [card, setCard] = useState(() => presetCard(demo, t));
  const [caption, setCaption] = useState(null);
  const [status, setStatus] = useState(demo ? 'live' : 'connecting');
  const [mode, setMode] = useState(demo ? 'demo' : null);
  const [paused, setPaused] = useState(false);
  const [cam, setCam] = useState(null);
  const [weak, setWeak] = useState(demo === 'weak');
  const [secs, setSecs] = useState(PRESET_TIME[demo] || 0);
  const [level, setLevel] = useState(0);
  const [photo, setPhoto] = useState(null); // {purpose, cardId}
  const [notice, setNotice] = useState('');
  const engineRef = useRef(null);
  const turnRef = useRef({ who: null, done: true });

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
      const mk = (useLive) =>
        useLive ? gemini.createGeminiTalk({ persona, lang }) : createMockTalk({ persona, lang, t });
      let engine = mk(live.live);
      engineRef.current = engine;
      setMode(engine.mode);
      off = engine.on(onEvent);
      try {
        await engine.start();
      } catch (err) {
        if (!alive) return;
        // Live failed (no key, no mic, network) → keep going in mock mode.
        off?.();
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
      off?.();
      engineRef.current?.end();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, persona.id, lang]);

  // Talk clock.
  useEffect(() => {
    if (demo || status !== 'live' || paused) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [demo, status, paused]);

  // Weak network → offer a phone call (S7).
  useEffect(() => {
    const c = navigator.connection;
    if (!c || demo) return;
    const check = () => {
      if (['slow-2g', '2g'].includes(c.effectiveType) || (c.downlink && c.downlink < 0.15)) setWeak(true);
    };
    check();
    c.addEventListener?.('change', check);
    return () => c.removeEventListener?.('change', check);
  }, [demo]);

  // Stop the camera when leaving.
  useEffect(() => () => cam?.getTracks().forEach((x) => x.stop()), [cam]);

  function onEvent(e) {
    switch (e.type) {
      case 'status':
        setStatus(e.status);
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
      case 'level':
        setLevel(e.rms);
        break;
      case 'finish': {
        const signs = [...(engineRef.current?.state.signs || [])];
        update({ lastTalk: { at: Date.now(), referral: e.referral, noted: e.noted, signs, persona: persona.id } });
        setTimeout(() => go(e.referral.level === 'none' || e.referral.level === 'watch' ? '/fine' : '/next'), 1400);
        break;
      }
      default:
    }
  }

  function answer(a) {
    if (!card) return;
    if (demo) return answerDemo(a);
    engineRef.current?.answer(card.id, a, { yes: t('common.yes'), no: t('common.no'), not_sure: t('common.notSure') });
    setCard(null);
  }

  // Screens-map mode: walk S4 → S5 → S6 → S10 / S11 without an engine.
  function answerDemo(a) {
    if (demo === 'yesno') return go('/talk?demo=followup');
    if (demo === 'followup') return go('/talk?demo=danger');
    if (demo === 'danger') {
      const s = createTalkState(persona);
      const { card: c } = handleTool(s, 'ask_multi_choice', { question: card.question, options: card.options });
      const r = recordAnswer(s, c, a);
      update({ lastTalk: { at: Date.now(), referral: r, signs: [...s.signs], persona: persona.id } });
      return go(r.level === 'none' || r.level === 'watch' ? '/fine' : '/next');
    }
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

  function openPhoto() {
    const purpose = card?.purpose || (card?.pictureSet === 'baby_skin_colour' ? 'skin_patch' : card?.pictureSet === 'feet_swelling' || card?.sign === 'swelling_feet' ? 'feet' : 'medicine_strip');
    setPhoto({ purpose, cardId: card?.id });
  }

  function end() {
    engineRef.current?.end();
    go('/today');
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
  const videoH = weak ? 360 : videoHeightFor(card);
  // Captions sit on the video; on the small tile (long answer lists) the question card says it already.
  const showCaption = caption && videoH >= 200 && (!card || caption.who === 'ayu') ? caption : null;

  return (
    <Screen dark>
      <HerVideo
        height={videoH}
        stream={cam}
        pill={pill}
        live={status === 'live' && !paused}
        modeTag={modeTag}
        caption={showCaption}
      >
        {weak && (
          <div className="sheet" role="dialog" aria-label={t('s7.title')}>
            <h3>{t('s7.title')}</h3>
            <p>{t('s7.body')}</p>
            <Button
              onClick={() => {
                engineRef.current?.end();
                go('/phone');
              }}
            >
              {t('s7.cta')}
            </Button>
            <TextLink onClick={() => setWeak(false)}>{t('s7.keepVideo')}</TextLink>
          </div>
        )}
      </HerVideo>

      {card?.herWords && <p className="her-words">“{card.herWords}”</p>}

      <div className={`call-body ${card?.kind === 'multi' ? 'compact' : ''}`} aria-live="polite">
        {weak ? null : card ? (
          <QuestionCard key={card.id} card={card} onAnswer={answer} onCamera={openPhoto} />
        ) : (
          <p className="hint" style={{ fontSize: 15, paddingTop: 8 }}>
            {status === 'connecting' ? t('call.connecting') : paused ? t('call.paused') : status === 'ended' ? t('call.ended') : t('call.listening')}
          </p>
        )}
        {notice && <p className="hint" style={{ color: '#f5b041' }}>{notice}</p>}
        {!demo && !weak && !card && (
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
