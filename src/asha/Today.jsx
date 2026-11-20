// ASHA · Today (AshaToday board): who needs her first, then who is fine, then who has not checked in.
import { useT } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { href, go } from '../router.js';
import { Screen, Circle, Btn } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { initials, silentDays } from '../../shared/journal.js';
import { levelIndex } from '../../shared/red-flags.js';
import { TabBar, WomanCard } from './parts.jsx';
import { dayState, todayReason, stageOf, agoText, toneOf } from './look.js';
import { useNow } from './hooks.js';

export function AshaHeader() {
  const { t } = useT();
  const { asha } = useStore();
  return (
    <header className="a-head">
      <span className="a-brand">
        <span className="a-brand-mark" aria-hidden="true">
          <Icon name="heart" size={22} color="var(--coral)" />
        </span>
        <span className="a-brand-name">{t('asha.brand')}</span>
      </span>
      <span className="a-me">
        {asha?.name && <span className="a-me-name">{asha.name}</span>}
        <Circle icon="person" size={44} label={t('asha.profile')} weight={2} onClick={() => go('/me')} />
      </span>
    </header>
  );
}

export function AshaToday() {
  const { t, lang } = useT();
  const { womenList, entries, sets } = useStore();
  const now = useNow();

  const rows = womenList
    .map((woman) => ({ woman, s: dayState(entries, woman.id, now) }))
    .sort(
      (a, b) =>
        Number(Boolean(b.s.help)) - Number(Boolean(a.s.help)) || levelIndex(b.s.level) - levelIndex(a.s.level) || a.woman.name.localeCompare(b.woman.name),
    );
  const alerts = rows.filter((r) => r.s.help);
  const attention = rows.filter((r) => !r.s.help && levelIndex(r.s.level) > 0);
  const fine = rows.filter((r) => !r.s.help && r.s.any && r.s.level === 'none');
  const quiet = rows.filter((r) => !r.s.any);

  const quietLine = (woman) => {
    const stage = stageOf(woman, t);
    const n = silentDays(entries, woman.id, now);
    if (n === null || n === 0) return stage;
    return n === 1 ? t('asha.today.lastYesterday', { stage }) : t('asha.today.lastDays', { stage, n });
  };

  return (
    <Screen className="a-frame">
      <AshaHeader />
      <div className="a-title">
        <h1 className="a-h1">{t('asha.today.title')}</h1>
      </div>

      {womenList.length === 0 ? (
        <div className="a-empty">
          <p className="a-empty-title">{t('asha.today.emptyTitle')}</p>
          <p className="a-empty-body">{t('asha.today.emptyBody')}</p>
          <Btn onClick={() => go('/asha/add')}>{t('asha.today.add')}</Btn>
        </div>
      ) : (
        <div className="a-list scroll">
          {alerts.map(({ woman, s }) => (
            <WomanCard
              key={woman.id}
              to={href(`/asha/alert/${encodeURIComponent(s.help.id)}`)}
              tone="alert"
              initials={initials(woman.name)}
              name={woman.name}
              sub={t('asha.today.pressedHelp', { ago: agoText(s.help.at, t, now) })}
              trailing={
                <span className="a-card-call" aria-hidden="true">
                  <Icon name="phone" size={20} />
                </span>
              }
            />
          ))}
          {attention.map(({ woman, s }) => {
            const reason = todayReason(s, sets, t, lang);
            return (
              <WomanCard
                key={woman.id}
                to={href(`/asha/w/${encodeURIComponent(woman.id)}`)}
                tone={toneOf(s.level, s.handled)}
                initials={initials(woman.name)}
                name={woman.name}
                sub={s.handled ? t('asha.today.handled', { reason }) : reason}
                level={s.level}
              />
            );
          })}

          {fine.length > 0 && <span className="a-label">{t('asha.today.allFine')}</span>}
          {fine.map(({ woman }) => (
            <WomanCard key={woman.id} to={href(`/asha/w/${encodeURIComponent(woman.id)}`)} tone="fine" initials={initials(woman.name)} name={woman.name} sub={stageOf(woman, t)} />
          ))}

          {quiet.length > 0 && <span className="a-label">{t('asha.today.noCheck')}</span>}
          {quiet.map(({ woman }) => (
            <WomanCard key={woman.id} to={href(`/asha/w/${encodeURIComponent(woman.id)}`)} tone="plain" initials={initials(woman.name)} name={woman.name} sub={quietLine(woman)} />
          ))}
        </div>
      )}
      <TabBar active="today" />
    </Screen>
  );
}
