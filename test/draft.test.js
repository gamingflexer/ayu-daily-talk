import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../server/lib/api.js';
import { _resetGuards, issuePass } from '../server/lib/guard.js';
import { draftRequest, draftSchema, forTransport, draftPrompt } from '../server/lib/draft.js';
import { sanitizeDraft } from '../shared/question-sets.js';
import { optionLevel } from '../shared/triage.js';

const FAKE = 'test-key-not-real';
const pageHeaders = () => ({ host: 'ayu.example', origin: 'https://ayu.example', 'x-talk-pass': issuePass(FAKE) });
const req = (over = {}) => ({
  method: 'POST',
  headers: pageHeaders(),
  body: { stage: 'postnatal', about: 'new mothers in the first 6 weeks', langs: ['en', 'mr'] },
  ip: '1.2.3.4',
  ...over,
});

const text = (en, mr) => ({ en, mr });
const RAW = {
  title: text('New mother · first 6 weeks', 'नवी आई · पहिले ६ आठवडे'),
  questions: [
    {
      text: text('How much are you bleeding today?', 'आज किती रक्तस्राव होतोय?'),
      options: [
        { text: text('Less than a period', 'पाळीपेक्षा कमी'), level: 'none' },
        { text: text('Like a heavy period', 'जास्त पाळीसारखा'), level: 'watch' },
        // Too low on purpose: heavy bleeding is a 108 sign in the fixed rules.
        { text: text('A pad soaked in an hour', 'तासात पॅड भिजतो'), level: 'none', sign: 'heavy_bleeding' },
      ],
    },
    {
      text: text('Do you have a fever?', 'ताप आहे का?'),
      options: [
        { text: text('No', 'नाही'), level: 'none' },
        { text: text('Fever or chills', 'ताप किंवा थंडी'), level: 'see_today', sign: 'fever' },
        { text: { en: 'Bad sign', mr: 'x' }, level: 'made_up', sign: 'not_a_sign' },
      ],
    },
  ],
};
const writeDraft = async () => structuredClone(RAW);

beforeEach(() => {
  _resetGuards();
  process.env.GEMINI_API_KEY = FAKE;
  delete process.env.DRAFT_DAILY_CAP;
  delete process.env.DRAFT_PER_MIN;
});

test('draftRequest: stage, about and languages are cleaned; English is always there', () => {
  const r = draftRequest({ stage: 'x', about: `  a\n b ${'z'.repeat(400)}`, langs: ['mr', 'fr', 'hi', 'mr'] });
  assert.equal(r.stage, 'pregnant');
  assert.equal(r.about.length, 300);
  assert.ok(r.about.startsWith('a b '));
  assert.deepEqual(r.langs, ['en', 'mr', 'hi']);
  assert.deepEqual(draftRequest(null), { stage: 'pregnant', about: '', langs: ['en'] });
});

test('schema asks for exactly the requested languages', () => {
  const s = draftSchema(['en', 'hi']);
  assert.deepEqual(s.properties.title.required, ['en', 'hi']);
  const opt = s.properties.questions.items.properties.options.items;
  assert.deepEqual(opt.properties.level.enum, ['none', 'watch', 'see_today', 'emergency']);
  // The sign is a plain string in the schema (the full enum is too large for the API); the prompt lists the keys.
  assert.equal(opt.properties.sign.type, 'string');
  assert.ok(draftPrompt({ stage: 'postnatal', about: '', langs: ['en'] }).includes('heavy_bleeding'));
});

test('sanitising: unknown levels and signs are dropped, stage comes from the request, nothing is checked', async () => {
  const out = await handleApi('draft-questions', req(), { writeDraft });
  assert.equal(out.status, 200);
  const d = out.body.draft;
  assert.equal(d.stage, 'postnatal');
  assert.equal(d.questions.length, 2);
  const odd = d.questions[1].options[2];
  assert.equal(odd.level, 'none');
  assert.equal(odd.sign, undefined);
  assert.equal(d.questions[0].text.mr, 'आज किती रक्तस्राव होतोय?');
});

