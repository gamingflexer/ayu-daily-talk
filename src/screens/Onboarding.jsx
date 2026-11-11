import { useEffect, useRef, useState } from 'react';
import { Screen, Logo, Button, Chip, Card } from '../components/ui.jsx';
import { useT, LANG_LABELS } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { go, href } from '../router.js';

/** S1 · Web entry — phone number only. */
export function EntryScreen() {
  const { t, lang, setLang } = useT();
  const { update } = useApp();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [soon, setSoon] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) return setError(t('s1.invalid'));
    update({ phone: digits });
    go('/otp');
  };

  return (
    <Screen>
      <form onSubmit={submit} style={{ display: 'contents' }}>
        <div className="body" style={{ paddingTop: 56, gap: 18 }}>
          <Logo width={112} />
          <h1 className="h1 lg">{t('s1.title')}</h1>
          <p className="lead">{t('s1.lead')}</p>
          <label className="field">
            <span>+91</span>
            <input
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={11}
              placeholder={t('s1.placeholder')}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/[^\d ]/g, ''));
                setError('');
              }}
              aria-label={t('s1.phoneLabel')}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="chips" role="group" aria-label={t('common.language')}>
            <Chip on={lang === 'hi'} type="button" onClick={() => setLang('hi')}>
              {LANG_LABELS.hi}
            </Chip>
            <Chip type="button" onClick={() => setSoon(true)}>
              {LANG_LABELS.mr}
            </Chip>
            <Chip on={lang === 'en'} type="button" onClick={() => setLang('en')}>
              {LANG_LABELS.en}
            </Chip>
            <Chip type="button" onClick={() => setSoon(true)}>
              {t('s1.moreLangs')}
            </Chip>
          </div>
          {soon && <p className="small">{t('s1.soon')}</p>}
        </div>
        <div className="foot">
          <Button type="submit">{t('s1.cta')}</Button>
          <p className="small">{t('s1.foot')}</p>
          <a className="small" href={href('/screens')}>
            {t('app.demoMap')}
          </a>
        </div>
      </form>
    </Screen>
  );
}

/** S2 · OTP → straight into today. Mock: any 6 digits work. */
export function OtpScreen() {
  const { t } = useT();
  const { phone } = useApp();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [left, setLeft] = useState(24);
  const refs = useRef([]);
  const masked = phone ? `${phone.slice(0, 2)}•• ••• ${phone.slice(-3)}` : '98•• ••• 210';

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const set = (i, v) => {
    const digits = v.replace(/\D/g, '');
    if (digits.length > 1) {
      // pasted the whole code
      const next = digits.slice(0, 6).split('');
      while (next.length < 6) next.push('');
      setCode(next);
      if (digits.length >= 6) return done(next);
      refs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }
    const next = [...code];
    next[i] = digits;
    setCode(next);
    if (digits && i < 5) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) done(next);
  };

  const done = () => setTimeout(() => go('/today'), 250);

  return (
    <Screen>
      <div className="body" style={{ paddingTop: 56, gap: 18 }}>
        <h1 className="h1" style={{ fontSize: 22, lineHeight: '27px', fontWeight: 600 }}>
          {t('s2.title', { phone: masked })}
        </h1>
        <div className="otp">
          {code.map((d, i) => (
            <input
              key={i}
              ref={(el) => (refs.current[i] = el)}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              aria-label={t('s2.digit', { n: i + 1 })}
              value={d}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && !code[i] && i > 0) refs.current[i - 1]?.focus();
              }}
            />
          ))}
        </div>
        <p className="lead" style={{ fontSize: 14 }}>
          {t('s2.lead')}
        </p>
        <Card tone="green" style={{ fontWeight: 400, color: 'var(--ink)' }}>
          <h3 style={{ color: 'var(--green)', fontSize: 14 }}>{t('s2.cardTitle')}</h3>
          <p style={{ fontSize: 13, lineHeight: '18px' }}>{t('s2.cardBody')}</p>
        </Card>
        <p className="small">{t('s2.mockHint')}</p>
      </div>
      <div className="foot" style={{ textAlign: 'left' }}>
        {left > 0 ? (
          <p className="small">{t('s2.resend', { time: `0:${String(left).padStart(2, '0')}` })}</p>
        ) : (
          <button className="link" style={{ textAlign: 'left', padding: 0 }} onClick={() => setLeft(24)}>
            {t('s2.resendNow')}
          </button>
        )}
      </div>
    </Screen>
  );
}
