// Weak-network detection for the talk (S7 → S8 phone call).
//
// Signals, any one is enough:
//  - the browser says the link is 2G / slow-2G, or RTT > 1.5 s, or downlink < 0.15 Mbps
//    (navigator.connection — Chrome/Android only)
//  - the browser goes offline
//  - two health pings in a row take > 2.5 s or fail (only when a server exists)
//  - the Live socket drops before the talk is finished (reported by the engine)
//
// Demo: add `&net=weak` to the talk URL, or call window.__ayuNet('weak').

import { liveServerUrl } from './server.js';

const SLOW_TYPES = ['slow-2g', '2g'];

export function connectionLooksWeak(c = typeof navigator !== 'undefined' ? navigator.connection : null) {
  if (!c) return null;
  if (SLOW_TYPES.includes(c.effectiveType)) return '2g';
  if (typeof c.rtt === 'number' && c.rtt > 1500) return 'rtt';
  if (typeof c.downlink === 'number' && c.downlink > 0 && c.downlink < 0.15) return 'downlink';
  return null;
}

/**
 * @param {{onWeak: (reason: string) => void, probe?: boolean, intervalMs?: number}} opts
 * @returns {() => void} stop
 */
export function watchNetwork({ onWeak, probe = false, intervalMs = 15000 }) {
  let stopped = false;
  let fired = false;
  const fire = (reason) => {
    if (stopped || fired) return;
    fired = true;
    onWeak(reason);
  };

  const c = typeof navigator !== 'undefined' ? navigator.connection : null;
  const onChange = () => {
    const why = connectionLooksWeak(c);
    if (why) fire(`connection:${why}`);
  };
  onChange();
  c?.addEventListener?.('change', onChange);
  const onOffline = () => fire('offline');
  window.addEventListener('offline', onOffline);
  window.__ayuNet = (v) => v === 'weak' && fire('demo');

  let slow = 0;
  let timer = null;
  if (probe) {
    timer = setInterval(async () => {
      const ctrl = new AbortController();
      const t0 = performance.now();
      const kill = setTimeout(() => ctrl.abort(), 4000);
      try {
        const res = await fetch(`${liveServerUrl()}/api/health`, { signal: ctrl.signal, cache: 'no-store' });
        slow = res.ok && performance.now() - t0 < 2500 ? 0 : slow + 1;
      } catch {
        slow += 1;
      } finally {
        clearTimeout(kill);
      }
      if (slow >= 2) fire('rtt-probe');
    }, intervalMs);
  }

  return () => {
    stopped = true;
    c?.removeEventListener?.('change', onChange);
    window.removeEventListener('offline', onOffline);
    if (window.__ayuNet) delete window.__ayuNet;
    clearInterval(timer);
  };
}
