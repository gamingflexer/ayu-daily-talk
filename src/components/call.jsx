import { useMemo, useState } from 'react';
import { useT } from '../i18n/index.jsx';
import { PICTURES } from './pictures.jsx';
import { PICTURE_NORMAL, SYMPTOM_KEYS, CAMERA_SETS } from '../../shared/talk-state.js';
import womanUrl from '../assets/figma/woman-illustration.svg';
import closeUrl from '../assets/figma/icon-close.svg';
import pauseUrl from '../assets/figma/icon-pause.svg';
import videoOffUrl from '../assets/figma/icon-video-off.svg';
import cameraUrl from '../assets/figma/icon-camera.svg';
import { PlayIcon, SpeakerIcon, VideoOnIcon } from './ui.jsx';

/**
 * Her video tile: only her, full-bleed and zoomed in (Figma UI rule). Without a
 * stream it never pretends to be her: the live talk shows "Camera off — Ayu can
 * only hear you" with a button; only the static screens map (`illustration`)
 * shows the illustration, labelled as one.
 */
export function HerVideo({
  stream,
  back = false,
  pill,
  live = true,
  modeTag,
  caption,
  illustration = false,
  camState, // 'off' | 'blocked' | 'starting'
  onCamera,
  status, // <StateChip> or null
  knows, // "Ayu knows: …" strip (what Ayu already knows about her)
  height,
  children,
}) {
  const { t } = useT();
  return (
    <div className={`her-video ${height ? 'fixed' : ''}`} style={height ? { '--video-h': `${height}px` } : undefined}>
      {stream ? (
        <video
          className={back ? 'back' : ''}
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
      ) : illustration ? (
        <>
          <img className="illus" src={womanUrl} alt="" />
          <span className="tag">{t('call.illustration')}</span>
        </>
      ) : (
        <div className={`cam-off ${caption ? 'with-caption' : ''}`}>
          {camState === 'idle' ? null : camState === 'starting' ? (
            <p className="cam-off-line">
              <Spinner /> {t('call.state.permissions')}
            </p>
          ) : camState === 'blocked' ? (
            <button className="cam-tap" onClick={onCamera}>
              <img src={cameraUrl} alt="" width="34" height="30" />
              {t('call.tapCamera')}
            </button>
          ) : (
            <>
              <p className="cam-off-line">
                <img src={videoOffUrl} alt="" width="22" height="18" /> {t('call.camOffLine')}
              </p>
              {onCamera && (
                <button className="cam-retry" onClick={onCamera}>
                  {t('call.camRetry')}
                </button>
              )}
            </>
          )}
        </div>
      )}
      {back && stream && <div className="cam-guide" aria-hidden="true" />}
      {pill && (
        <div className="call-pill">
          <span className={`dot ${live ? '' : 'off'}`} />
          {pill}
        </div>
      )}
      {modeTag && <span className="mode-tag">{modeTag}</span>}
      {status}
      {knows && (
        <div className="knows-strip" role="note">
          {knows}
        </div>
      )}
      {caption && (
        <div className="caption" aria-live="polite">
          <span className="who">{caption.who === 'her' ? t('call.you') : 'Ayu'}</span>
          {caption.text}
        </div>
      )}
      {stream && !caption && !back && <span className="tag">{t('call.cameraOn')}</span>}
      {children}
    </div>
  );
}

export function Spinner({ light = false }) {
  return <span className={`spinner ${light ? 'light' : ''}`} aria-hidden="true" />;
}

/**
 * What the talk is doing right now (rule 4: always show what the system is doing).
 * Speaking: bars that follow Ayu's voice. Listening: a ring that follows her mic.
 * Thinking: three soft dots. Connecting / checking / saving / reconnecting: a spinner.
 */
