import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Request guards shared by the Express server and the Vercel functions.
//
// LIMITATION: the rate limit and the daily cap live in memory, per process.
// On Vercel every function instance has its own counters (and a cold start
// resets them), so the real ceiling is (cap × warm instances). Good enough
// for a demo; put the counters in a shared store (e.g. Upstash Redis) before
// real traffic.

export function envList(name) {
  return (process.env[name] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function envInt(name, fallback) {
  const n = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Client IP: first x-forwarded-for hop (set by Vercel / proxies), else the socket. */
export function clientIp(headers = {}, socketIp = '') {
  const xff = String(headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || String(headers['x-real-ip'] || '') || socketIp || 'unknown';
}

/**
 * Origin check.
 * - Origin in ALLOWED_ORIGINS, or same host as the request → allowed, CORS header for it.
 * - No Origin header (curl, scripts) → allowed only where requireOrigin is false (GET /api/health).
 * - Any other Origin → refused.
 */
export function checkOrigin(headers = {}, { requireOrigin = false } = {}) {
  const origin = headers.origin;
  // Browsers always send Origin on a POST; only scripts and curl leave it out (16 Nov 2026:
  // a no-Origin POST minted a Gemini Live session). No app calls this API without one.
  if (!origin) return { ok: !requireOrigin, cors: null, noOrigin: true };
  let host = '';
  try {
    host = new URL(origin).host;
  } catch {
    return { ok: false, cors: null };
  }
  const reqHost = String(headers['x-forwarded-host'] || headers.host || '');
  if (host && host === reqHost) return { ok: true, cors: origin, sameOrigin: true };
  if (envList('ALLOWED_ORIGINS').includes(origin)) return { ok: true, cors: origin };
  return { ok: false, cors: null };
}

const windows = new Map(); // `${bucket}:${ip}` → timestamps

/** Sliding-window limit per IP and bucket. Returns true when the request may go on. */
export function rateLimit(bucket, ip, { limit, windowMs = 60_000, now = Date.now() } = {}) {
  const key = `${bucket}:${ip}`;
  const recent = (windows.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    windows.set(key, recent);
    return false;
  }
  recent.push(now);
  windows.set(key, recent);
  // Keep the map small on long-lived servers.
  if (windows.size > 5000) for (const [k, v] of windows) if (!v.some((t) => now - t < windowMs)) windows.delete(k);
  return true;
}

const daily = new Map(); // bucket → {day, n}

/** Per-day counter (UTC day). Returns true and counts when under the cap. */
export function takeDaily(bucket, cap, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const cur = daily.get(bucket);
  const n = cur && cur.day === day ? cur.n : 0;
  if (n >= cap) return false;
  daily.set(bucket, { day, n: n + 1 });
  return true;
}

export function dailyCount(bucket, now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  const cur = daily.get(bucket);
  return cur && cur.day === day ? cur.n : 0;
}

/** Tests only. */
export function _resetGuards() {
  windows.clear();
  daily.clear();
}

// ---- Page pass -------------------------------------------------------------
// /api/health hands the page a short-lived signed pass; /api/live-token needs it back in
// the X-Talk-Pass header. A script now has to load the page's health call first, inside the
// same 10 minutes, and still hits the per-IP limit and the daily cap. It raises the bar; the
// hard ceiling is a quota cap on the Google side (Gemini API, project ayu-local-projects).


export const PASS_TTL_MS = 10 * 60_000;

function passSecret(key) {
  return createHash('sha256').update(`ayu-daily-talk/page-pass:${process.env.PAGE_PASS_SECRET || key || ''}`).digest();
}

/** "<ms>.<hex hmac>" for this moment. */
export function issuePass(key, now = Date.now()) {
  const ts = String(now);
  return `${ts}.${createHmac('sha256', passSecret(key)).update(ts).digest('hex')}`;
}

/** True when the pass was issued by this server in the last PASS_TTL_MS. */
export function checkPass(key, pass, now = Date.now()) {
  const [ts, mac] = String(pass || '').split('.');
  const t = Number(ts);
  if (!ts || !mac || !Number.isFinite(t) || now - t > PASS_TTL_MS || t - now > 60_000) return false;
  const want = createHmac('sha256', passSecret(key)).update(ts).digest();
  let got;
  try {
    got = Buffer.from(mac, 'hex');
  } catch {
    return false;
  }
  return got.length === want.length && timingSafeEqual(got, want);
}
