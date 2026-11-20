// The research store: one record per finished talk or check, so Ayu can be improved
// after testing (Om, 21 Nov 2026). Firestore in the project ayu-daily-talk-research,
// written with the public web key; the security rules (firebase/firestore.rules) let a
// phone ADD a record and nothing else, and reject any field not listed there.
//
// No name, phone number, village or ASHA details are ever sent: a random id per phone,
// her stage and week, the language, what was said turn by turn, the answers, the signs,
// the level and the rule. See docs/RESEARCH-DATA.md.
//
// Saving never blocks her: it runs in the background, and a record that cannot be sent
// (no network) waits on the phone and is sent the next time the app opens.

const PROJECT = import.meta.env.VITE_FIREBASE_PROJECT || '';
const KEY = import.meta.env.VITE_FIREBASE_API_KEY || '';
const URL_ = PROJECT && KEY ? `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/talks?key=${KEY}` : '';
const QUEUE = 'ayu:research-queue';
const DEVICE = 'ayu:device';

export const researchOn = Boolean(URL_);

function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE);
    if (!id) {
      id = `d_${crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)}`;
      localStorage.setItem(DEVICE, id);
    }
    return id.slice(0, 40);
  } catch {
    return 'd_nostorage';
  }
}

/** A plain JS value as a Firestore REST value. */
function fs(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v.slice(0, 4000) };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fs) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, fs(x)])) } };
}

const LEVELS = ['none', 'watch', 'see_today', 'emergency'];

/**
 * Build the record. Only these fields leave the phone (the rules allow no others).
 * @param {object} r
 */
export function researchRecord(r, { device = deviceId(), now = Date.now() } = {}) {
  const rec = {
    v: 1,
    kind: r.kind, // 'call' (daily check on the video call) | 'check' (tapped) | 'tell' | 'quick'
    device,
    at: r.at || now,
    endedAt: r.endedAt || now,
    lang: r.lang || 'en',
    stage: r.stage || null,
    weeks: r.weeks ?? null,
    daysAfterBirth: r.daysAfterBirth ?? null,
    setId: r.setId || null,
    turns: (r.turns || []).slice(0, 400).map((x) => ({ who: x.who, text: String(x.text || '').slice(0, 1000), at: x.at || null })),
    answers: r.answers || null,
    signs: r.signs || [],
    confirmed: r.confirmed || [],
    removed: r.removed || [],
    level: LEVELS.includes(r.level) ? r.level : 'unknown',
    rule: r.rule || null,
    items: (r.items || []).map((x) => ({ code: x.code || null, level: x.level || null })),
    camera: Boolean(r.camera),
    endedBy: r.endedBy || null,
    model: r.model || null,
    app: __APP_VERSION__,
  };
  return rec;
}

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE) || '[]');
  } catch {
    return [];
  }
}
function writeQueue(q) {
  try {
    localStorage.setItem(QUEUE, JSON.stringify(q.slice(-50)));
  } catch {
    // storage full or blocked — this record is lost, the app goes on
  }
}

async function post(rec) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fs(rec).mapValue.fields }),
    keepalive: true,
  });
  // 4xx other than rate limits will never succeed: drop it rather than retry forever.
  if (!res.ok && (res.status === 429 || res.status >= 500)) throw new Error(`research ${res.status}`);
  return res.ok;
}

/** Save one record in the background. Never throws. */
export function saveResearch(r) {
  if (!researchOn) return;
  const rec = researchRecord(r);
  post(rec).catch(() => writeQueue([...readQueue(), rec]));
}

/** Send what waited on the phone (called once when the app opens). */
export async function flushResearch() {
  if (!researchOn) return;
  const q = readQueue();
  if (!q.length) return;
  writeQueue([]);
  const left = [];
  for (const rec of q) {
    try {
      await post(rec);
    } catch {
      left.push(rec);
    }
  }
  if (left.length) writeQueue([...left, ...readQueue()]);
}
