// ASHA · Help alert (AshaAlert board): a woman pressed Help now on this phone.
import { useEffect } from 'react';
import { useT } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { go, swap } from '../router.js';
import { Screen, Circle, Mono } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { telHref, timeLabel, weekdayLabel, dayLabel } from '../ui/words.js';
import { DAY, dayKey, initials, bpHistory } from '../../shared/journal.js';
import { firstName, profileLine, entryReason } from './look.js';
import { useNow } from './hooks.js';

function dayWord(at, t, lang, now) {
  if (dayKey(at) === dayKey(now)) return t('asha.alert.todayWord');
  return now - at < 6 * DAY ? weekdayLabel(at, lang) : dayLabel(at, lang);
}

/** Bullets from what is saved on this phone; each one is left out when there is no data. */
function knows({ woman, entry, entries, sets, t, lang, now }) {
  const out = [];
  const checks = entries.filter((e) => e.womanId === woman.id && e.kind === 'check').sort((a, b) => b.at - a.at);
  const last = checks[0];
  if (!last) out.push(t('asha.alert.noAnswersYet'));
  else {
    const days = Math.round((new Date(dayKey(now)) - new Date(dayKey(last.at))) / DAY);
    if (days >= 2) out.push(t('asha.alert.silent', { n: days }));
    const reasons = (last.items || []).map((it) => entryReason({ ...last, items: [it] }, sets, t, lang)).filter(Boolean);
    const what = reasons.length ? [...new Set(reasons)].slice(0, 3).join(', ') : t('asha.alert.allFine');
    out.push(t('asha.alert.lastCheck', { day: dayWord(last.at, t, lang, now), what }));
  }
  const bp = bpHistory(entries, woman.id, 1)[0];
  if (bp) out.push(t('asha.alert.lastBp', { day: dayWord(bp.at, t, lang, now), bp: `${bp.sys}/${bp.dia}` }));
  for (const s of entry.signs || []) out.push(t(`signs.${s}`));
  if (woman.centre) out.push(t('asha.alert.centre', { centre: woman.centre }));
  return out;
}

export function AshaAlert({ entryId }) {
  const { t, lang } = useT();
  const store = useStore();
  const now = useNow();
  const entry = store.entries.find((e) => e.id === entryId && e.kind === 'help');
  const woman = entry ? store.women[entry.womanId] : null;

  useEffect(() => {
    if (!entry || !woman) swap('/asha');
  }, [entry, woman]);
  if (!entry || !woman) return null;

  const first = firstName(woman.name);
  const tel = telHref(woman.phone);
  const bullets = knows({ woman, entry, entries: store.entries, sets: store.sets, t, lang, now });

  function onWay() {
    store.markHandled(entry.id);
    go('/asha');
  }

  return (
    <Screen night aura={{ tone: 3, pos: 'low' }} className="a-alert">
      <div className="top">
        <Mono className="strong a-alert-meta">
          <span className="a-alert-dot" aria-hidden="true" />
          {t('asha.alert.meta', { time: timeLabel(entry.at, lang) })}
        </Mono>
        <Circle icon="close" tone="glass" label={t('asha.close')} onClick={() => go('/asha')} />
      </div>

      <div className="a-alert-hero">
        <span className="a-alert-av" aria-hidden="true">
          {initials(woman.name)}
        </span>
        <h1 className="a-alert-title">{t('asha.alert.title', { name: first })}</h1>
        <p className="a-alert-sub">{[woman.name, profileLine(woman, t)].filter(Boolean).join(' · ')}</p>
      </div>

      {bullets.length > 0 && (
        <section className="a-knows">
          <h2 className="a-knows-title">{t('asha.alert.knows')}</h2>
          <ul>
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="grow" />
      <div className="a-alert-dock">
        {tel && (
          <a className="a-alert-btn call" href={tel}>
            <Icon name="phone" size={22} weight={2} />
            {t('asha.alert.call', { name: first })}
          </a>
        )}
        <a className="a-alert-btn red" href="tel:108">
          {t('asha.alert.call108')}
        </a>
        {entry.handledAt ? (
          <span className="a-alert-btn line" role="status">
            {t('asha.alert.onWayDone', { time: timeLabel(entry.handledAt, lang) })}
          </span>
        ) : (
          <button type="button" className="a-alert-btn line" onClick={onWay}>
            {t('asha.alert.onWay')}
          </button>
        )}
      </div>
    </Screen>
  );
}
