import { useState } from 'react';
import { Screen, Circle, Mono, Btn, Field, Sheet, Rows, Row } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { LangSheet } from '../ui/lang.jsx';
import { useT } from '../i18n/index.jsx';
import { LANG_LABELS } from '../i18n/dicts.js';
import { useStore } from '../store.jsx';
import { go, swap } from '../router.js';
import { validPhone, stageLine } from '../ui/words.js';
import { weeksNow, ruleContext } from '../../shared/journal.js';
import { StageFields, stageData } from './Start.jsx';

const digits = (v) => v.replace(/\D/g, '').slice(0, 10);
const isoDay = (ms) => {
  const d = new Date(ms || Date.now());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Her details, language, and whose app this phone opens.
 * [Inferred — not on the boards] Same form pattern as sign-up.
 */
export function MeScreen() {
  const { t, lang } = useT();
  const { role, woman, ctx, asha, womenList, updateWoman, setAsha, setRole, setActive, erase } = useStore();
  const isAsha = role === 'asha';
  const [name, setName] = useState((isAsha ? asha?.name : woman?.name) || '');
  const [phone, setPhone] = useState((isAsha ? asha?.phone : woman?.phone) || '');
  const [stage, setStage] = useState(woman?.stage || 'pregnant');
  const [weeks, setWeeks] = useState(weeksNow(woman) || 20);
  const [birth, setBirth] = useState(isoDay(woman?.birthAt));
  const [ashaName, setAshaName] = useState(woman?.ashaName || '');
  const [ashaPhone, setAshaPhone] = useState(woman?.ashaPhone || '');
  const [centre, setCentre] = useState(woman?.centre || '');
  const [err, setErr] = useState('');
  const [sheet, setSheet] = useState(null);
  const home = isAsha ? '/asha' : '/home';

  const save = () => {
    setErr('');
    if (!name.trim()) return setErr(t('start.nameBad'));
    if (!validPhone(phone) || (ashaPhone && !validPhone(ashaPhone))) return setErr(t('start.phoneBad'));
    if (isAsha) setAsha({ name: name.trim(), phone });
    else {
      const st = stageData(stage, weeks, birth);
      const sameWeek = st.stage === 'pregnant' && woman.stage === 'pregnant' && weeks === weeksNow(woman);
      if (sameWeek) delete st.weeksAtStart;
      updateWoman(woman.id, { name: name.trim(), phone, ...st, ashaName: ashaName.trim(), ashaPhone, centre: centre.trim() });
    }
    return go(home);
  };

  return (
    <Screen aura={{ tone: 'home', pos: 'topLeft' }}>
      <div className="top">
        <Circle icon="back" label={t('common.back')} iconSize={22} onClick={() => go(home)} />
        <Mono>{isAsha ? 'ASHA' : stageLine(woman, ctx, t)}</Mono>
        <span style={{ width: 48 }} />
      </div>
      <div className="scroll">
        <h1 className="h-lg question" style={{ paddingBottom: 14 }}>{t('me.title')}</h1>
        <div className="form" style={{ paddingTop: 0, paddingBottom: 20 }}>
          <Field label={t('me.name')} value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} />
          <Field label={t('me.phone')} placeholder={t('start.phonePh')} value={phone} onChange={(e) => setPhone(digits(e.target.value))} inputMode="numeric" />
          {!isAsha && (
            <>
              <StageFields stage={stage} setStage={setStage} weeks={weeks} setWeeks={setWeeks} birth={birth} setBirth={setBirth} />
              <Field label={t('me.ashaName')} placeholder={t('start.ashaNamePh')} value={ashaName} onChange={(e) => setAshaName(e.target.value.slice(0, 40))} />
              <Field label={t('me.ashaPhone')} placeholder={t('start.phonePh')} value={ashaPhone} onChange={(e) => setAshaPhone(digits(e.target.value))} inputMode="numeric" />
              <Field label={t('me.centre')} placeholder={t('start.centrePh')} value={centre} onChange={(e) => setCentre(e.target.value.slice(0, 60))} />
            </>
          )}
          {err && <p className="field-error" role="alert">{err}</p>}

          <Rows>
            <Row label={t('me.language')} value={<span lang={lang}>{LANG_LABELS[lang]}</span>} onClick={() => setSheet('lang')} action={<Icon name="chevron" />} />
            {isAsha ? (
              // Patient view: open any woman's own app on this phone (Om, 21 Nov: no way out of the ASHA view).
              (womenList.length ? womenList : [null]).map((w) =>
                w ? (
                  <Row
                    key={w.id}
                    label={stageLine(w, ruleContext(w), t)}
                    value={t('me.switchWoman', { name: w.name })}
                    onClick={() => {
                      setActive(w.id);
                      setRole('woman');
                      swap('/home');
                    }}
                    action={<Icon name="chevron" />}
                  />
                ) : (
                  <Row key="new" label={t('welcome.womanSub')} value={t('welcome.woman')} onClick={() => go('/start/woman')} action={<Icon name="chevron" />} />
                ),
              )
            ) : (
              <Row
                label={t('welcome.asha')}
                value={t('me.switchAsha')}
                onClick={() => {
                  if (asha) {
                    setRole('asha');
                    swap('/asha');
                  } else go('/start/asha');
                }}
                action={<Icon name="chevron" />}
              />
            )}
          </Rows>
          <p className="small" style={{ padding: '0 8px' }}>{t('welcome.private')}</p>
          <button type="button" className="link" style={{ color: 'var(--red)' }} onClick={() => setSheet('erase')}>
            {t('me.erase')}
          </button>
        </div>
      </div>
      <div className="dock last" style={{ paddingTop: 12 }}>
        <Btn onClick={save}>{t('common.save')}</Btn>
      </div>

      {sheet === 'lang' && <LangSheet onClose={() => setSheet(null)} />}
      {sheet === 'erase' && (
        <Sheet title={t('me.eraseTitle')} onClose={() => setSheet(null)} closeLabel={t('common.close')}>
          <p className="body" style={{ padding: '0 8px' }}>{t('me.eraseBody')}</p>
          {/* The safe choice is the bright one (rule 7). */}
          <Btn onClick={() => setSheet(null)}>{t('me.eraseKeep')}</Btn>
          <Btn
            kind="ghost"
            style={{ color: 'var(--red)' }}
            onClick={() => {
              erase();
              swap('/home');
            }}
          >
            {t('me.eraseYes')}
          </Btn>
        </Sheet>
      )}
    </Screen>
  );
}
