// Where the token server lives. Empty = same origin (local dev uses the Vite proxy).
export function liveServerUrl() {
  return (import.meta.env.VITE_LIVE_SERVER_URL || '').replace(/\/$/, '');
}

// The server's short-lived page pass (from /api/health), sent back when asking for a live token.
let lastPass = null;
const PASS_REFRESH_MS = 8 * 60_000; // the server accepts a pass for 10 minutes

/** A fresh page pass, asking /api/health again when the last one is old. */
export async function pagePass() {
  if (!lastPass || Date.now() - lastPass.at > PASS_REFRESH_MS) await checkLive();
  return lastPass?.value || '';
}

/**
 * Ask the server whether live listening (Gemini) is on.
 * @returns {Promise<{live: boolean, model?: string, reason: ''|'no-key'|'server'|'offline'}>}
 */
export async function checkLive({ timeoutMs = 4000 } = {}) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { live: false, reason: 'offline' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${liveServerUrl()}/api/health`, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return { live: false, reason: 'server' };
    const body = await res.json();
    if (body.pass) lastPass = { value: body.pass, at: Date.now() };
    return { live: Boolean(body.live), model: body.model, reason: body.live ? '' : 'no-key' };
  } catch {
    return { live: false, reason: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'server' };
  } finally {
    clearTimeout(timer);
  }
}