export function StateChip({ phase, outLevel = 0, micLevel = 0, paused = false }) {
  const { t } = useT();
  const p = paused ? 'paused' : phase;
  if (!p || p === 'ready') return null;
  let icon;
  if (p === 'speaking') {
    const v = Math.min(1, outLevel * 6);
    icon = (
      <span className="bars" aria-hidden="true">
        {[0.55, 1, 0.75, 0.9].map((k, i) => (
          <i key={i} style={{ transform: `scaleY(${0.25 + v * k})` }} />
        ))}
      </span>
    );
  } else if (p === 'listening') {
    icon = <span className="mic-ring" aria-hidden="true" style={{ transform: `scale(${1 + Math.min(micLevel * 8, 0.6)})` }} />;
  } else if (p === 'thinking') {
    icon = (
      <span className="dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    );
  } else if (p === 'paused' || p === 'ended') {
    icon = <span className="still" aria-hidden="true" />;
  } else if (p === 'error') {
    icon = <span className="bang" aria-hidden="true">!</span>;
  } else icon = <Spinner light />;
  return (
    <div className={`state-chip s-${p}`} role="status" aria-live="polite" data-phase={p}>
      {icon}
      <span>{t(`call.state.${p}`)}</span>
    </div>
  );
}

export function CallControls({ onEnd, paused, onPause, cameraOn, onCamera, phone, level = 0 }) {
  const { t } = useT();
  return (
    <div className="controls">
      <button className="ctl" onClick={onEnd} aria-label={t('call.end')}>
        <img src={closeUrl} width="18" height="18" alt="" />
      </button>
      <button className="ctl big" onClick={onPause} aria-label={paused ? t('call.resume') : t('call.pause')} style={{ position: 'relative' }}>
        {!paused && level > 0.02 && <span className="level" style={{ transform: `scale(${1 + Math.min(level * 4, 0.35)})` }} />}
        {paused ? <PlayIcon /> : <img src={pauseUrl} width="22" height="24" alt="" />}
      </button>
      {phone ? (
        <button className="ctl" aria-label={t('call.speaker')}>
          <SpeakerIcon />
        </button>
      ) : (
        <button className={`ctl ${cameraOn ? 'on' : ''}`} onClick={onCamera} aria-label={cameraOn ? t('call.cameraOff') : t('call.cameraOnBtn')} aria-pressed={cameraOn}>
          {cameraOn ? <VideoOnIcon /> : <img src={videoOffUrl} width="24" height="20" alt="" />}
        </button>
      )}
    </div>
  );
}

/** "What does this mean?" — the plain explanation the model sent with the card. */
function Explain({ text }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="explain">
      <button className="explain-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? t('cards.hideExplain') : t('cards.explain')}
      </button>
      {open && <p>{text}</p>}
    </div>
  );
}

/** One answer pill. While Ayu works on the reply, the tapped pill shows a spinner and the others rest. */
function Pill({ pending, me, className = 'answer', onClick, children, ...rest }) {
  const busy = pending != null;
  const mine = busy && pending === me;
  return (
    <button className={`${className} ${mine ? 'picked' : ''}`} disabled={busy} aria-busy={mine || undefined} onClick={onClick} {...rest}>
      {children}
      {mine && <Spinner light />}
    </button>
  );
}

/**
 * Renders whichever card the model (or the mock) asked for.
 * onAnswer(answer, meta) — meta.label is the text she saw (sent to the model).
 * pending — the answer she tapped while Ayu is replying (spinner on that pill).
 * onPrevious — go back and change the last answer (shown when there is one).
 */
