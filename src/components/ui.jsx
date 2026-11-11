import logoUrl from '../assets/figma/logo-ayu-tm.svg';
import chevronUrl from '../assets/figma/icon-chevron.svg';
import profileUrl from '../assets/figma/icon-profile.svg';
import { useT } from '../i18n/index.jsx';

/** Heart + "Ayu" + ™ — the only brand mark. */
export function Logo({ width = 82.8 }) {
  return <img className="logo" src={logoUrl} width={width} height={(width * 28.75) / 82.8} alt="Ayu™" />;
}

export function Screen({ dark = false, children, className = '' }) {
  return <main className={`screen ${dark ? 'dark' : ''} ${className}`}>{children}</main>;
}

export function Header({ name, onSwitch, onProfile }) {
  const { t } = useT();
  return (
    <header className="header">
      <Logo />
      <div className="header-right">
        <button className="profile-pill" onClick={onSwitch} aria-label={t('header.switch', { name })}>
          {name}
          <span className="chev">
            <img src={chevronUrl} width="12" height="8" alt="" />
          </span>
        </button>
        <button className="icon-btn" onClick={onProfile} aria-label={t('header.profile')}>
          <img src={profileUrl} width="18" height="18" alt="" />
        </button>
      </div>
    </header>
  );
}

export function Button({ children, href, ...rest }) {
  if (href)
    return (
      <a className="btn" href={href} {...rest}>
        {children}
      </a>
    );
  return (
    <button className="btn" {...rest}>
      {children}
    </button>
  );
}

export function TextLink({ children, href, ...rest }) {
  if (href)
    return (
      <a className="link" href={href} {...rest}>
        {children}
      </a>
    );
  return (
    <button className="link" {...rest}>
      {children}
    </button>
  );
}

export function Chip({ on, children, href, ...rest }) {
  const cls = `chip ${on ? 'on' : ''}`;
  if (href)
    return (
      <a className={cls} href={href} {...rest}>
        {children}
      </a>
    );
  return (
    <button className={cls} aria-pressed={on} {...rest}>
      {children}
    </button>
  );
}

export function Card({ tone = '', children, ...rest }) {
  return (
    <section className={`card ${tone}`} {...rest}>
      {children}
    </section>
  );
}

const MARKS = { done: '✓', next: '●', todo: '○', warn: '!', dot: '•', skip: '—' };

/** items: [{mark: 'done'|'next'|'todo'|'warn'|'dot'|'skip', text}] or "mark|text" strings */
export function Checklist({ items }) {
  return (
    <ul className="checklist">
      {items.map((it, i) => {
        const { mark, text } = typeof it === 'string' ? splitItem(it) : it;
        return (
          <li key={i}>
            <span className={`mark ${mark}`} aria-hidden="true">
              {MARKS[mark] || '•'}
            </span>
            <span>{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

function splitItem(s) {
  const m = s.match(/^(done|next|todo|warn|dot|skip)\|(.*)$/);
  return m ? { mark: m[1], text: m[2] } : { mark: 'dot', text: s };
}

export function Eyebrow({ children, green }) {
  return <p className={`eyebrow ${green ? 'green' : ''}`}>{children}</p>;
}

export function Steps({ count, at }) {
  return (
    <div className="steps" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className={i === at ? 'on' : ''} />
      ))}
    </div>
  );
}

export function PhoneIcon({ size = 40, color = '#F15C3E' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"
        fill={color}
      />
    </svg>
  );
}

export function SpeakerIcon() {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" fill="none" aria-hidden="true">
      <path d="M2 7h4l5-4v14l-5-4H2z" fill="#fff" />
      <path d="M15 6.5a5 5 0 0 1 0 7M17.5 4a8.5 8.5 0 0 1 0 12" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg width="22" height="24" viewBox="0 0 22 24" fill="none" aria-hidden="true">
      <path d="M4 3l15 9-15 9z" fill="#F15C3E" />
    </svg>
  );
}

export function VideoOnIcon() {
  return (
    <svg width="24" height="20" viewBox="0 0 24 20" fill="none" aria-hidden="true">
      <rect x="1.5" y="4" width="14" height="12" rx="2.5" stroke="#332F3C" strokeWidth="1.8" />
      <path d="M15.5 8.5l6-3.5v10l-6-3.5" stroke="#332F3C" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
