// Ask the server to draft a question set (POST /api/draft-questions).
// Sent the same way as the live token: same server, JSON, the page pass from /api/health.
import { liveServerUrl, pagePass } from '../live/server.js';

/**
 * @param {{stage: 'pregnant'|'postnatal', about: string, langs: string[]}} req
 * @returns {Promise<object>} the raw draft (run it through sanitizeDraft before saving)
 * @throws {Error} on any failure (no server, no key, offline, rate limit, model error)
 */
export async function draftQuestions({ stage, about, langs }, { timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${liveServerUrl()}/api/draft-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Talk-Pass': await pagePass() },
      body: JSON.stringify({ stage, about, langs }),
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.draft) throw new Error(body?.error || `server ${res.status}`);
    return body.draft;
  } finally {
    clearTimeout(timer);
  }
}