export function QuestionCard({ card, onAnswer, onCamera, pending = null, onPrevious, editing = false }) {
  const { t } = useT();
  const [picked, setPicked] = useState([]);
  if (!card) return null;
  const pend = pending;
  const head = (
    <>
      <div className="card-head">
        {onPrevious && (
          <button className="prev-btn" onClick={onPrevious} disabled={pend != null}>
            ← {t('cards.previous')}
          </button>
        )}
      </div>
      <h2 className="question">{card.question || card.instruction}</h2>
      <Explain text={card.explain} />
    </>
  );

  // "Not sure" is a camera button (UI rule 1) unless the model said not_sure_action: none.
  const notSureBtn = (
    <Pill
      pending={pend}
      me="not_sure"
      className="answer camera"
      onClick={() => (card.notSure === 'none' || editing ? onAnswer('not_sure', { label: t('common.notSure') }) : onCamera())}
    >
      {card.notSure !== 'none' && !editing && <img src={cameraUrl} alt="" width="30" height="26" />}
      {t('common.notSure')}
    </Pill>
  );

  // Yes/no with pictures (Figma S4, C2): the yes answers ARE the pictures, then No and Not sure.
  if (card.kind === 'yes_no' && card.pictureSet && PICTURES[card.pictureSet]) {
    const normal = PICTURE_NORMAL[card.pictureSet];
    const tiles = PICTURES[card.pictureSet].filter((p) => p.key !== normal);
    return (
      <>
        {head}
        <div className="pictures two">
          {tiles.map((p) => {
            const label = `${t('common.yes')} — ${t(`pictures.${card.pictureSet}.${p.key}`).toLowerCase()}`;
            return (
              <Pill key={p.key} pending={pend} me={p.key} className="picture" onClick={() => onAnswer('yes', { picture: p.key, label })}>
                {p.art}
                {label}
              </Pill>
            );
          })}
        </div>
        <Pill pending={pend} me="no" onClick={() => onAnswer('no', { ...(normal ? { picture: normal } : {}), label: t('common.no') })}>
          {t('common.no')}
        </Pill>
        {notSureBtn}
        <p className="picture-note">{t('pictures.note')}</p>
      </>
    );
  }

  if (card.pictureSet && card.kind !== 'yes_no') {
    const set = PICTURES[card.pictureSet] || [];
    return (
      <>
        {head}
        <div className="pictures">
          {set.map((p) => {
            const label = t(`pictures.${card.pictureSet}.${p.key}`);
            return (
              <Pill key={p.key} pending={pend} me={p.key} className="picture" onClick={() => onAnswer(label, { picture: p.key, label })}>
                {p.art}
                {label}
              </Pill>
            );
          })}
        </div>
        {!editing && CAMERA_SETS.has(card.pictureSet) && (
          <button className="answer camera" onClick={onCamera} disabled={pend != null}>
            <img src={cameraUrl} alt="" width="30" height="26" />
            {t('call.showOnCamera')}
          </button>
        )}
        <p className="picture-note">{t('pictures.note')}</p>
      </>
    );
  }

  if (card.kind === 'yes_no') {
    return (
      <>
        {head}
        <div className="pill-row">
          <Pill pending={pend} me="yes" onClick={() => onAnswer('yes', { label: t('common.yes') })}>
            {t('common.yes')}
          </Pill>
          <Pill pending={pend} me="no" onClick={() => onAnswer('no', { label: t('common.no') })}>
            {t('common.no')}
          </Pill>
        </div>
        {notSureBtn}
      </>
    );
  }

  if (card.kind === 'single') {
    return (
      <>
        {head}
        {card.options.map((o) => (
          <Pill key={o.label} pending={pend} me={o.label} onClick={() => onAnswer(o.label, { label: o.label })}>
            {o.label}
          </Pill>
        ))}
        {card.somethingElse && (
          <Pill pending={pend} me="__else" onClick={() => onAnswer(t('common.somethingElse'), { label: t('common.somethingElse') })}>
            {t('common.somethingElse')}
          </Pill>
        )}
      </>
    );
  }

  if (card.kind === 'multi') {
    const toggle = (label) => setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));
    return (
      <>
        {head}
        {card.options.map((o) => {
          const on = picked.includes(o.label);
          return (
            <button key={o.label} className={`answer ${on ? 'on' : ''}`} aria-pressed={on} disabled={pend != null} onClick={() => toggle(o.label)}>
              {o.label}
              {on && <span aria-hidden="true">✓</span>}
            </button>
          );
        })}
        {card.noneOption && (
          <Pill pending={pend} me="__none" onClick={() => onAnswer([], { label: t('common.noneOfThese') })}>
            {t('common.noneOfThese')}
          </Pill>
        )}
        <Pill pending={pend} me="__done" className="btn" style={{ marginTop: 6 }} onClick={() => onAnswer(picked, { label: picked.join(', ') })}>
          {t('common.done')}
        </Pill>
      </>
    );
  }

  if (card.kind === 'duration') {
    return (
      <>
        {head}
        <div className="chip-grid">
          {card.options.map((k) => (
            <Pill key={k} pending={pend} me={k} className="answer chipish" onClick={() => onAnswer(k, { label: t(`cards.duration.${k}`) })}>
              {t(`cards.duration.${k}`)}
            </Pill>
          ))}
        </div>
        <Pill pending={pend} me="dont_know" className="answer quiet" onClick={() => onAnswer('dont_know', { label: t('cards.dontKnow') })}>
          {t('cards.dontKnow')}
        </Pill>
      </>
    );
  }

  if (card.kind === 'severity') {
    return (
      <>
        {head}
        {card.options.map((k) => (
          <Pill key={k} pending={pend} me={k} className={`answer sev sev-${k}`} onClick={() => onAnswer(k, { label: t(`cards.severity.${k}`) })}>
            <span className="sev-text">
              <b>{t(`cards.severity.${k}`)}</b>
              <small>{t(`cards.severity.${k}Def`)}</small>
            </span>
          </Pill>
        ))}
      </>
    );
  }

  if (card.kind === 'body') {
    return (
      <>
        {head}
        <BodyMap pending={pend} onPick={(area) => onAnswer(area, { label: t(`cards.body.${area}`) })} />
      </>
    );
  }

  if (card.kind === 'search') {
    return (
      <>
        {head}
        <SymptomSearch pending={pend} onPick={(key, label) => onAnswer(label, { symptom: key || undefined, label })} />
      </>
    );
  }

  if (card.kind === 'photo') {
    return (
      <>
        {head}
        <button className="answer camera" onClick={onCamera} disabled={pend != null}>
          <img src={cameraUrl} alt="" width="30" height="26" />
          {t('call.openCamera')}
        </button>
        <Pill pending={pend} me="skip_photo" onClick={() => onAnswer('skip_photo', { label: t('s9.skip') })}>
          {t('s9.skip')}
        </Pill>
      </>
    );
  }
  return null;
}

