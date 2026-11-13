import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi, sanitizeTalk } from '../server/lib/api.js';
import { checkOrigin, rateLimit, takeDaily, clientIp, _resetGuards } from '../server/lib/guard.js';

const FAKE = 'test-key-not-real';
const mintToken = async () => 'auth_tokens/fake';
const writeNote = async () => 'Short note.';
const req = (over = {}) => ({ method: 'POST', headers: { host: 'ayu.example' }, body: { persona: 'reena', lang: 'hi' }, ip: '1.2.3.4', ...over });

beforeEach(() => {
  _resetGuards();
  process.env.GEMINI_API_KEY = FAKE;
  process.env.ALLOWED_ORIGINS = 'https://gamingflexer.github.io';
  delete process.env.LIVE_TOKEN_DAILY_CAP;
  delete process.env.LIVE_TOKEN_PER_MIN;
});

test('origin: listed, same-host and no-Origin pass; others are refused', () => {
  assert.equal(checkOrigin({ origin: 'https://gamingflexer.github.io', host: 'x' }).ok, true);
  assert.equal(checkOrigin({ origin: 'https://ayu.example', host: 'ayu.example' }).ok, true);
  assert.equal(checkOrigin({ host: 'ayu.example' }).noOrigin, true);
  assert.equal(checkOrigin({ origin: 'https://evil.example', host: 'ayu.example' }).ok, false);
  assert.equal(checkOrigin({ origin: 'not a url', host: 'ayu.example' }).ok, false);
});

test('live-token: foreign origin → 403, no token minted', async () => {
  let minted = 0;
  const out = await handleApi('live-token', req({ headers: { host: 'ayu.example', origin: 'https://evil.example' } }), {
    mintToken: async () => (minted++, 't'),
  });
  assert.equal(out.status, 403);
  assert.equal(minted, 0);
});

test('live-token: no-Origin caller (React Native) gets a token, locked config for her language', async () => {
  const out = await handleApi('live-token', req(), { mintToken });
  assert.equal(out.status, 200);
  assert.equal(out.body.token, 'auth_tokens/fake');
  assert.match(out.body.config.systemInstruction, /Reena/);
  assert.match(out.body.config.systemInstruction, /Speak Hindi/);
  assert.equal(out.headers['Access-Control-Allow-Origin'], undefined);
});

test('live-token: allowed origin gets CORS headers; preflight 204', async () => {
  const h = { host: 'api.example', origin: 'https://gamingflexer.github.io' };
  const out = await handleApi('live-token', req({ headers: h }), { mintToken });
  assert.equal(out.headers['Access-Control-Allow-Origin'], 'https://gamingflexer.github.io');
  assert.equal((await handleApi('live-token', { method: 'OPTIONS', headers: h, ip: '1' })).status, 204);
});

test('live-token: per-IP rate limit (also for no-Origin callers)', async () => {
  process.env.LIVE_TOKEN_PER_MIN = '2';
  assert.equal((await handleApi('live-token', req(), { mintToken })).status, 200);
  assert.equal((await handleApi('live-token', req(), { mintToken })).status, 200);
  const third = await handleApi('live-token', req(), { mintToken });
  assert.equal(third.status, 429);
  assert.equal(third.body.mock, true);
  assert.equal((await handleApi('live-token', req({ ip: '5.6.7.8' }), { mintToken })).status, 200);
});

test('live-token: daily cap across IPs', async () => {
  process.env.LIVE_TOKEN_DAILY_CAP = '2';
  assert.equal((await handleApi('live-token', req({ ip: 'a' }), { mintToken })).status, 200);
  assert.equal((await handleApi('live-token', req({ ip: 'b' }), { mintToken })).status, 200);
  const out = await handleApi('live-token', req({ ip: 'c' }), { mintToken });
  assert.equal(out.status, 429);
  assert.equal(out.body.cap, true);
});

test('live-token: no key → 503 mock; GET → 405', async () => {
  process.env.GEMINI_API_KEY = '';
  assert.equal((await handleApi('live-token', req(), { mintToken })).status, 503);
  process.env.GEMINI_API_KEY = FAKE;
  assert.equal((await handleApi('live-token', req({ method: 'GET' }), { mintToken })).status, 405);
});

test('health never leaks the key', async () => {
  const out = await handleApi('health', { method: 'GET', headers: {}, ip: '1' });
  assert.equal(out.body.live, true);
  assert.doesNotMatch(JSON.stringify(out), new RegExp(FAKE));
});

test('summary: deterministic text always; model note when a key is set', async () => {
  const talk = { signs: ['bleeding'], referral: { level: 'see_today', reasons: ['bleeding'] }, answers: [], symptoms: [] };
  const out = await handleApi('summary', req({ body: { persona: 'sunita', talk } }), { writeNote });
  assert.equal(out.body.note, 'Short note.');
  assert.match(out.body.summary, /SEE TODAY/);
  process.env.GEMINI_API_KEY = '';
  const noKey = await handleApi('summary', req({ body: { persona: 'sunita', talk } }), { writeNote });
  assert.equal(noKey.body.note, null);
  assert.match(noKey.body.summary, /SEE TODAY/);
});

test('sanitizeTalk trims sizes and unknown levels', () => {
  const t = sanitizeTalk({ referral: { level: 'nuke' }, symptoms: [{ her_words: 'x'.repeat(5000) }], answers: Array(50).fill({ question: 'q', answer: 'a' }) });
  assert.equal(t.referral.level, 'none');
  assert.equal(t.symptoms[0].her_words.length, 160);
  assert.equal(t.answers.length, 12);
  assert.equal(sanitizeTalk('nope'), null);
});

test('guards: rate window slides; daily counter resets on a new day; ip from x-forwarded-for', () => {
  assert.equal(rateLimit('b', 'ip', { limit: 1, now: 0 }), true);
  assert.equal(rateLimit('b', 'ip', { limit: 1, now: 1000 }), false);
  assert.equal(rateLimit('b', 'ip', { limit: 1, now: 61_000 }), true);
  const day1 = Date.UTC(2026, 10, 13);
  assert.equal(takeDaily('d', 1, day1), true);
  assert.equal(takeDaily('d', 1, day1 + 1000), false);
  assert.equal(takeDaily('d', 1, day1 + 86_400_000), true);
  assert.equal(clientIp({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }), '9.9.9.9');
});

test('summary: a note that contradicts the rules is dropped', async () => {
  const talk = { signs: ['bleeding'], referral: { level: 'see_today' }, answers: [], symptoms: [] };
  const out = await handleApi('summary', req({ body: { persona: 'sunita', talk } }), { writeNote: async () => 'Routine follow-up, no urgent concern.' });
  assert.equal(out.body.note, null);
  assert.equal(out.body.dropped, 'contradicts referral');
});

test('live-token accepts every app language and falls back to English for others', async () => {
  const { handleApi } = await import('../server/lib/api.js');
  const { LANG_NAME } = await import('../shared/live-config.js');
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.LIVE_TOKEN_PER_MIN = '1000';
  for (const lang of [...Object.keys(LANG_NAME), 'xx']) {
    let seen = null;
    const res = await handleApi(
      'live-token',
      { method: 'POST', headers: {}, body: { persona: 'sunita', lang }, ip: `9.9.9.${lang.length}` },
      { mintToken: async ({ config }) => ((seen = config), 'tok') },
    );
    assert.equal(res.status, 200, lang);
    const want = LANG_NAME[lang] || 'English';
    assert.match(seen.systemInstruction, new RegExp(`She chose ${want} in the app`), lang);
  }
});
