// Tell Ayu: she says what feels different, in her own words; Ayu (Gemini Live)
// listens and notes each sign; she confirms what Ayu heard; the fixed rules decide.
// Boards: "5 · Tell Ayu — listening" (Tell.dc.html) and the prototype's Heard state.
// The camera state is not drawn yet: built from the same pieces (full-bleed video,
// dark scrim, the same rings and quick taps on top).
//
// Nothing here is scripted: every word on screen is her transcription, Ayu's
// transcription, or a fixed line saying what the app is doing.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Screen, Circle, Btn, Mono, LEVEL_N } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { useT } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { go, swap } from '../router.js';
import { HelpBar } from '../patient/Home.jsx';
import { assess } from '../../shared/triage.js';
import { ruleContext } from '../../shared/journal.js';
import { maxLevel } from '../../shared/red-flags.js';
import { tellEntry } from './entry.js';
import { checkLive } from '../live/server.js';
import { signPic } from '../patient/pics.jsx';
import { requestMic, takeTell, openCamera, stopStream } from '../live/media.js';
import { questionText, optionText } from '../ui/words.js';
import { picFor, hasPictures } from '../patient/pics.jsx';
import { handCheckOver } from '../patient/handoff.js';
import { saveResearch } from '../research.js';
import { UNSURE } from '../../shared/question-sets.js';
import { nextPhase, LIVE_PHASES } from '../live/phase.js';
import './tell.css';

/** One tap, no network: the signs she can tap instead of speaking. */
const QUICK = {
  pregnant: ['severe_headache', 'reduced_fetal_movement', 'bleeding', 'fever', 'vomiting_no_food', 'very_low_mood'],
  postnatal: ['heavy_bleeding', 'fever', 'baby_poor_feeding', 'baby_yellow_skin', 'foul_discharge', 'very_low_mood'],
};

/** Phases in which a session is being set up or is open (the camera button shows). */
const SESSION = new Set(['mic', 'connecting', 'listening', 'speaking', 'reconnecting']);

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function profileOf(woman) {
  const ctx = ruleContext(woman);
  return { name: woman.name, stage: woman.stage, weeks: ctx.weeks, daysAfterBirth: ctx.daysAfterBirth, village: woman.village };
}

/**
 * @param {{mode?: 'tell'|'check'}} props  'check' = today's daily check, asked by Ayu on the call
 */
