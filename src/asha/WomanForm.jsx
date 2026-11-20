// ASHA · Add a woman / Edit her details. Everything is saved on this phone.
import { useState } from 'react';
import { useT, LANG_LABELS, LANG_ORDER } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { back, swap } from '../router.js';
import { Screen, Circle, Btn, Field, Sheet } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { validPhone } from '../ui/words.js';
import { dayKey } from '../../shared/journal.js';
import { weekForForm } from './look.js';
import { useNow } from './hooks.js';

const toDate = (v) => {
  const [y, m, d] = String(v || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d).getTime() : null;
};

export function AshaWomanForm({ id }) {
  const { t, lang: appLang } = useT();
  const store = useStore();
  const woman = id ? store.women[id] : null;
  const editing = Boolean(id);

  const startWeek = weekForForm(woman);
  const [f, setF] = useState(() => ({
    name: woman?.name || '',
    phone: woman?.phone || '',
    age: woman?.age ? String(woman.age) : '',
    stage: woman?.stage || 'pregnant',
    week: startWeek,
    birth: woman?.birthAt ? dayKey(woman.birthAt) : '',
    village: woman?.village || '',
    lang: woman?.lang || appLang || 'hi',
  }));
  const now = useNow();
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const put = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  if (editing && !woman) {
    return (
      <Screen>
        <div className="top">
          <Circle icon="back" label={t('asha.back')} onClick={() => back('/asha/women')} />
        </div>
        <div className="hero">
          <p className="body-lg">{t('asha.woman.missing')}</p>
        </div>
      </Screen>
    );
  }

  const age = f.age.trim() ? Number(f.age) : null;
  const errors = {
    name: !f.name.trim() ? t('asha.form.nameBad') : '',
    phone: f.phone.trim() && !validPhone(f.phone) ? t('asha.form.phoneBad') : '',
    age: age !== null && !(Number.isInteger(age) && age >= 12 && age <= 60) ? t('asha.form.ageBad') : '',
    birth: f.stage === 'postnatal' && !toDate(f.birth) ? t('asha.form.birthBad') : '',
  };
  const ok = !Object.values(errors).some(Boolean);

  function save() {
    setTried(true);
    if (!ok) return;
    const fields = {
      name: f.name.trim().replace(/\s+/g, ' '),
      phone: f.phone.replace(/\D/g, ''),
      age,
      stage: f.stage,
      village: f.village.trim(),
      lang: f.lang,
      // Her ASHA is the one using this phone (only when one has set up the ASHA app).
      ...(store.asha?.name ? { ashaName: store.asha.name, ashaPhone: store.asha.phone || '' } : {}),
    };
    if (f.stage === 'pregnant') {
      // Only send the week when it changed, so the count of weeks keeps running.
      if (!editing || woman.stage !== 'pregnant' || f.week !== startWeek) fields.weeksAtStart = f.week;
      fields.birthAt = null;
    } else {
      fields.birthAt = toDate(f.birth);
    }
    if (editing) {
      store.updateWoman(id, fields);
      back(`/asha/w/${encodeURIComponent(id)}`);
    } else {
      const newId = store.addWoman(fields);
      swap(`/asha/w/${encodeURIComponent(newId)}`);
    }
  }

  function remove() {
    store.removeWoman(id);
    swap('/asha/women');
  }

  const err = (k) => tried && errors[k] && <span className="field-error">{errors[k]}</span>;

  return (
    <Screen>
      <div className="top">
        <Circle icon="back" label={t('asha.back')} onClick={() => back('/asha/women')} />
      </div>
      <div className="hero tight">
        <h1 className="h-lg">{t(editing ? 'asha.form.editTitle' : 'asha.form.addTitle')}</h1>
      </div>

      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="a-fieldwrap">
          <Field label={t('asha.form.name')} value={f.name} onChange={put('name')} placeholder={t('asha.form.namePh')} autoComplete="off" maxLength={60} required />
          {err('name')}
        </div>
        <div className="a-fieldwrap">
          <Field label={t('asha.form.phone')} value={f.phone} onChange={put('phone')} placeholder={t('asha.form.phonePh')} inputMode="numeric" autoComplete="off" maxLength={14} />
          {err('phone')}
        </div>
        <div className="a-fieldwrap">
          <Field label={t('asha.form.age')} value={f.age} onChange={put('age')} placeholder={t('asha.form.agePh')} inputMode="numeric" maxLength={2} />
          {err('age')}
        </div>

        <div className="field">
          <span className="field-label">{t('asha.form.stage')}</span>
          <div className="choice">
            {['pregnant', 'postnatal'].map((s) => (
              <button key={s} type="button" aria-pressed={f.stage === s} onClick={() => setF((p) => ({ ...p, stage: s }))}>
                {t(`asha.form.${s}`)}
              </button>
            ))}
          </div>
        </div>

        {f.stage === 'pregnant' ? (
          <div className="field">
            <span className="field-label">{t('asha.form.week')}</span>
            <div className="stepper">
              <Circle icon="minus" tone="line" size={52} label={t('asha.form.fewer')} disabled={f.week <= 4} onClick={() => setF((p) => ({ ...p, week: Math.max(4, p.week - 1) }))} />
              <output aria-live="polite">{t('asha.form.weekN', { n: f.week })}</output>
              <Circle icon="plus" tone="line" size={52} label={t('asha.form.more')} disabled={f.week >= 42} onClick={() => setF((p) => ({ ...p, week: Math.min(42, p.week + 1) }))} />
            </div>
          </div>
        ) : (
          <div className="a-fieldwrap">
            <Field label={t('asha.form.birth')} type="date" value={f.birth} onChange={put('birth')} max={dayKey(now)} />
            {err('birth')}
          </div>
        )}

        <Field label={t('asha.form.village')} value={f.village} onChange={put('village')} placeholder={t('asha.form.villagePh')} maxLength={60} />

        <div className="field">
          <span className="field-label">{t('asha.form.lang')}</span>
          <div className="langs">
            {LANG_ORDER.map((l) => (
              <button key={l} type="button" lang={l} aria-pressed={f.lang === l} onClick={() => setF((p) => ({ ...p, lang: l }))}>
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
        </div>

        <div className="a-form-end">
          <Btn type="submit">{t('asha.form.save')}</Btn>
          {editing && (
            <button type="button" className="a-side-link" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={18} />
              {t('asha.form.remove')}
            </button>
          )}
        </div>
      </form>

      {confirm && (
        <Sheet title={t('asha.form.removeTitle', { name: woman.name })} onClose={() => setConfirm(false)} closeLabel={t('asha.close')}>
          <p className="body a-sheet-body">{t('asha.form.removeBody')}</p>
          <Btn onClick={() => setConfirm(false)}>{t('asha.form.keep')}</Btn>
          <Btn kind="ghost" onClick={remove}>
            {t('asha.form.removeYes')}
          </Btn>
        </Sheet>
      )}
    </Screen>
  );
}
