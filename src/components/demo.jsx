import { useT } from '../i18n/index.jsx';
import { useApp } from '../state.jsx';
import { go } from '../router.js';
import { beginTalkMedia } from '../live/media.js';

/** The two demo cases (mock personas). Pregnant week 34 is the default; one tap starts that talk. */
export const DEMOS = [
  { id: 'reena', label: 'app.demoPregnant' },
  { id: 'shanti', label: 'app.demoGrandma' },
];

export function DemoBar() {
  const { t } = useT();
  const { personaId, update } = useApp();
  const start = (id) => {
    update({ personaId: id, lastTalk: null });
    // Mic + camera are asked for inside this tap (iOS), then the talk opens.
    beginTalkMedia();
    go('/talk');
  };
  return (
    <div className="demo-bar" role="group" aria-label={t('app.demoTry')}>
      <span>{t('app.demoTry')}</span>
      {DEMOS.map((d) => (
        <button key={d.id} className={`chip ${personaId === d.id ? 'on' : ''}`} aria-pressed={personaId === d.id} onClick={() => start(d.id)}>
          {t(d.label)}
        </button>
      ))}
    </div>
  );
}
