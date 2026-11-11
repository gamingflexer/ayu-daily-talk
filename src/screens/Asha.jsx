import { Screen, Header, Card, Eyebrow, Button } from '../components/ui.jsx';
import { useT } from '../i18n/index.jsx';

// The one ASHA screen: what many women's talks add up to in her villages.
// Shows "check this", never a cause. Only counts by village leave a phone.
const TONES = ['red', 'yellow', 'muted'];

export function AshaScreen({ openMenu }) {
  const { t } = useT();
  const items = t('asha.items');
  return (
    <Screen>
      <Header name={t('asha.name')} onSwitch={openMenu} onProfile={openMenu} />
      <div className="body">
        <Eyebrow>{t('asha.eyebrow')}</Eyebrow>
        <h1 className="h1">{t('asha.title')}</h1>
        {items.map((it, i) => (
          <Card key={i} tone={TONES[i]}>
            <h3>{it.title}</h3>
            <p>{it.body}</p>
          </Card>
        ))}
        <p className="small">{t('asha.rule')}</p>
      </div>
      <div className="foot">
        <Button>{t('asha.cta')}</Button>
      </div>
    </Screen>
  );
}
