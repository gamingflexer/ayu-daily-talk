import { useEffect, useState } from 'react';
import { Screen, Header, Card, Checklist, Eyebrow, Button, TextLink } from '../components/ui.jsx';
import { useT } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { href } from '../router.js';
import { PLAN_ITEMS } from '../../shared/talk-state.js';
import { buildDoctorSummary } from '../../shared/doctor-summary.js';
import { Spinner } from '../components/call.jsx';
import { checkLive, liveServerUrl } from '../live/server.js';

/**
 * The plan on screen: her saved plan (mock record, one line per PLAN_ITEMS key)
 * with every item Ayu saved in a talk (update_plan) laid over it.
 */
function mergePlan(baseItems, updates = {}, t) {
  const base = Array.isArray(baseItems) ? baseItems : [];
  const keys = base.length ? PLAN_ITEMS.slice(0, base.length) : [];
  const rows = keys.map((k, i) => ({ key: k, item: base[i] }));
  for (const k of PLAN_ITEMS) if (updates[k] && !keys.includes(k)) rows.push({ key: k, item: null });
  return rows.map(({ key, item }) => {
    const u = updates[key];
    if (!u) return item;
    return {
      mark: u.ready ? 'done' : 'todo',
      text: (
        <>
          {t(`s12.items.${key}`)}: {u.value} <span className="updated">· {t('s12.updated')}</span>
        </>
      ),
    };
  });
}

/** S12 · Birth and travel plan — built inside daily talks. */
export function BirthPlanScreen({ openMenu }) {
  const { t } = useT();
  const { persona: p, plans } = useApp();
  const base = t(`p.${p.id}.plan`);
  const items = mergePlan(Array.isArray(base) ? base : [], plans?.[p.id], t);
  const ready = items.filter((x) => (typeof x === 'string' ? x.startsWith('done|') : x.mark === 'done')).length;
  const hasNote = t(`p.${p.id}.planNote`) !== `p.${p.id}.planNote`;
  return (
    <Screen>
      <Header name={p.name} onSwitch={openMenu} onProfile={openMenu} />
      <div className="body">
        <Eyebrow>{t('s12.eyebrow', { n: ready, total: Math.max(items.length, PLAN_ITEMS.length) })}</Eyebrow>
        <h1 className="h1">{t('s12.title')}</h1>
        <Card>{items.length ? <Checklist items={items} /> : <p>{t('s12.empty')}</p>}</Card>
        <Card tone="plain">
          <p>{hasNote ? t(`p.${p.id}.planNote`) : t('s12.emptyNote')}</p>
        </Card>
      </div>
      <div className="foot">
        <Button href={href('/talk')}>{t('s12.cta')}</Button>
      </div>
    </Screen>
  );
}

function Sparkline({ readings }) {
  const w = 300;
  const h = 70;
  const min = Math.min(...readings.map((r) => r.sys)) - 6;
  const max = Math.max(...readings.map((r) => r.sys)) + 6;
  const pts = readings.map((r, i) => [10 + (i * (w - 20)) / (readings.length - 1), h - 10 - ((r.sys - min) / (max - min)) * (h - 20)]);
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={readings.map((r) => `${r.sys}/${r.dia}`).join(', ')}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#F15C3E" strokeWidth="2.5" strokeLinejoin="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#F15C3E" />
      ))}
    </svg>
  );
}

/** A small, fake QR pattern (decorative; the demo has nothing to link to). */
function FakeQr() {
  const cells = [];
  let seed = 7;
  for (let y = 0; y < 21; y++)
    for (let x = 0; x < 21; x++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      const on = finder ? x % 6 === 0 || y % 6 === 0 || (x % 7 > 1 && x % 7 < 5 && y % 7 > 1 && y % 7 < 5) || x === 14 || x === 20 || y === 14 || y === 20 : seed % 3 === 0;
      if (on) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  return (
    <svg className="qr" viewBox="0 0 21 21" shapeRendering="crispEdges" role="img" aria-label="QR (demo)">
      <g fill="#332F3C">{cells}</g>
    </svg>
  );
}

/** S13 · Share with doctor — a 2-minute read, built from today's talk (shared/doctor-summary.js). */
export function ShareDoctorScreen({ openMenu }) {
  const { t } = useT();
  const { persona: p, lastTalk, update } = useApp();
  const [qr, setQr] = useState(false);
  const talk = lastTalk && lastTalk.persona === p.id ? lastTalk : null;
  const summary = buildDoctorSummary({ persona: p, talk });
  const [note, setNote] = useState(talk?.doctorNote || null);
  const [loadingNote, setLoadingNote] = useState(false);
  const bp = p.bp || [];
  const last = bp[bp.length - 1];

  // Optional short note written by the model from the same facts (one request per talk, cached).
  useEffect(() => {
    if (!talk || talk.doctorNote !== undefined) return;
    let alive = true;
    (async () => {
      const live = await checkLive();
      if (!alive || !live.live) return;
      setLoadingNote(true);
      try {
        const res = await fetch(`${liveServerUrl()}/api/summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona: p.id, talk }),
        });
        const body = res.ok ? await res.json() : {};
        if (!alive) return;
        setNote(body.note || null);
        update((prev) => (prev.lastTalk?.at === talk.at ? { lastTalk: { ...prev.lastTalk, doctorNote: body.note || null } } : {}));
      } catch {
        // offline — the deterministic summary is enough
      } finally {
        if (alive) setLoadingNote(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talk?.at]);

  const shareText = note ? `${summary.text}\n\nNote: ${note}` : summary.text;
  return (
    <Screen>
      <Header name={p.name} onSwitch={openMenu} onProfile={openMenu} />
      <div className="body">
        <Eyebrow>{t('s13.eyebrow')}</Eyebrow>
        <h1 className="h1">{p.stage === 'postnatal' ? t('s13.headingPostnatal', { name: p.name, days: p.daysAfterBirth }) : t('s13.heading', { name: p.name, weeks: p.weeks })}</h1>
        <Card tone="summary">
          {bp.length > 1 && (
            <>
              <p className="small">{t('s13.bp', { n: bp.length })}</p>
              <Sparkline readings={bp} />
              <p className="small" style={{ textAlign: 'right' }}>
                {t('s13.today', { bp: `${last.sys}/${last.dia}` })}
              </p>
            </>
          )}
          {!talk && <p className="small">{t('s13.noTalk')}</p>}
          {summary.sections.map((sec) => (
            <div key={sec.id} lang="en">
              <h3 className="sum-h">{sec.title}</h3>
              <Checklist items={sec.lines} />
            </div>
          ))}
        </Card>
        {(note || loadingNote) && (
          <Card tone="plain">
            <h3>{t('s13.note')}</h3>
            {note ? (
              <p lang="en">{note}</p>
            ) : (
              <div role="status">
                <p className="busy-line">
                  <Spinner /> {t('s13.noteLoading')}
                </p>
                <div className="skeleton" aria-hidden="true">
                  <i />
                  <i />
                  <i style={{ width: '60%' }} />
                </div>
              </div>
            )}
            {note && <p className="small">{t('s13.noteBy')}</p>}
          </Card>
        )}
        <p className="small">{t('s13.builtFrom')}</p>
        {qr && <FakeQr />}
      </div>
      <div className="foot">
        <Button href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener">
          {t('s13.cta')}
        </Button>
        <TextLink onClick={() => setQr((v) => !v)}>{t('s13.qr')}</TextLink>
      </div>
    </Screen>
  );
}
