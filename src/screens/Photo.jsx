import { useEffect, useRef, useState } from 'react';
import { Screen, TextLink, Button } from '../components/ui.jsx';
import { useT } from '../i18n/index.jsx';
import { PICTURES } from '../components/pictures.jsx';

// S9 · A photo only when it helps: the medicine strip, a face-free patch of
// skin, her feet, or a document. Never her face or private body parts.
const COPY = {
  medicine_strip: { title: 's9.title', body: 's9.body', frame: 's9.frame' },
  skin_patch: { title: 's9.skinTitle', body: 's9.skinBody', frame: 's9.skinFrame' },
  feet: { title: 's9.feetTitle', body: 's9.feetBody', frame: 's9.feetFrame' },
  document: { title: 's9.docTitle', body: 's9.docBody', frame: 's9.docFrame' },
};

export function PhotoView({ purpose = 'medicine_strip', onPhoto, onSkip, mockRead = true }) {
  const { t } = useT();
  const copy = COPY[purpose] || COPY.medicine_strip;
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [noCam, setNoCam] = useState(() => !navigator.mediaDevices);
  const [phase, setPhase] = useState('aim'); // aim → reading → confirm
  const lastRef = useRef(null);

  useEffect(() => {
    let s;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      .then((st) => {
        if (cancelled) return st.getTracks().forEach((x) => x.stop());
        s = st;
        setStream(st);
      })
      .catch(() => setNoCam(true));
    return () => {
      cancelled = true;
      s?.getTracks().forEach((x) => x.stop());
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const shoot = () => {
    let b64 = null;
    const v = videoRef.current;
    if (v && v.videoWidth) {
      const c = document.createElement('canvas');
      const scale = Math.min(1, 1024 / v.videoWidth);
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      b64 = c.toDataURL('image/jpeg', 0.75).split(',')[1];
    }
    stream?.getTracks().forEach((x) => x.stop());
    if (!mockRead) return onPhoto?.(b64);
    setPhase('reading');
    setTimeout(() => setPhase('confirm'), 1200);
    lastRef.current = b64;
  };

  if (phase !== 'aim') {
    return (
      <Screen dark>
        <div className="viewfinder" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ width: '70%' }}>{PICTURES.medicine_strip[0].art}</div>
        </div>
        <div className="call-body" style={{ paddingBottom: 24 }}>
          {phase === 'reading' ? (
            <h2 className="question">{t('s9.reading')}</h2>
          ) : purpose === 'medicine_strip' ? (
            <>
              <h2 className="question">{t('s9.confirmQ')}</h2>
              <p className="hint" style={{ fontSize: 16, color: '#fff' }}>
                {t('s9.confirmName')}
              </p>
              <button className="answer" onClick={() => onPhoto?.(lastRef.current, 'confirmed')}>
                {t('s9.confirmYes')}
              </button>
              <button className="answer" onClick={() => onPhoto?.(lastRef.current, 'not_this')}>
                {t('s9.confirmNo')}
              </button>
            </>
          ) : (
            <>
              <h2 className="question">{t('s9.sent')}</h2>
              <Button onClick={() => onPhoto?.(lastRef.current, 'sent')}>{t('common.next')}</Button>
            </>
          )}
        </div>
      </Screen>
    );
  }

  return (
    <Screen dark>
      <div className="viewfinder">
        {stream ? (
          <video ref={videoRef} autoPlay muted playsInline />
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: 'var(--call-video)' }} />
        )}
        <div className="instr">
          <strong>{t(copy.title)}</strong>
          <span>{t(copy.body)}</span>
        </div>
        <div className="frame-box">
          {!stream && purpose === 'medicine_strip' && <div style={{ width: '82%' }}>{PICTURES.medicine_strip[0].art}</div>}
        </div>
        <p className="frame-label">{noCam ? t('s9.noCamera') : t(copy.frame)}</p>
      </div>
      <div className="shutter-row">
        <TextLink onClick={onSkip}>{purpose === 'medicine_strip' ? t('s9.skip') : t('s9.skipLater')}</TextLink>
        <button className="shutter" onClick={shoot} aria-label={t('s9.shutter')} />
        <span style={{ width: 90 }} />
      </div>
    </Screen>
  );
}
