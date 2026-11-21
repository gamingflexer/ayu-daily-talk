// ASHA · One woman (AshaPatient board): her level today, what to check, her answers, her BP.
import { useState } from 'react';
import { useT } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { go, swap, href } from '../router.js';
import { Screen, Circle, Mono, Btn, Field, Sheet, LEVEL_N } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { telHref, timeLabel, weekdayLabel, questionText, optionText } from '../ui/words.js';
import { initials, ruleContext, bpHistory, dayKey } from '../../shared/journal.js';
import { setFor, UNSURE } from '../../shared/question-sets.js';
import { assess } from '../../shared/triage.js';
import { dayState, firstName, profileLine, checkLines, questionHistory } from './look.js';
import { useNow } from './hooks.js';

const RANGES = [
  { id: 'today', days: 1 },
  { id: 'd3', days: 3 },
  { id: 'd14', days: 14 },
];

export function AshaWoman({ id }) {
  const { t, lang } = useT();
  const store = useStore();
  const woman = store.women[id];
  const [bpOpen, setBpOpen] = useState(false);
  const now = useNow();

  if (!woman) {
    return (
      <Screen>
        <div className="top">
          <Circle icon="back" label={t('asha.backToday')} onClick={() => swap('/asha')} />
        </div>
        <div className="hero">
          <p className="body-lg">{t('asha.woman.missing')}</p>
        </div>
      </Screen>
    );
  }

  const s = dayState(store.entries, id, now);
  const lv = s.any ? s.level : null;
  const tel = telHref(woman.phone);
  const lines = checkLines({ woman, entries: store.entries, sets: store.sets, t, lang, now });

  function doCheck() {
    store.setActive(id);
    go('/check');
  }

  return (
    <Screen aura={{ tone: lv === null ? 'none' : LEVEL_N[lv], pos: 'topRight' }} className="a-woman">
      <div className="top">
        <Circle icon="back" label={t('asha.backToday')} onClick={() => swap('/asha')} />
        <Mono className="strong">{s.check ? t('asha.woman.checkedIn', { time: timeLabel(s.check.at, lang) }) : t('asha.woman.noCheck')}</Mono>
      </div>

      <div className="a-who">
        <span className="a-who-av" data-level={lv === null ? undefined : LEVEL_N[lv]} aria-hidden="true">
          {initials(woman.name)}
        </span>
        <span className="a-who-text">
          <h1 className="a-who-name">{woman.name}</h1>
          <span className="a-who-sub">{profileLine(woman, t)}</span>
          {lv !== null && (
            <span className="a-badge" data-level={LEVEL_N[lv]}>
              {t(`asha.badge.${lv}`)}
            </span>
          )}
        </span>
      </div>

      <div className="a-actions">
        {tel && (
          <Btn href={tel} className="a-act">
            <Icon name="phone" size={18} weight={2} />
            {t('asha.woman.call', { name: firstName(woman.name) })}
          </Btn>
        )}
        {s.open.length > 0 && (
          <Btn kind="white" className="a-act" onClick={() => store.markHandled(s.open.map((e) => e.id))}>
            {t('asha.woman.handle')}
          </Btn>
        )}
        {s.open.length === 0 && s.handled && (
          <span className="btn white a-act a-done" role="status">
            <Icon name="check" size={18} color="var(--green-deep)" />
            {t('asha.woman.handled')}
          </span>
        )}
      </div>
      <div className="a-actions">
        <Btn kind="ghost" className="a-act" onClick={doCheck}>
          {t('asha.woman.doCheck')}
        </Btn>
      </div>

      {lines.length > 0 && (
        <section className="a-see card">
          <h2 className="a-see-title">{t('asha.woman.seeTitle')}</h2>
          <ol className="a-see-list">
            {lines.map((line, i) => (
              <li key={line}>
                <span className="a-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
          <p className="a-see-note">{t('asha.woman.seeNote')}</p>
        </section>
      )}

      <Answers woman={woman} />

      <div className="a-stack">
        <BpCard woman={woman} onAdd={() => setBpOpen(true)} />
        <a className="link a-edit" href={href(`/asha/edit/${encodeURIComponent(id)}`)}>
          {t('asha.woman.edit')}
        </a>
      </div>
      <div className="a-bottom-gap" />

      {bpOpen && <BpSheet woman={woman} onClose={() => setBpOpen(false)} />}
    </Screen>
  );
}

const TONE = { none: 'plain', watch: 'watch', see_today: 'care', emergency: 'care' };

function Answers({ woman }) {
  const { t, lang } = useT();
  const { entries, sets } = useStore();
  const [range, setRange] = useState('d14');
  const days = RANGES.find((r) => r.id === range).days;
  const set = setFor(woman, sets);
  const ctx = ruleContext(woman);
  const cards = set.questions.map((q) => ({ q, h: questionHistory({ entries, woman, set, q, days, ctx }) })).filter((c) => c.h);
  const optWords = (q, oid) => {
    if (oid === UNSURE) return t('common.notSure');
    const o = q.options.find((x) => x.id === oid);
    return o ? optionText(set, q, o, t, lang) : '';
  };

  return (
    <>
      <div className="a-sec-head">
        <h2 className="a-sec-title">{t('asha.woman.answers')}</h2>
        <span className="a-range" role="group" aria-label={t('asha.woman.rangeLabel')}>
          {RANGES.map((r, i) => (
            <span key={r.id} className="a-range-item">
              {i > 0 && <span aria-hidden="true"> · </span>}
              <button type="button" className="mono" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
                {t(`asha.woman.range.${r.id}`)}
              </button>
            </span>
          ))}
        </span>
      </div>
      <div className="a-stack">
        {cards.length === 0 && <p className="a-note">{t('asha.woman.noAnswers')}</p>}
        {cards.map(({ q, h }) => (
          <section key={q.id} className="a-hist card">
            <h3 className="a-hist-q">{questionText(set, q, t, lang)}</h3>
            <div className="a-tiles" style={{ gridTemplateColumns: h.tiles.map((_, i) => (i === 0 ? 'minmax(0,1.5fr)' : 'minmax(0,1fr)')).join(' ') }}>
              {h.tiles.map((tile) => (
                <span key={tile.at} className={`a-tile ${TONE[tile.level]}`}>
                  <Mono>{tile.today ? t('asha.woman.todayTile') : weekdayLabel(tile.at, lang)}</Mono>
                  <span className="a-tile-v">{optWords(q, tile.option)}</span>
                </span>
              ))}
            </div>
            <span className="a-bar" aria-hidden="true">
              {h.parts.map((p) => (
                <span key={p.option} data-lv={p.level} style={{ flex: p.n }} />
              ))}
            </span>
            <p className="a-counts">
              {h.parts.map((p, i) => (
                <span key={p.option}>
                  {i > 0 && ' · '}
                  {p.level === 'none' ? t('asha.woman.count', { answer: optWords(q, p.option), n: p.n }) : <b>{t('asha.woman.count', { answer: optWords(q, p.option), n: p.n })}</b>}
                </span>
              ))}
            </p>
          </section>
        ))}
      </div>
    </>
  );
}

function BpCard({ woman, onAdd }) {
  const { t, lang } = useT();
  const { entries } = useStore();
  const now = useNow();
  const rows = bpHistory(entries, woman.id, 4);
  const todayKey = dayKey(now);
  return (
    <section className="a-hist card">
      <div className="a-hist-head">
        <h3 className="a-hist-q">{t('asha.woman.bpTitle')}</h3>
        <button type="button" className="a-mini" onClick={onAdd}>
          <Icon name="plus" size={16} />
          {t('asha.woman.addBp')}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="a-counts">{t('asha.woman.bpNone')}</p>
      ) : (
        <div className="a-tiles mono-v" style={{ gridTemplateColumns: rows.map((_, i) => (i === 0 ? 'minmax(0,1.5fr)' : 'minmax(0,1fr)')).join(' ') }}>
          {rows.map((r) => (
            <span key={r.at} className={`a-tile ${TONE[r.level] || 'plain'}`}>
              <Mono>{dayKey(r.at) === todayKey ? t('asha.woman.todayTile') : weekdayLabel(r.at, lang)}</Mono>
              <span className="a-tile-v">
                {r.sys}/{r.dia}
              </span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function BpSheet({ woman, onClose }) {
  const { t } = useT();
  const { addEntry } = useStore();
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [tried, setTried] = useState(false);
  const a = Number(sys);
  const b = Number(dia);
  const ok = Number.isInteger(a) && Number.isInteger(b) && a >= 60 && a <= 260 && b >= 30 && b <= 160;

  function save() {
    setTried(true);
    if (!ok) return;
    const r = assess({
      set: null,
      measurements: [
        { key: 'systolic_bp', value: a, source: 'asha' },
        { key: 'diastolic_bp', value: b, source: 'asha' },
      ],
      ...ruleContext(woman),
    });
    addEntry({ womanId: woman.id, kind: 'bp', bp: { sys: a, dia: b }, level: r.level, items: r.items, rule: r.rule, by: 'asha' });
    onClose();
  }

  return (
    <Sheet title={t('asha.woman.bpSheet')} onClose={onClose} closeLabel={t('asha.close')}>
      <form
        className="a-bp-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="a-bp-pair">
          <Field label={t('asha.woman.sys')} value={sys} onChange={(e) => setSys(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={3} placeholder={t('asha.woman.sysPh')} />
          <Field label={t('asha.woman.dia')} value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={3} placeholder={t('asha.woman.diaPh')} />
        </div>
        {tried && !ok && <span className="field-error">{t('asha.woman.bpBad')}</span>}
        <Btn type="submit">{t('asha.woman.bpSave')}</Btn>
      </form>
    </Sheet>
  );
}