// Simple outline, seen from the front; her left is on the right of the screen (labelled).
const AREAS = {
  head: { d: 'M100 8a24 26 0 1 1 0 52a24 26 0 1 1 0-52z' },
  neck: { d: 'M88 60h24v16H88z' },
  chest: { d: 'M62 78h76l-4 52H66z' },
  upper_belly_right: { d: 'M66 132h34v34H64z' },
  upper_belly_left: { d: 'M100 132h34l2 34h-36z' },
  lower_belly_right: { d: 'M64 168h36v40H70q-8-14-6-40z' },
  lower_belly_left: { d: 'M100 168h36q2 26-6 40h-30z' },
  legs_feet: { d: 'M72 212h56l-6 110h-18l-4-80-4 80H78z' },
};

function BodyMap({ onPick, pending }) {
  const { t } = useT();
  const [sel, setSel] = useState(null);
  const pick = (a) => {
    if (pending != null) return;
    setSel(a);
    onPick(a);
  };
  return (
    <div className="body-map">
      <svg viewBox="0 0 200 330" role="group">
        <path d="M60 80q-18 4-22 40l-6 70h12l8-60M140 80q18 4 22 40l6 70h-12l-8-60" fill="none" stroke="#6f6a7c" strokeWidth="3" strokeLinecap="round" />
        {Object.entries(AREAS).map(([k, a]) => (
          <path
            key={k}
            d={a.d}
            className={`area ${sel === k ? 'on' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={t(`cards.body.${k}`)}
            aria-pressed={sel === k}
            onClick={() => pick(k)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && pick(k)}
          />
        ))}
        <text x="18" y="160" className="side">
          {t('cards.body.right')}
        </text>
        <text x="182" y="160" className="side" textAnchor="end">
          {t('cards.body.left')}
        </text>
      </svg>
      <div className="body-side">
        <Pill pending={pending} me="back" className="answer" onClick={() => pick('back')}>
          {t('cards.body.back')}
        </Pill>
        {sel && (
          <p className="hint" aria-live="polite">
            {t('cards.body.picked', { area: t(`cards.body.${sel}`) })} {pending != null && <Spinner light />}
          </p>
        )}
      </div>
    </div>
  );
}

/** Type a symptom; suggestions come from a fixed local list in her language (nothing is sent while typing). */
function SymptomSearch({ onPick, pending }) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const list = useMemo(() => SYMPTOM_KEYS.map((k) => ({ k, label: t(`symptoms.${k}`) })), [t]);
  const norm = (s) => s.toLocaleLowerCase().normalize('NFC');
  const hits = q.trim() ? list.filter((x) => norm(x.label).includes(norm(q.trim()))).slice(0, 5) : list.slice(0, 4);
  return (
    <div className="search">
      <input
        className="search-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('cards.typeSymptom')}
        aria-label={t('cards.typeSymptom')}
        disabled={pending != null}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim()) onPick(hits[0]?.k || null, hits[0]?.label || q.trim());
        }}
      />
      {hits.map((x) => (
        <Pill key={x.k} pending={pending} me={x.label} className="answer chipish" onClick={() => onPick(x.k, x.label)}>
          {x.label}
        </Pill>
      ))}
      {q.trim() && !hits.length && <p className="hint">{t('cards.noMatch')}</p>}
    </div>
  );
}

/** "Not sure" → camera turn: what to show, and one button to stop. The preview is in the video tile. */
export function CameraTurnPanel({ purpose, onDone }) {
  const { t } = useT();
  return (
    <>
      <h2 className="question">{t(`call.cameraTurn.${purpose}`)}</h2>
      <p className="hint" style={{ fontSize: 15 }}>
        {t('call.cameraTurnHint')}
      </p>
      <button className="btn" style={{ marginTop: 8 }} onClick={onDone}>
        {t('call.doneShowing')}
      </button>
    </>
  );
}

