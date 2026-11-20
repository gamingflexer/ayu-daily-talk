// ASHA · Women [Inferred sibling of Today]: everyone on this phone, and "Add a woman".
import { useT } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { href } from '../router.js';
import { Screen } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { initials } from '../../shared/journal.js';
import { TabBar, WomanCard } from './parts.jsx';
import { stageOf } from './look.js';

export function AshaWomen() {
  const { t } = useT();
  const { womenList } = useStore();
  const sorted = [...womenList].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Screen className="a-frame">
      <div className="a-page-head">
        <h1 className="a-h1 sm">{t('asha.women.title')}</h1>
        <p className="a-lead">{t('asha.women.lead')}</p>
      </div>
      <div className="a-list scroll">
        <a className="a-make" href={href('/asha/add')}>
          <span className="a-make-plus" aria-hidden="true">
            <Icon name="plus" size={24} />
          </span>
          <span className="a-make-text">
            <span className="a-make-title">{t('asha.women.add')}</span>
            <span className="a-make-sub">{t('asha.women.addSub')}</span>
          </span>
        </a>
        {sorted.length === 0 && <p className="a-note">{t('asha.women.empty')}</p>}
        {sorted.map((w) => (
          <WomanCard
            key={w.id}
            to={href(`/asha/w/${encodeURIComponent(w.id)}`)}
            initials={initials(w.name)}
            name={w.name}
            sub={[stageOf(w, t), w.village].filter(Boolean).join(' · ')}
          />
        ))}
      </div>
      <TabBar active="women" />
    </Screen>
  );
}