test('a second sanitize on the phone keeps every level (server sends `level`, not `floor`)', async () => {
  const out = await handleApi('draft-questions', req(), { writeDraft });
  const phone = sanitizeDraft(out.body.draft, { id: 'set_1' });
  assert.equal(phone.stage, 'postnatal');
  assert.equal(phone.status, 'draft');
  assert.deepEqual(
    phone.questions.map((q) => q.options.map((o) => o.floor)),
    [
      ['none', 'watch', 'none'],
      ['none', 'see_today', 'none'],
    ],
  );
  assert.ok(phone.questions.every((q) => q.checked === false));
  // Round trip is stable.
  assert.deepEqual(forTransport(sanitizeDraft(out.body.draft)), out.body.draft);
});

test('a too-low level on a signed answer is stored as given, but the fixed rule still sets the minimum', async () => {
  const out = await handleApi('draft-questions', req(), { writeDraft });
  const phone = sanitizeDraft(out.body.draft, { id: 'set_1' });
  const soaked = phone.questions[0].options[2];
  assert.equal(soaked.sign, 'heavy_bleeding');
  assert.equal(soaked.floor, 'none');
  assert.equal(optionLevel(soaked, { stage: 'postnatal' }), 'emergency');
  assert.equal(optionLevel({ sign: soaked.sign }, { stage: 'postnatal' }), 'emergency');
});

test('guards: no Origin → 403, model not called', async () => {
  let called = 0;
  const headers = { host: 'ayu.example', 'x-talk-pass': issuePass(FAKE) };
  const out = await handleApi('draft-questions', req({ headers }), { writeDraft: async () => (called++, RAW) });
  assert.equal(out.status, 403);
  assert.equal(called, 0);
});

test('guards: foreign Origin → 403', async () => {
  const out = await handleApi('draft-questions', req({ headers: { host: 'ayu.example', origin: 'https://evil.example', 'x-talk-pass': issuePass(FAKE) } }), { writeDraft });
  assert.equal(out.status, 403);
});

test('guards: no key → 503', async () => {
  process.env.GEMINI_API_KEY = '';
  const out = await handleApi('draft-questions', req(), { writeDraft });
  assert.equal(out.status, 503);
  assert.ok(out.body.error);
});

test('guards: no page pass → 403; GET → 405', async () => {
  const out = await handleApi('draft-questions', req({ headers: { host: 'ayu.example', origin: 'https://ayu.example' } }), { writeDraft });
  assert.equal(out.status, 403);
  assert.equal(out.body.pass, false);
  assert.equal((await handleApi('draft-questions', req({ method: 'GET' }), { writeDraft })).status, 405);
});

test('guards: per-IP rate limit and daily cap', async () => {
  process.env.DRAFT_PER_MIN = '2';
  assert.equal((await handleApi('draft-questions', req(), { writeDraft })).status, 200);
  assert.equal((await handleApi('draft-questions', req(), { writeDraft })).status, 200);
  assert.equal((await handleApi('draft-questions', req(), { writeDraft })).status, 429);
  _resetGuards();
  process.env.DRAFT_PER_MIN = '10';
  process.env.DRAFT_DAILY_CAP = '1';
  assert.equal((await handleApi('draft-questions', req({ ip: '9.9.9.1' }), { writeDraft })).status, 200);
  const capped = await handleApi('draft-questions', req({ ip: '9.9.9.2' }), { writeDraft });
  assert.equal(capped.status, 429);
  assert.equal(capped.body.cap, true);
});

test('model failure or an unusable draft → 502, never a sample draft', async () => {
  const boom = await handleApi('draft-questions', req(), {
    writeDraft: async () => {
      throw new Error('model down');
    },
  });
  assert.equal(boom.status, 502);
  assert.equal(boom.body.draft, undefined);
  const empty = await handleApi('draft-questions', req({ ip: '5.5.5.5' }), { writeDraft: async () => ({ title: { en: 'x' }, questions: [] }) });
  assert.equal(empty.status, 502);
  assert.equal(empty.body.draft, undefined);
});
