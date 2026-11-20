import { useState } from 'react';
import { Screen, Circle, Mono, Btn, Field } from '../ui/kit.jsx';
import { useT } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { go, swap } from '../router.js';
import { validPhone } from '../ui/words.js';

const digits = (v) => v.replace(/\D/g, '').slice(0, 10);
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Pregnant (week stepper) or baby born (date). Shared with the ASHA's "add a woman". */
export function StageFields({ stage, setStage, weeks, setWeeks, birth, setBirth }) {
  const { t } = useT();
  const todayIso = isoDay(new Date());
  return (
    <>
      <div className="choice">
        <button type="button" aria-pressed={stage === 'pregnant'} onClick={() => setStage('pregnant')}>
          {t('start.pregnant')}
        </button>
        <button type="button" aria-pressed={stage === 'postnatal'} onClick={() => setStage('postnatal')}>
          {t('start.postnatal')}
        </button>
      </div>
      {stage === 'pregnant' && (
        <div className="field">
          <span className="field-label">{t('start.weeks')}</span>
          <div className="stepper">
            <Circle icon="back" tone="line" size={52} label={t('start.fewer')} onClick={() => setWeeks(Math.max(4, weeks - 1))} />
            <output aria-live="polite">{t('start.weekN', { n: weeks })}</output>
            <Circle icon="arrow" tone="line" size={52} label={t('start.more')} onClick={() => setWeeks(Math.min(42, weeks + 1))} />
          </div>
          <span className="field-hint">{t('start.weeksHint')}</span>
        </div>
      )}
      {stage === 'postnatal' && <Field label={t('start.birth')} type="date" max={todayIso} value={birth} onChange={(e) => setBirth(e.target.value)} />}
    </>
  );
}

/** Turn the stage fields into what the store keeps. */
export function stageData(stage, weeks, birth) {
  if (stage === 'postnatal') return { stage, birthAt: birth ? new Date(`${birth}T12:00:00`).getTime() : Date.now() };
  return { stage: 'pregnant', weeksAtStart: weeks };
}

/**
 * A woman sets up her own phone: three short steps, one question each.
 * [Inferred — not on the boards] Uses the daily-check board's frame: back, step
 * counter, progress, the question as the heading, one action at the bottom.
 */
export function StartWoman() {
  const { t } = useT();
  const { addWoman } = useStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [stage, setStage] = useState('');
  const [weeks, setWeeks] = useState(20);
  const [birth, setBirth] = useState(isoDay(new Date()));
  const [ashaName, setAshaName] = useState('');
  const [ashaPhone, setAshaPhone] = useState('');
  const [centre, setCentre] = useState('');
  const [err, setErr] = useState('');

  const finish = () => {
    addWoman(
      { name: name.trim(), phone, ...stageData(stage, weeks, birth), ashaName: ashaName.trim(), ashaPhone: validPhone(ashaPhone) ? ashaPhone : '', centre: centre.trim() },
      { self: true },
    );
    swap('/home');
  };
  const next = () => {
    setErr('');
    if (step === 0) {
      if (!name.trim()) return setErr(t('start.nameBad'));
      if (!validPhone(phone)) return setErr(t('start.phoneBad'));
      return setStep(1);
    }
    if (step === 1) return setStep(2);
    if (ashaPhone && !validPhone(ashaPhone)) return setErr(t('start.phoneBad'));
    return finish();
  };

  return (
    <Screen aura={{ tone: 'home', pos: 'topLeft' }}>
      <div className="top">
        <Circle icon="back" label={t('common.back')} iconSize={22} onClick={() => (step === 0 ? go('/') : setStep(step - 1))} />
        <Mono>{t('start.step', { n: step + 1, total: 3 })}</Mono>
        <span style={{ width: 48 }} />
      </div>
      <div className="segs" aria-hidden="true">
        {[0, 1, 2].map((n) => (
          <span key={n} className={n <= step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <>
          <h1 className="h-lg question">{t('start.nameTitle')}</h1>
          <div className="form" style={{ paddingTop: 0 }}>
            <Field label={t('start.name')} placeholder={t('start.namePh')} value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} autoComplete="given-name" autoFocus />
            <Field label={t('start.phone')} placeholder={t('start.phonePh')} value={phone} onChange={(e) => setPhone(digits(e.target.value))} inputMode="numeric" autoComplete="tel-national" />
          </div>
        </>
      )}
      {step === 1 && (
        <>
          <h1 className="h-lg question">{t('start.stageTitle')}</h1>
          <div className="form" style={{ paddingTop: 0 }}>
            <StageFields stage={stage} setStage={setStage} weeks={weeks} setWeeks={setWeeks} birth={birth} setBirth={setBirth} />
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h1 className="h-lg question" style={{ paddingBottom: 8 }}>{t('start.ashaTitle')}</h1>
          <p className="body" style={{ padding: '0 24px 18px', color: 'var(--ink-2)' }}>{t('start.ashaLead')}</p>
          <div className="form" style={{ paddingTop: 0 }}>
            <Field label={t('start.ashaName')} placeholder={t('start.ashaNamePh')} value={ashaName} onChange={(e) => setAshaName(e.target.value.slice(0, 40))} />
            <Field label={t('start.ashaPhone')} placeholder={t('start.phonePh')} value={ashaPhone} onChange={(e) => setAshaPhone(digits(e.target.value))} inputMode="numeric" />
            <Field label={t('start.centre')} placeholder={t('start.centrePh')} value={centre} onChange={(e) => setCentre(e.target.value.slice(0, 60))} />
          </div>
        </>
      )}
      {err && <p className="field-error" role="alert" style={{ padding: '12px 24px 0' }}>{err}</p>}

      <div className="grow" />
      <div className="dock last">
        <Btn onClick={next} disabled={step === 1 && !stage}>
          {step === 2 ? t('start.finish') : t('common.next')}
        </Btn>
        {step === 2 && !ashaName && !ashaPhone && !centre && (
          <Btn kind="ghost" onClick={finish}>
            {t('common.skip')}
          </Btn>
        )}
      </div>
    </Screen>
  );
}

/** An ASHA sets up this phone. */
export function StartAsha() {
  const { t } = useT();
  const { setAsha } = useStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');
  const save = () => {
    if (!name.trim()) return setErr(t('start.nameBad'));
    if (!validPhone(phone)) return setErr(t('start.phoneBad'));
    setAsha({ name: name.trim(), phone });
    return swap('/asha');
  };
  return (
    <Screen aura={{ tone: 'home', pos: 'topLeft' }}>
      <div className="top">
        <Circle icon="back" label={t('common.back')} iconSize={22} onClick={() => go('/')} />
      </div>
      <h1 className="h-lg question" style={{ paddingBottom: 8 }}>{t('start.ashaSelfTitle')}</h1>
      <p className="body" style={{ padding: '0 24px 18px', color: 'var(--ink-2)' }}>{t('start.ashaSelfLead')}</p>
      <div className="form" style={{ paddingTop: 0 }}>
        <Field label={t('start.name')} placeholder={t('start.ashaNamePh')} value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} autoFocus />
        <Field label={t('start.phone')} placeholder={t('start.phonePh')} value={phone} onChange={(e) => setPhone(digits(e.target.value))} inputMode="numeric" />
      </div>
      {err && <p className="field-error" role="alert" style={{ padding: '12px 24px 0' }}>{err}</p>}
      <div className="grow" />
      <div className="dock last">
        <Btn onClick={save}>{t('start.ashaFinish')}</Btn>
      </div>
    </Screen>
  );
}
