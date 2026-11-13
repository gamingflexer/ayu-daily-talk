import { useState } from 'react';
import { useT } from '../i18n/index.jsx';
import { PICTURES } from './pictures.jsx';
import { PICTURE_NORMAL } from '../../shared/talk-state.js';
import womanUrl from '../assets/figma/woman-illustration.svg';
import closeUrl from '../assets/figma/icon-close.svg';
import pauseUrl from '../assets/figma/icon-pause.svg';
import videoOffUrl from '../assets/figma/icon-video-off.svg';
import cameraUrl from '../assets/figma/icon-camera.svg';
import { PlayIcon, SpeakerIcon, VideoOnIcon } from './ui.jsx';

/** Her camera tile. Illustration until she turns the camera on (no avatar, no real person). */
export function HerVideo({ height = 360, stream, back = false, pill, live = true, modeTag, caption, children }) {
  const { t } = useT();
  return (
    <div className="her-video" style={{ '--video-h': `${height}px` }}>
      {stream ? (
        <video
          className={back ? 'back' : ''}
          autoPlay
          muted
          playsInline
          ref={(el) => {
            if (el && el.srcObject !== stream) el.srcObject = stream;
          }}
        />
      ) : (
        <img className="illus" src={womanUrl} alt="" />
      )}
      {back && stream && <div className="cam-guide" aria-hidden="true" />}
      {pill && (
        <div className="call-pill">
          <span className={`dot ${live ? '' : 'off'}`} />
          {pill}
        </div>
      )}
      {modeTag && <span className="mode-tag">{modeTag}</span>}
      {caption ? (
        <div className="caption" aria-live="polite">
          <span className="who">{caption.who === 'her' ? t('call.you') : 'Ayu'}</span>
          {caption.text}
        </div>
      ) : (
        <span className="tag">{stream ? t('call.cameraOn') : t('call.herCamera')}</span>
      )}
      {children}
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

/** Renders whichever card the model (or the mock) asked for. */
export function QuestionCard({ card, onAnswer, onCamera }) {
  const { t } = useT();
  const [picked, setPicked] = useState([]);
  if (!card) return null;

  // "Not sure" is a camera button (UI rule 1) unless the model said not_sure_action: none.
  const notSureBtn = (
    <button className="answer camera" onClick={() => (card.notSure === 'none' ? onAnswer('not_sure') : onCamera())}>
      {card.notSure !== 'none' && <img src={cameraUrl} alt="" width="30" height="26" />}
      {t('common.notSure')}
    </button>
  );

  // Yes/no with pictures (Figma S4, C2): the yes answers ARE the pictures, then No and Not sure.
  if (card.kind === 'yes_no' && card.pictureSet && PICTURES[card.pictureSet]) {
    const normal = PICTURE_NORMAL[card.pictureSet];
    const tiles = PICTURES[card.pictureSet].filter((p) => p.key !== normal);
    return (
      <>
        <h2 className="question">{card.question}</h2>
        <div className="pictures two">
          {tiles.map((p) => (
            <button key={p.key} className="picture" onClick={() => onAnswer('yes', { picture: p.key })}>
              {p.art}
              {t('common.yes')} — {t(`pictures.${card.pictureSet}.${p.key}`).toLowerCase()}
            </button>
          ))}
        </div>
        <button className="answer" onClick={() => onAnswer('no', normal ? { picture: normal } : {})}>
          {t('common.no')}
        </button>
        {notSureBtn}
        <p className="picture-note">{t('pictures.note')}</p>
      </>
    );
  }

  if (card.pictureSet && card.kind !== 'yes_no') {
    const set = PICTURES[card.pictureSet] || [];
    return (
      <>
        <h2 className="question">{card.question}</h2>
        <div className="pictures">
          {set.map((p) => {
            const label = t(`pictures.${card.pictureSet}.${p.key}`);
            return (
              <button key={p.key} className="picture" onClick={() => onAnswer(label, { picture: p.key })}>
                {p.art}
                {label}
              </button>
            );
          })}
        </div>
        <button className="answer camera" onClick={onCamera}>
          <img src={cameraUrl} alt="" width="30" height="26" />
          {t('call.showOnCamera')}
        </button>
        <p className="picture-note">{t('pictures.note')}</p>
      </>
    );
  }

  if (card.kind === 'yes_no') {
    return (
      <>
        <h2 className="question">{card.question}</h2>
        <button className="answer" onClick={() => onAnswer('yes')}>
          {t('common.yes')}
        </button>
        <button className="answer" onClick={() => onAnswer('no')}>
          {t('common.no')}
        </button>
        {notSureBtn}
        <p className="hint">{t('call.listening')}</p>
      </>
    );
  }

  if (card.kind === 'single') {
    return (
      <>
        <h2 className="question">{card.question}</h2>
        {card.options.map((o) => (
          <button key={o.label} className="answer" onClick={() => onAnswer(o.label)}>
            {o.label}
          </button>
        ))}
        {card.somethingElse && (
          <button className="answer" onClick={() => onAnswer(t('common.somethingElse'))}>
            {t('common.somethingElse')}
          </button>
        )}
      </>
    );
  }

  if (card.kind === 'multi') {
    const toggle = (label) => setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));
    return (
      <>
        <h2 className="question">{card.question}</h2>
        {card.options.map((o) => {
          const on = picked.includes(o.label);
          return (
            <button key={o.label} className={`answer ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(o.label)}>
              {o.label}
              {on && <span aria-hidden="true">✓</span>}
            </button>
          );
        })}
        {card.noneOption && (
          <button className="answer" onClick={() => onAnswer([])}>
            {t('common.noneOfThese')}
          </button>
        )}
        <button className="btn" style={{ marginTop: 6 }} onClick={() => onAnswer(picked)}>
          {t('common.done')}
        </button>
      </>
    );
  }

  if (card.kind === 'photo') {
    return (
      <>
        <h2 className="question">{card.instruction}</h2>
        <button className="answer camera" onClick={onCamera}>
          <img src={cameraUrl} alt="" width="30" height="26" />
          {t('call.openCamera')}
        </button>
        <button className="answer" onClick={() => onAnswer('skip_photo')}>
          {t('s9.skip')}
        </button>
      </>
    );
  }
  return null;
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

/** Video height per card, so the answers fit at 360 × 640. */
export function videoHeightFor(card) {
  if (!card) return 360;
  if (card.kind === 'yes_no' && card.pictureSet) return 120;
  if (card.pictureSet && card.kind !== 'yes_no') return 150;
  if (card.kind === 'multi') return 96;
  if (card.kind === 'single') return 200;
  return 300;
}
