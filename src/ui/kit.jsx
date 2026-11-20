// Shared pieces of Vrindar's v0 language: the calm sand surface, the one living
// light (Aura), white pill cards, circle actions. Classes live in src/styles.css.
import { Icon } from './icons.jsx';

export const LEVEL_N = { none: 0, watch: 1, see_today: 2, emergency: 3 };

/**
 * The screen. `night` is the dark room used only for "call 108".
 * `aura` = { tone: 'home'|'listen'|'none'|0|1|2|3, pos: 'top'|'topLeft'|'mid'|'low' }.
 */
export function Screen({ night = false, aura = null, className = '', children }) {
  return (
    <div className={`screen ${night ? 'night' : ''} ${className}`}>
      {aura && <div className="aura" data-tone={String(aura.tone)} data-pos={aura.pos || 'top'} aria-hidden="true" />}
      {children}
    </div>
  );
}

/** Round icon button or link. tone: white | soft | coral | line | dark | glass | paper */
export function Circle({ icon, label, tone = 'white', size = 48, href, iconSize, iconColor, weight, ...rest }) {
  const cls = `circle ${tone}`;
  const style = { width: size, height: size };
  const inner = <Icon name={icon} size={iconSize || (size >= 52 ? 22 : 20)} color={iconColor} weight={weight} />;
  if (href)
    return (
      <a className={cls} style={style} href={href} aria-label={label} {...rest}>
        {inner}
      </a>
    );
  return (
    <button type="button" className={cls} style={style} aria-label={label} {...rest}>
      {inner}
    </button>
  );
}

/** Small uppercase label (Geist Mono in Latin; plain in Indic scripts). */
export function Mono({ children, className = '', ...rest }) {
  return (
    <span className={`mono ${className}`} {...rest}>
      {children}
    </span>
  );
}

/** Full-width pill button. kind: dark | ghost | white | coral | red */
export function Btn({ kind = 'dark', href, children, className = '', ...rest }) {
  const cls = `btn ${kind} ${className}`;
  if (href)
    return (
      <a className={cls} href={href} {...rest}>
        {children}
      </a>
    );
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

/** White card that holds rows split by hairlines. */
export function Rows({ children, className = '' }) {
  const items = [].concat(children).flat().filter(Boolean);
  return (
    <div className={`card rows ${className}`}>
      {items.map((c, i) => (
        <div key={c.key ?? i} className="rows-item">
          {i > 0 && <div className="sep" />}
          {c}
        </div>
      ))}
    </div>
  );
}

/** One row: small label over a strong value, action on the right. */
export function Row({ label, value, note, action, onClick, href }) {
  const body = (
    <>
      <span className="row-text">
        {label && <span className="row-label">{label}</span>}
        <span className="row-value">{value}</span>
        {note && <span className="row-note">{note}</span>}
      </span>
      {action}
    </>
  );
  if (onClick)
    return (
      <button type="button" className="row" onClick={onClick}>
        {body}
      </button>
    );
  if (href)
    return (
      <a className="row" href={href}>
        {body}
      </a>
    );
  return <div className="row">{body}</div>;
}

/** Two-letter avatar circle. */
export function Avatar({ text, tone = 'white', size = 48 }) {
  return (
    <span className={`avatar ${tone}`} style={{ width: size, height: size }} aria-hidden="true">
      {text}
    </span>
  );
}

/** Reason chip with a level dot. */
export function ReasonChip({ level, children }) {
  return (
    <span className="reason">
      <span className="dot" data-level={LEVEL_N[level] ?? 0} />
      {children}
    </span>
  );
}

/** Bottom sheet over the screen (language picker, confirmations). */
export function Sheet({ title, onClose, closeLabel, children }) {
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <Circle icon="close" tone="line" size={44} label={closeLabel} onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Labelled text input. */
export function Field({ label, hint, ...rest }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input {...rest} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
