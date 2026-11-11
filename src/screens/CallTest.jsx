import { useEffect, useRef, useState } from 'react';
import { QuestionCard, HerVideo } from '../components/call.jsx';
import { Logo } from '../components/ui.jsx';
import { useT } from '../i18n/index.jsx';
import { href } from '../router.js';
import { PERSONA_IDS, getPersona } from '../../shared/personas.js';
import { mentionsStoppingMedicine } from '../../shared/red-flags.js';
import { createMockTalk } from '../live/mock-live.js';
import { checkLive, liveServerUrl } from '../live/server.js';

// /call-test — connect, talk, and watch the transcript and tool calls.
export function CallTest() {
  const { t, lang: uiLang } = useT();
  const [health, setHealth] = useState(null);
  const [personaId, setPersonaId] = useState('sunita');
  const [lang, setLang] = useState(uiLang);
  const [want, setWant] = useState('auto');
  const [status, setStatus] = useState('idle');
  const [model, setModel] = useState('');
  const [turns, setTurns] = useState([]);
  const [log, setLog] = useState([]);
  const [card, setCard] = useState(null);
  const [ref, setRef] = useState(null);
  const [level, setLevel] = useState(0);
  const [cam, setCam] = useState(null);
  const [err, setErr] = useState('');
  const engine = useRef(null);
  const turnOpen = useRef(false);

  useEffect(() => {
    checkLive().then(setHealth);
    return () => engine.current?.end();
  }, []);

  const addLog = (entry) => setLog((l) => [...l.slice(-200), `${new Date().toLocaleTimeString()}  ${entry}`]);

  function onEvent(e) {
    switch (e.type) {
      case 'status':
        setStatus(e.status);
        addLog(`status: ${e.status}${e.detail ? ` (${e.detail})` : ''}`);
        break;
      case 'info':
        setModel(e.model);
        break;
      case 'caption':
        setTurns((ts) => {
          const last = ts[ts.length - 1];
          if (last && last.who === e.who && turnOpen.current && e.partial) {
            const text = last.text + e.text;
            return [...ts.slice(0, -1), { ...last, text, flag: e.who === 'ayu' && mentionsStoppingMedicine(text) }];
          }
          return [...ts, { who: e.who, text: e.text.trimStart(), flag: e.who === 'ayu' && mentionsStoppingMedicine(e.text) }];
        });
        turnOpen.current = e.partial;
        break;
      case 'turn-complete':
        turnOpen.current = false;
        break;
      case 'tool':
        addLog(`tool ${e.name}(${JSON.stringify(e.args)}) → ${JSON.stringify(e.result)}`);
        break;
      case 'card':
        setCard(e.card);
        break;
      case 'referral':
        setRef(e.referral);
        break;
      case 'finish':
        addLog(`finish: ${JSON.stringify({ level: e.referral.level, noted: e.noted })}`);
        break;
      case 'level':
        setLevel(e.rms);
        break;
      default:
    }
  }

  async function connect() {
    setErr('');
    setTurns([]);
    setLog([]);
    setCard(null);
    setRef(null);
    const persona = getPersona(personaId);
    const useLive = want === 'live' || (want === 'auto' && health?.live);
    const e = useLive
      ? (await import('../live/gemini-live.js')).createGeminiTalk({ persona, lang })
      : createMockTalk({ persona, lang, t, speak: false });
    engine.current = e;
    e.on(onEvent);
    addLog(`mode: ${e.mode} · server: ${liveServerUrl() || '(same origin)'}`);
    try {
      await e.start();
    } catch (x) {
      setErr(x.message);
      setStatus('error');
      addLog(`error: ${x.message}`);
    }
  }

  function disconnect() {
    engine.current?.end();
    engine.current = null;
    cam?.getTracks().forEach((x) => x.stop());
    setCam(null);
  }

  async function camera() {
    if (cam) {
      cam.getTracks().forEach((x) => x.stop());
      setCam(null);
      engine.current?.setCamera(null);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 } } });
      setCam(s);
      engine.current?.setCamera(s);
      addLog('camera on — sending 1 JPEG frame / second');
    } catch (x) {
      setErr(x.message);
    }
  }

  const running = ['connecting', 'live', 'going-away'].includes(status);

  return (
    <div className="ct">
      <div className="ct-panel" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Logo />
          <h1 style={{ margin: 0, fontSize: 18 }}>{t('ct.title')}</h1>
        </div>
        <a className="small" href={href('/screens')}>
          {t('app.demoMap')}
        </a>
      </div>

      <div className="ct-panel">
        <h2>{t('ct.setup')}</h2>
        <p className="small">
          {t('ct.server')}: {health ? (health.live ? t('ct.liveOn', { model: health.model }) : t('ct.liveOff', { reason: health.reason })) : '…'}
        </p>
        <div className="ct-row">
          <select value={personaId} onChange={(e) => setPersonaId(e.target.value)} aria-label={t('ct.persona')} disabled={running}>
            {PERSONA_IDS.map((id) => (
              <option key={id} value={id}>
                {getPersona(id).name}
              </option>
            ))}
          </select>
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('common.language')} disabled={running}>
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
          </select>
          <select value={want} onChange={(e) => setWant(e.target.value)} aria-label={t('ct.mode')} disabled={running}>
            <option value="auto">{t('ct.auto')}</option>
            <option value="live">Gemini Live</option>
            <option value="mock">{t('ct.mock')}</option>
          </select>
        </div>
        <div className="ct-row">
          {running ? (
            <button className="btn" style={{ minHeight: 48, fontSize: 16 }} onClick={disconnect}>
              {t('ct.disconnect')}
            </button>
          ) : (
            <button className="btn" style={{ minHeight: 48, fontSize: 16 }} onClick={connect}>
              {t('ct.connect')}
            </button>
          )}
        </div>
        <div className="ct-row">
          <span className={`status ${status === 'live' ? 'live' : status === 'error' ? 'error' : ''}`}>{status}</span>
          {model && <span className="status">{model}</span>}
          <button className="sm" onClick={camera} disabled={!running}>
            {cam ? t('call.cameraOff') : t('call.cameraOnBtn')}
          </button>
          <span className="small" aria-label={t('ct.mic')}>
            🎙 {'▮'.repeat(Math.min(10, Math.round(level * 60)))}
          </span>
        </div>
        {err && <p className="error">{err}</p>}
        <div className="device-mini">
          <HerVideo height={190} stream={cam} pill={t('ct.cardPreview')} />
          <div className="call-body" style={{ color: '#fff', overflow: 'auto' }}>
            {card ? (
              <QuestionCard
                key={card.id}
                card={card}
                onAnswer={(a) => {
                  engine.current?.answer(card.id, a, { yes: t('common.yes'), no: t('common.no'), not_sure: t('common.notSure') });
                  addLog(`tapped: ${JSON.stringify(a)}`);
                  setCard(null);
                }}
                onCamera={camera}
              />
            ) : (
              <p className="hint">{t('ct.noCard')}</p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, alignContent: 'start', minWidth: 0 }}>
        <div className="ct-panel">
          <h2>{t('ct.referral')}</h2>
          <p className="small">
            {ref
              ? `${ref.level} · ${t('ct.rule')}: ${ref.rule || '—'}${ref.raisedByModel ? ` · ${t('ct.raised')}` : ''} · ${ref.reasons.join(', ') || '—'}`
              : t('ct.noReferral')}
          </p>
        </div>
        <div className="ct-panel">
          <h2>{t('ct.transcript')}</h2>
          <div className="ct-transcript" aria-live="polite">
            {turns.length === 0 && <p className="small">{t('ct.empty')}</p>}
            {turns.map((x, i) => (
              <p key={i}>
                <b>{x.who === 'ayu' ? 'Ayu' : t('call.you')}</b>
                {x.text}
                {x.flag && <span className="flag"> ⚠ {t('ct.stopFlag')}</span>}
              </p>
            ))}
          </div>
        </div>
        <div className="ct-panel">
          <h2>{t('ct.tools')}</h2>
          <pre className="ct-log">{log.join('\n') || '—'}</pre>
        </div>
      </div>
    </div>
  );
}