export function TellScreen({ mode = 'tell' }) {
  const { t, lang } = useT();
  const { woman, addEntry, role, qset } = useStore();
  const checkMode = mode === 'check';
  const [q, setQ] = useState(null); // question on screen (check mode)
  const [answers, setAnswers] = useState({}); // check mode
  const runRef = useRef(null); // the last finished call (turns, timings) for the research record
  const startedAtRef = useRef(0);
  const [phase, setPhase] = useState('idle');
  const [micOff, setMicOff] = useState(false);
  const [fail, setFail] = useState(null); // reason
  const [secs, setSecs] = useState(0);
  const [words, setWords] = useState(''); // her words so far
  const [ayu, setAyu] = useState(''); // Ayu's current line
  const [heard, setHeard] = useState(null); // {text, symptoms}
  const [off, setOff] = useState(() => new Set());
  const [cam, setCam] = useState(null); // {stream, facing}
  const [camBusy, setCamBusy] = useState(false);
  const [camFailed, setCamFailed] = useState(false);
  const engineRef = useRef(null);
  const micRef = useRef(null); // her mic for this session (stopped on every exit; stopping twice is harmless)
  const camRef = useRef(null);
  const levelRef = useRef(0);
  const sessionRef = useRef(0);
  const aliveRef = useRef(false);
  const startedRef = useRef(false);

  const ctx = useMemo(() => (woman ? ruleContext(woman) : {}), [woman]);
  const quick = QUICK[woman?.stage] || QUICK.pregnant;
  const tapLevels = useMemo(
    () => Object.fromEntries(quick.map((s) => [s, maxLevel(assess({ set: null, extraSigns: [s], ...ctx }).level, 'watch')])),
    [quick, ctx],
  );

  // ---- session ------------------------------------------------------------

  function closeEngine() {
    engineRef.current?.end();
    engineRef.current = null;
    stopStream(micRef.current);
    micRef.current = null;
    levelRef.current = 0;
  }

  function stopCam() {
    stopStream(camRef.current);
    camRef.current = null;
    setCam(null);
    engineRef.current?.setCamera(null);
  }

  /** Everything off: socket, mic, camera, and any start still in flight. */
  function teardown() {
    sessionRef.current++;
    closeEngine();
    stopStream(camRef.current);
    camRef.current = null;
  }

  function onEvent(e) {
    setPhase((p) => nextPhase(p, e));
    switch (e.type) {
      case 'status':
        if (e.status === 'failed') {
          setFail(e.reason || 'other');
          stopStream(micRef.current);
          micRef.current = null;
          stopCam();
        }
        break;
      case 'her':
        setWords(e.text);
        break;
      case 'ayu':
        setAyu(e.text);
        break;
      case 'level':
        levelRef.current = e.rms;
        break;
      case 'tick':
        setSecs(e.secs);
        break;
      case 'show':
        setQ(e.q);
        break;
      case 'answer':
        setAnswers((prev) => ({ ...prev, [e.q]: e.o }));
        break;
      case 'finish':
        runRef.current = e;
        if (e.answers) setAnswers(e.answers);
        levelRef.current = 0;
        stopStream(micRef.current);
        micRef.current = null;
        // A check with nothing extra to confirm goes straight on; otherwise she confirms what Ayu heard.
        if (checkMode && !e.symptoms.length) {
          setTimeout(() => finishCheck(e.answers || {}, [], e), 0);
          break;
        }
        setHeard({ text: e.heard, symptoms: e.symptoms });
        setOff(new Set());
        stopCam();
        break;
      default:
    }
  }

  /** Start listening with the mic promise from her tap (Home's card, "Tap to speak", "Say it again"). */
  async function begin(micPromise) {
    const id = ++sessionRef.current;
    const stale = () => id !== sessionRef.current || !aliveRef.current;
    const failed = (reason) => {
      if (stale()) return;
      closeEngine();
      stopCam();
      setFail(reason);
      setPhase((p) => nextPhase(p, { type: 'status', status: 'failed', reason }));
    };
    closeEngine();
    setPhase((p) => nextPhase(p, { type: 'begin' }));
    setFail(null);
    setWords('');
    setAyu('');
    setSecs(0);
    setHeard(null);
    setMicOff(false);
    setQ(null);
    setAnswers({});
    runRef.current = null;
    startedAtRef.current = Date.now();

    const m = await micPromise;
    if (stale()) return stopStream(m.audio);
    if (!m.audio) return failed('mic');
    micRef.current = m.audio;
    setPhase((p) => nextPhase(p, { type: 'status', status: 'connecting' }));

    const health = await checkLive();
    if (stale()) return;
    if (!health.live) return failed(health.reason);
    let mod;
    try {
      // The Gemini SDK chunk loads only now (not precached; see vite.config.js).
      mod = await import('../live/gemini-live.js');
    } catch {
      return failed(navigator.onLine === false ? 'offline' : 'server');
    }
    if (stale()) return;

    const engine = mod.createGeminiTalk({ profile: profileOf(woman), lang, check: checkMode ? checkPayload() : null });
    engineRef.current = engine;
    engine.on((e) => {
      if (engineRef.current === engine) onEvent(e);
    });
    if (camRef.current) engine.setCamera(camRef.current);
    await engine.start({ stream: m.audio });
  }

  // Pick up the mic Home asked for inside her tap. StrictMode mounts twice in dev:
  // start once, and tear down only when the screen is really gone.
  useEffect(() => {
    aliveRef.current = true;
    if (!startedRef.current) {
      startedRef.current = true;
      const p = takeTell();
      if (p) begin(p);
    }
    return () => {
      aliveRef.current = false;
      setTimeout(() => {
        if (!aliveRef.current) teardown();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- actions --------------------------------------------------------------

  /** Today's questions in her language, for Ayu's prompt (cleaned again on the server). */
  function checkPayload() {
    return {
      setId: qset.id,
      questions: qset.questions.map((x) => ({ id: x.id, text: questionText(qset, x, t, lang), options: x.options.map((o) => ({ id: o.id, text: optionText(qset, x, o, t, lang) })) })),
    };
  }

  /** One research record per finished (or cancelled) call. No name or phone. */
  function research(extra) {
    const run = runRef.current;
    saveResearch({
      at: startedAtRef.current || Date.now(),
      lang,
      stage: woman.stage,
      weeks: ctx.weeks,
      daysAfterBirth: ctx.daysAfterBirth,
      turns: run?.turns || [],
      camera: run?.camera,
      endedBy: run?.by,
      signs: run?.signs || [],
      ...extra,
    });
  }

  /** The check call ended: save it, or hand the questions she did not answer to the tap check. */
  function finishCheck(all, keptSigns, run = runRef.current) {
    teardown();
    const left = qset.questions.filter((x) => all[x.id] === undefined);
    if (left.length) {
      research({ kind: 'call', setId: qset.id, answers: all, confirmed: keptSigns, level: 'unknown', endedBy: `${run?.by || 'end'}:unanswered` });
      handCheckOver({ answers: all, extraSigns: keptSigns });
      return swap('/check');
    }
    const r = assess({ set: qset, answers: all, extraSigns: keptSigns, ...ctx });
    const e = addEntry({ womanId: woman.id, kind: 'check', via: 'call', setId: qset.id, setVersion: qset.version, answers: all, signs: r.signs, level: r.level, items: r.items, rule: r.rule, combo: r.combo, by: role === 'asha' ? 'asha' : 'self' });
    research({ kind: 'call', setId: qset.id, answers: all, confirmed: keptSigns, level: r.level, rule: r.rule, items: r.items });
    return swap(`/result/${e.id}`);
  }

  /** She tapped an answer on the card. */
  function tapOption(qid, oid) {
    const x = qset.questions.find((y) => y.id === qid);
    if (!x) return;
    setAnswers((prev) => ({ ...prev, [qid]: oid }));
    const o = x.options.find((y) => y.id === oid);
    engineRef.current?.tap(qid, oid, questionText(qset, x, t, lang), o ? optionText(qset, x, o, t, lang) : t('common.notSure'));
  }

  /** From a tap: the getUserMedia call happens synchronously inside it (iOS). */
  const tapToSpeak = () => begin(requestMic());

  function cancel() {
    if (startedAtRef.current && !runRef.current) research({ kind: checkMode ? 'call' : 'tell', setId: checkMode ? qset.id : null, answers: checkMode ? answers : null, level: 'unknown', endedBy: 'cancel' });
    teardown();
    setCam(null);
    go('/home');
  }

  function save(what) {
    teardown();
    const entry = tellEntry(woman, what);
    const e = addEntry({ ...entry, by: role === 'asha' ? 'asha' : 'self' });
    research({ kind: what.quick ? 'quick' : 'tell', confirmed: what.signs || [], removed: (heard?.symptoms || []).filter((x, i) => off.has(rowKey(x, i))).map((x) => x.sign), level: entry.level, rule: entry.rule, items: entry.items });
    swap(`/result/${e.id}`);
  }

  const pickQuick = (sign) => save({ signs: [sign], transcript: words.trim(), quick: true });

  function confirm() {
    const kept = (heard?.symptoms || []).filter((s, i) => !off.has(rowKey(s, i)));
    if (checkMode) return finishCheck(runRef.current?.answers || answers, kept.filter((x) => x.sign !== 'other').map((x) => x.sign));
    save({
      signs: kept.filter((s) => s.sign !== 'other').map((s) => s.sign),
      others: kept.filter((s) => s.sign === 'other').map((s) => s.her_words),
      transcript: heard?.text || '',
    });
  }

  function showStream(stream, facing) {
    camRef.current = stream;
    setCam({ stream, facing });
    engineRef.current?.setCamera(stream);
  }

  function toggleMic() {
    const next = !micOff;
    setMicOff(next);
    engineRef.current?.setMuted(next);
  }

  async function toggleCam() {
    if (camRef.current) return stopCam();
    setCamBusy(true);
    setCamFailed(false);
    try {
      const s = await openCamera('environment');
      if (!aliveRef.current) return stopStream(s);
      showStream(s, 'environment');
    } catch {
      setCamFailed(true);
    } finally {
      setCamBusy(false);
    }
  }

  async function flipCam() {
    if (!cam) return;
    const facing = cam.facing === 'environment' ? 'user' : 'environment';
    // Phones run one camera at a time.
    stopStream(camRef.current);
    setCamBusy(true);
    try {
      const s = await openCamera(facing);
      if (!aliveRef.current) return stopStream(s);
      showStream(s, facing);
    } catch {
      stopCam();
      setCamFailed(true);
    } finally {
      setCamBusy(false);
    }
  }

  if (!woman) return null; // App sends her to the start

  // ---- Heard ----------------------------------------------------------------

  if (phase === 'heard' && heard) {
    const rows = heard.symptoms.map((s, i) => ({ key: rowKey(s, i), label: s.sign === 'other' ? `“${s.her_words}”` : t(`signs.${s.sign}`), tint: i % 4 }));
    const keptAny = rows.some((r) => !off.has(r.key));
    const said = heard.text;
    const toggle = (key) =>
      setOff((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    return (
      <Screen aura={{ tone: 'listen', pos: 'high' }} className="tellscr">
        <div className="top">
          <Mono>{said ? t('tell.heard.meta') : t('tell.meta.idle')}</Mono>
          <Circle icon="close" tone="soft" label={t('tell.cancel')} onClick={cancel} />
        </div>
        {/* Shown on camera and said nothing: no quote. */}
        {said && <p className="tell-quote tell-in">“{said}”</p>}
        <div className="grow" />
        <div className="tell-dock tell-in">
          {rows.length > 0 ? (
            <>
              <span className="tell-small">{t('tell.heard.understood')}</span>
              {rows.map((r) => {
                const on = !off.has(r.key);
                return (
                  <button key={r.key} type="button" className="tell-row" aria-pressed={on} onClick={() => toggle(r.key)}>
                    <span className="tell-arch" data-tint={r.tint} aria-hidden="true">
                      {r.sign ? signPic(r.sign) : null}
                    </span>
                    <span className="tell-row-label">{r.label}</span>
                    <span className="tell-tick" aria-hidden="true">
                      {on && <Icon name="check" size={18} weight={2.6} />}
                    </span>
                  </button>
                );
              })}
              {keptAny || said ? (
                <>
                  <Btn kind="dark" className="tell-yes" onClick={confirm}>
                    {t('tell.heard.yes')}
                  </Btn>
                  <Btn kind="ghost" className="tell-again" onClick={tapToSpeak}>
                    {t('tell.heard.again')}
                  </Btn>
                </>
              ) : (
                <Btn kind="dark" className="tell-yes" onClick={tapToSpeak}>
                  {t('tell.heard.again')}
                </Btn>
              )}
            </>
          ) : (
            <>
              <p className="tell-nothing" role="status">
                {t('tell.heard.nothing')}
              </p>
              <QuickTaps signs={quick} levels={tapLevels} onPick={pickQuick} t={t} flush />
              <Btn kind="dark" className="tell-yes" onClick={tapToSpeak}>
                {t('tell.heard.again')}
              </Btn>
              {said && (
                <Btn kind="ghost" className="tell-again" onClick={() => save({ transcript: said })}>
                  {t('tell.heard.sendWords')}
                </Btn>
              )}
            </>
          )}
        </div>
      </Screen>
    );
  }

  // ---- Listening (and the states around it) --------------------------------

  const live = LIVE_PHASES.has(phase);
  const idle = phase === 'idle' || phase === 'failed';
  const camOn = Boolean(cam);
  const meta =
    phase === 'listening' ? t('tell.listening', { time: clock(secs) }) : phase === 'speaking' ? t('tell.speaking', { time: clock(secs) }) : t(`tell.meta.${phase}`);
  const hint = idle ? (phase === 'idle' ? t('tell.hint.idle') : '') : live ? t('tell.hint.start') : t(`tell.hint.${phase}`);
  const failLine = phase === 'failed' ? t(`tell.fail.${fail === 'mic' || fail === 'offline' ? fail : 'other'}`) : '';
  const note = phase === 'reconnecting' || phase === 'wrapping' ? (words ? t(`tell.hint.${phase}`) : '') : live ? ayu : '';

  return (
    <Screen aura={camOn ? null : { tone: 'listen', pos: 'mid' }} className={`tellscr ${camOn ? 'cam' : ''}`}>
      {camOn && <CameraView stream={cam.stream} mirror={cam.facing === 'user'} />}
      <div className="top">
        <Mono className="strong tell-meta">
          <span className={`tell-dot ${live ? 'on' : ''}`} aria-hidden="true" />
          {meta}
        </Mono>
        <span className="tell-actions">
          <Circle icon="close" tone="soft" label={t('tell.cancel')} onClick={cancel} />
        </span>
      </div>

      {(camOn || camFailed) && SESSION.has(phase) && (
        <div className="tell-cam-row">
          <span>{camOn ? t('tell.camera.notice') : t('tell.camera.failed')}</span>
        </div>
      )}

      <Rings levelRef={levelRef} active={live}>
        {idle ? (
          <button type="button" className="tell-stop" onClick={tapToSpeak} aria-label={phase === 'failed' ? t('tell.tryAgain') : t('tell.tapToSpeak')}>
            <Icon name="mic" size={40} color="#ffffff" weight={2} />
          </button>
        ) : (
          <button type="button" className="tell-stop" onClick={() => engineRef.current?.stop()} disabled={!live} aria-label={t('tell.stop')}>
            <span className="tell-square" />
          </button>
        )}
      </Rings>

      <p className="tell-words" aria-live="polite">
        {failLine ? (
          <span className="tell-fail">{failLine}</span>
        ) : (
          <>
            {micOff && live ? <span className="tell-hint">{t('tell.call.mutedLine')}</span> : latest(words)}
            {!words && !(micOff && live) && <span className="tell-hint">{hint}</span>}
          </>
        )}
      </p>
      {note && <p className="tell-ayu">{note}</p>}

      <div className="grow" />
      {checkMode && q && SESSION.has(phase) && (
        <CheckCard set={qset} qid={q} answer={answers[q]} onPick={tapOption} t={t} lang={lang} n={qset.questions.findIndex((x) => x.id === q) + 1} total={qset.questions.length} />
      )}
      {checkMode && !SESSION.has(phase) ? (
        /* No call (no mic, no internet, no key): the same check by tapping, no AI needed. */
        <div className="dock">
          <Btn kind="dark" onClick={() => swap('/check')}>
            {t('tell.check.byTap')}
          </Btn>
        </div>
      ) : SESSION.has(phase) ? (
        /* A live call: camera, mic and (when the camera is on) flip, where the thumb is.
           [Inferred: not on the boards] Same circle language as the rest of the app. */
        <div className="tell-call">
          <CallBtn icon={camOn ? 'cameraOff' : 'camera'} on={camOn} label={camOn ? t('tell.camera.off') : t('tell.camera.on')} text={t('tell.call.camera')} disabled={camBusy} onClick={toggleCam} />
          {camOn && <CallBtn icon="flip" label={t('tell.camera.flip')} text={t('tell.call.flip')} disabled={camBusy} onClick={flipCam} />}
          <CallBtn icon={micOff ? 'micOff' : 'mic'} on={micOff} label={micOff ? t('tell.call.unmute') : t('tell.call.mute')} text={micOff ? t('tell.call.unmute') : t('tell.call.mute')} disabled={!live} onClick={toggleMic} />
        </div>
      ) : (
        <QuickTaps signs={quick} levels={tapLevels} onPick={pickQuick} t={t} />
      )}
      <HelpBar />
    </Screen>
  );
}

/** Today's question as a card over the call: picture answers she can tap while Ayu talks. */
function CheckCard({ set, qid, answer, onPick, t, lang, n, total }) {
  const q = set.questions.find((x) => x.id === qid);
  if (!q) return null;
  const pics = hasPictures(set, q);
  return (
    <div className="tc-card tell-in" role="group" aria-label={questionText(set, q, t, lang)}>
      <span className="tc-count">{t('check.counter', { n, total })}</span>
      <p className="tc-q">{questionText(set, q, t, lang)}</p>
      <div className={`tc-opts ${pics ? 'pics' : ''}`}>
        {q.options.map((o) => (
          <button key={o.id} type="button" className="tc-opt" aria-pressed={answer === o.id} onClick={() => onPick(q.id, o.id)}>
            {pics && <span className="tc-pic">{picFor(set, q, o)}</span>}
            <span className="tc-label">{optionText(set, q, o, t, lang)}</span>
          </button>
        ))}
        <button type="button" className="tc-opt unsure" aria-pressed={answer === UNSURE} onClick={() => onPick(q.id, UNSURE)}>
          <span className="tc-label">{t('common.notSure')}</span>
        </button>
      </div>
    </div>
  );
}

/** One labelled round control of the call dock. */
function CallBtn({ icon, on = false, label, text, ...rest }) {
  return (
    <button type="button" className="tell-callbtn" aria-label={label} aria-pressed={on} {...rest}>
      <span className="tell-callbtn-ic">
        <Icon name={icon} size={26} weight={2} />
      </span>
      <span className="tell-callbtn-tx">{text}</span>
    </button>
  );
}

/** Only her latest words stay on screen during a long talk (the whole talk is shown on "You said"). */
function latest(text, max = 110) {
  const s = (text || '').trim();
  if (s.length <= max) return s;
  const cut = s.slice(-max);
  const at = cut.search(/\s/);
  return `… ${cut.slice(at > -1 ? at + 1 : 0).trim()}`;
}

const rowKey = (s, i) => (s.sign === 'other' ? `other:${i}` : s.sign);

/** The two soft rings around the button; the outer one follows her real mic level. */
function Rings({ levelRef, active, children }) {
  const outer = useRef(null);
  useEffect(() => {
    const el = outer.current;
    if (!el) return undefined;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!active || still) {
      el.style.transform = '';
      return undefined;
    }
    let raf = 0;
    let cur = 0;
    const loop = () => {
      // Speech RMS after auto-gain is ~0.02–0.15; full swing at ~0.12.
      const target = Math.min(1, (levelRef.current || 0) * 8);
      cur += (target - cur) * 0.25;
      el.style.transform = `scale(${(1 + cur * 0.22).toFixed(3)})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      el.style.transform = '';
    };
  }, [active, levelRef]);
  return (
    <div className="tell-rings">
      <span ref={outer} className="tell-ring outer" aria-hidden="true" />
      <span className="tell-ring inner" aria-hidden="true" />
      {children}
    </div>
  );
}

/** Pill-shaped quick taps; ring colour = the level that sign reaches by the rules. */
function QuickTaps({ signs, levels, onPick, t, flush = false }) {
  return (
    <div className={`tell-quick ${flush ? 'flush' : ''}`}>
      <span className="tell-small">{t('tell.orTap')}</span>
      <div className="tell-quick-row">
        {signs.map((s, i) => (
          <button key={s} type="button" className="tell-pill" onClick={() => onPick(s)}>
            <span className="tell-pill-ring" data-level={LEVEL_N[levels[s]] ?? 1} aria-hidden="true">
              {/* A photo when one exists for this sign (docs/PHOTOS.md); otherwise the tint alone. */}
              <span className="tell-pill-in" data-tint={i % 4}>
                {signPic(s)}
              </span>
            </span>
            <span className="tell-pill-label">{t(`signs.${s}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Her camera, full-bleed behind everything, with a dark scrim so the words stay readable. */
function CameraView({ stream, mirror }) {
  return (
    <div className="tell-video" aria-hidden="true">
      <video
        className={mirror ? 'mirror' : ''}
        autoPlay
        muted
        playsInline
        ref={(el) => {
          if (el && el.srcObject !== stream) {
            el.srcObject = stream;
            el.play?.().catch(() => {});
          }
        }}
      />
      <div className="tell-scrim" />
    </div>
  );
}
