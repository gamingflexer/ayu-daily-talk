// Small hooks for the ASHA screens.
import { useEffect, useState } from 'react';

/** The time now, refreshed every minute (for "2 min ago" and today's lists). */
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** Re-render when the phone's voices finish loading (hasVoice is false until then). */
export function useVoices() {
  const [, setN] = useState(0);
  useEffect(() => {
    const s = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!s?.addEventListener) return undefined;
    const on = () => setN((n) => n + 1);
    s.addEventListener('voiceschanged', on);
    return () => s.removeEventListener('voiceschanged', on);
  }, []);
}
