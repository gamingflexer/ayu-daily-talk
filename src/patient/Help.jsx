import { useEffect, useRef } from 'react';
import { Screen, Circle, Mono } from '../ui/kit.jsx';
import { Icon } from '../ui/icons.jsx';
import { useT } from '../i18n/index.jsx';
import { useStore } from '../store.jsx';
import { go, back, href } from '../router.js';
import { stageLine, telHref, smsHref } from '../ui/words.js';

/** 6 · Help now — no questions. 108 in the middle, her ASHA one tap below. */
export function HelpScreen() {
  const { t } = useT();
  const { woman, ctx, addEntry, entries } = useStore();
  const saved = useRef(false);
  // Record the press once (not again within 10 minutes), so whoever opens the
  // ASHA app on this phone sees it at the top of Today.
  useEffect(() => {
    if (saved.current || !woman) return;
    saved.current = true;
    const recent = entries.some((e) => e.womanId === woman.id && e.kind === 'help' && Date.now() - e.at < 10 * 60_000);
    if (!recent) addEntry({ womanId: woman.id, kind: 'help', level: 'emergency', items: [], rule: 'help:pressed' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const asha = woman?.ashaName || t('common.yourAsha');
  const tel = telHref(woman?.ashaPhone);
  const where = woman ? [stageLine(woman, ctx, t), woman.village].filter(Boolean).join(', ') : '';
  const sms = smsHref(woman?.ashaPhone, t('sms.help', { name: woman?.name || '', stage: where, village: '' }));

  return (
    <Screen night aura={{ tone: 3, pos: 'low' }}>
      <div className="top">
        <Mono className="strong">{t('help.meta')}</Mono>
        <Circle icon="close" tone="glass" label={t('common.close')} onClick={() => back(woman ? '/home' : '/')} />
      </div>
      <div className="hero" style={{ paddingTop: 32 }}>
        <h1 className="h-xl">{t('help.title')}</h1>
      </div>

      <div className="call108-wrap">
        <a className="call108" href="tel:108" aria-label={t('result.call108')}>
          <span className="call108-num">108</span>
          <span className="call108-label">{t('result.callAmbulance')}</span>
          <Mono>{t('result.freeAllDay')}</Mono>
        </a>
      </div>

      <div className="dock last" style={{ gap: 10 }}>
        {tel ? (
          <>
            <a className="card dusk row" href={tel}>
              <span className="row-text">
                <span className="row-value">{t('help.callAsha', { asha })}</span>
                <span className="row-label">{t('help.ashaRole')}</span>
              </span>
              <span className="circle paper" style={{ width: 52, height: 52 }}>
                <Icon name="phone" weight={2} />
              </span>
            </a>
            <a className="card dusk row" href={sms}>
              <span className="row-text">
                <span className="row-value">{t('help.smsAsha', { asha })}</span>
                <span className="row-label">{t('help.smsNote')}</span>
              </span>
              <span className="circle paper" style={{ width: 52, height: 52 }}>
                <Icon name="sms" weight={2} />
              </span>
            </a>
          </>
        ) : (
          woman && (
            <a className="card dusk row" href={href('/me')} onClick={(e) => { e.preventDefault(); go('/me'); }}>
              <span className="row-text">
                <span className="row-value">{t('help.addAsha')}</span>
                <span className="row-label">{t('help.addAshaNote')}</span>
              </span>
            </a>
          )
        )}
      </div>
    </Screen>
  );
}
