// Pieces shared by the ASHA screens.
import { useT } from '../i18n/index.jsx';
import { href } from '../router.js';
import { Icon } from '../ui/icons.jsx';
import { LEVEL_N } from '../ui/kit.jsx';
import { FLOORS } from '../../shared/question-sets.js';
import { levelIndex } from '../../shared/red-flags.js';

const TABS = [
  { id: 'today', path: '/asha', icon: 'home' },
  { id: 'women', path: '/asha/women', icon: 'people' },
  { id: 'questions', path: '/asha/questions', icon: 'sheet' },
];

/** Bottom tab bar (AshaToday board). */
export function TabBar({ active }) {
  const { t } = useT();
  return (
    <nav className="a-tabs" aria-label={t('asha.tabs.label')}>
      <div className="a-tabs-pill">
        {TABS.map((tab) => (
          <a key={tab.id} href={href(tab.path)} className="a-tab" aria-current={active === tab.id ? 'page' : undefined}>
            <Icon name={tab.icon} size={22} weight={active === tab.id ? 2.2 : 2} />
            <span>{t(`asha.tabs.${tab.id}`)}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

/** A woman as a pill card: avatar, name, one line, chevron. tone: alert | watch | care | fine | plain */
export function WomanCard({ to, tone = 'plain', initials, name, sub, level, trailing }) {
  return (
    <a className={`a-card ${tone}`} href={to}>
      <span className="a-av" aria-hidden="true">
        {initials}
      </span>
      <span className="a-card-text">
        <span className="a-card-name">{name}</span>
        {sub && <span className="a-card-sub">{sub}</span>}
      </span>
      {level !== undefined && <span className="dot" data-level={LEVEL_N[level] ?? 0} aria-hidden="true" />}
      {trailing || <Icon name="chevron" size={20} />}
    </a>
  );
}

/**
 * Fine · ASHA · Doctor · 108. `min` disables the lower choices (the fixed rules' floor).
 * Read-only when onPick is missing.
 */
export function LevelPicker({ value, min = 'none', onPick, label }) {
  const { t } = useT();
  const lo = levelIndex(min);
  return (
    <span className="a-levels" role={onPick ? 'radiogroup' : undefined} aria-label={label}>
      {FLOORS.map((lv, i) => {
        const on = lv === value;
        const locked = i < lo;
        if (!onPick)
          return (
            <span key={lv} className="a-level" data-lv={lv} data-on={on || undefined}>
              {t(`asha.level.${lv}`)}
            </span>
          );
        return (
          <button
            key={lv}
            type="button"
            role="radio"
            aria-checked={on}
            aria-disabled={locked || undefined}
            className="a-level"
            data-lv={lv}
            data-on={on || undefined}
            data-locked={locked || undefined}
            onClick={() => !locked && !on && onPick(lv)}
          >
            {t(`asha.level.${lv}`)}
          </button>
        );
      })}
    </span>
  );
}
