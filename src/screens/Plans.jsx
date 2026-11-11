import { useState } from 'react';
import { Screen, Header, Card, Checklist, Eyebrow, Button, TextLink } from '../components/ui.jsx';
import { useT } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { href } from '../router.js';

/** S12 · Birth and travel plan — built inside daily talks. */
export function BirthPlanScreen({ openMenu }) {
  const { t } = useT();
  const { persona: p } = useApp();
  const id = t(`p.${p.id}.plan`) === `p.${p.id}.plan` ? 'sunita' : p.id;
  const items = t(`p.${id}.plan`);
  const ready = items.filter((x) => x.startsWith('done|')).length;
  return (
    <Screen>
      <Header name={p.name} onSwitch={openMenu} onProfile={openMenu} />
      <div className="body">
        <Eyebrow>{t('s12.eyebrow', { n: ready, total: items.length })}</Eyebrow>
        <h1 className="h1">{t('s12.title')}</h1>
        <Card>
          <Checklist items={items} />
        </Card>
        <Card tone="plain">
          <p>{t(`p.${id}.planNote`)}</p>
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

/** S13 · Share with doctor — a 2-minute read. */
export function ShareDoctorScreen({ openMenu }) {
  const { t } = useT();
  const { persona: p } = useApp();
  const [qr, setQr] = useState(false);
  const bp = p.bp || [];
  const last = bp[bp.length - 1];
  const summary = [t('s13.heading', { name: p.name, weeks: p.weeks }), ...t(`p.${p.id}.share`).map((x) => `• ${x.replace(/^\w+\|/, '')}`)].join('\n');
  return (
    <Screen>
      <Header name={p.name} onSwitch={openMenu} onProfile={openMenu} />
      <div className="body">
        <Eyebrow>{t('s13.eyebrow')}</Eyebrow>
        <h1 className="h1">{p.stage === 'postnatal' ? t('s13.headingPostnatal', { name: p.name, days: p.daysAfterBirth }) : t('s13.heading', { name: p.name, weeks: p.weeks })}</h1>
        <Card>
          {bp.length > 1 && (
            <>
              <p className="small">{t('s13.bp', { n: bp.length })}</p>
              <Sparkline readings={bp} />
              <p className="small" style={{ textAlign: 'right' }}>
                {t('s13.today', { bp: `${last.sys}/${last.dia}` })}
              </p>
            </>
          )}
          <Checklist items={t(`p.${p.id}.share`)} />
        </Card>
        {qr && <FakeQr />}
      </div>
      <div className="foot">
        <Button href={`https://wa.me/?text=${encodeURIComponent(summary)}`} target="_blank" rel="noopener">
          {t('s13.cta')}
        </Button>
        <TextLink onClick={() => setQr((v) => !v)}>{t('s13.qr')}</TextLink>
      </div>
    </Screen>
  );
}
