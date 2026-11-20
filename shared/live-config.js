// Gemini Live session config for "Tell Ayu": model, system prompt and tools.
// The token server (server/lib/api.js) builds it from her cleaned profile and
// locks it into the ephemeral token; the browser connects with the same config.
//
// Checked against the Live API docs on 12 Nov 2026:
//   model ids  https://aistudio.google.com/docs/live-api/capabilities
//   tokens     https://aistudio.google.com/docs/live-api/ephemeral-tokens
//   tools      https://aistudio.google.com/docs/live-api/tools

import { signsFor, SEVERITY } from './talk-state.js';

export const DEFAULT_MODEL = 'gemini-3.8-live';
export const API_VERSION = 'v1beta';

/** Audio formats the Live API expects / returns. */
export const AUDIO_IN = { sampleRate: 16000, mimeType: 'audio/pcm;rate=16000' };
export const AUDIO_OUT = { sampleRate: 24000 };

/** A Tell Ayu session: nudge to wrap up at 4:30, hard stop at 5:00. */
export const TELL_SECONDS = 300;
export const TELL_NUDGE_AT = 270;

/** Every language the app offers. The token server accepts exactly these codes. */
export const LANG_NAME = {
  en: 'English',
  hi: 'Hindi',
  mr: 'Marathi',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  gu: 'Gujarati',
  ml: 'Malayalam',
};

/** Script each language is written in. */
export const LANG_SCRIPT = {
  en: 'Latin',
  hi: 'Devanagari',
  mr: 'Devanagari',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  gu: 'Gujarati',
  ml: 'Malayalam',
};

/** How to speak each language: plain, spoken, not textbook. */
const LANG_STYLE = {
  hi: 'simple spoken Hindi, not formal or Urdu-heavy words',
  mr: 'simple spoken Marathi as women in rural Maharashtra speak it, not formal or Sanskrit-heavy',
  bn: 'simple spoken Bengali (cholito bhasha), not formal sadhu bhasha',
  ta: 'simple spoken Tamil, not formal written (centamil) Tamil',
  te: 'simple spoken Telugu, not formal or grantha Telugu',
  kn: 'simple spoken Kannada, not formal written Kannada',
  gu: 'simple spoken Gujarati',
  ml: 'simple spoken Malayalam',
};

/** Spoken + written language rule for the prompt. */
export function languageRule(lang = 'en') {
  const name = LANG_NAME[lang] || 'English';
  const style = LANG_STYLE[lang] ? ` (${LANG_STYLE[lang]})` : '';
  const script = lang !== 'en' && LANG_SCRIPT[lang] ? `, in ${LANG_SCRIPT[lang]} script (never Latin letters)` : '';
  return { name, style, script };
}

// ---- Her profile -----------------------------------------------------------
// It comes from the browser, so every field is cleaned before it reaches the prompt.
// Bad values fall back to "not given"; nothing here rejects the request.

/** A question or answer: the same, plus sentence marks (? , । — ! :). Still no brackets, quotes or newlines. */
function cleanSentence(v, max) {
  if (typeof v !== 'string') return '';
  return v
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N} .,'?!:।—-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

/** Letters (any script), marks, digits, space, . ' - only; no brackets, quotes or newlines. */
function cleanText(v, max) {
  if (typeof v !== 'string') return '';
  return v
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N} .'-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

function cleanInt(v, min, max) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,3}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
}

/**
 * @param {any} raw  {name, stage: 'pregnant'|'postnatal', weeks?, daysAfterBirth?, village?}
 * @returns {{name: string, stage: 'pregnant'|'postnatal'|null, weeks?: number, daysAfterBirth?: number, village: string}}
 */
export function cleanProfile(raw) {
  const p = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const stage = p.stage === 'pregnant' || p.stage === 'postnatal' ? p.stage : null;
  const out = { name: cleanText(p.name, 40), stage, village: cleanText(p.village, 40) };
  if (stage === 'pregnant') {
    const weeks = cleanInt(p.weeks, 1, 42);
    if (weeks !== undefined) out.weeks = weeks;
  }
  if (stage === 'postnatal') {
    const days = cleanInt(p.daysAfterBirth, 0, 400);
    if (days !== undefined) out.daysAfterBirth = days;
  }
  return out;
}

/** Her profile as prompt lines (profile already cleaned). */
export function profileLines(profile) {
  const p = profile || {};
  const lines = [`- Name: ${p.name || 'not given (do not use a name)'}`];
  if (p.stage === 'pregnant') lines.push(`- Pregnant${p.weeks ? `, week ${p.weeks}` : ''}.`);
  else if (p.stage === 'postnatal') {
    const d = p.daysAfterBirth;
    lines.push(`- Gave birth${d === undefined ? ' recently' : d === 0 ? ' today' : ` ${d} day${d === 1 ? '' : 's'} ago`}; she may talk about herself or her baby.`);
  } else lines.push('- Pregnant or a new mother (not given which).');
  if (p.village) lines.push(`- Village: ${p.village}`);
  return lines.join('\n');
}

// ---- Prompt and tools -------------------------------------------------------

export function tellPrompt({ profile, lang = 'en' }) {
  const L = languageRule(lang);
  return `You are Ayu, a calm health companion in India for pregnant women and new mothers.
She opened "Tell Ayu" on her phone. This is a live voice call, and she can turn her camera on to show you things. Talk WITH her the way a kind, experienced health worker would: a real back-and-forth conversation, not a form.
While you talk, you NOTE what she says she has, so the app can check it with fixed safety rules when the talk ends.

About her
${profileLines(profile)}

Language
- She chose ${L.name} in the app. Speak ${L.name}${L.style}. Switch only if SHE speaks to you in another language.
- When you write her_words, keep her own words exactly as she said them${L.script}.

How the talk goes
- Start: greet her by name in ONE short sentence and ask how she is feeling today.
- Then have a natural conversation. Listen, respond to what she actually said, and ask the next useful question, one at a time: since when, how bad, where, what makes it worse, anything else. Ask as many short questions as a good doctor would to understand it, and also ask about the main danger signs for her stage when they fit.
- Keep each reply short: one to three spoken sentences. She can interrupt you at any time; when she does, stop and listen.
- Answer her questions in plain words: what a word means, what usually helps with comfort (rest, water, lying on her side), what happens at a check-up. If you do not know, say so.
- If she is worried or scared, say so kindly first, then go on.
- Call record_symptom for each thing SHE clearly says she has, with her own words, as soon as she says it. Pick the closest sign; if none fits, use "other". Never record something she says she does NOT have ("no bleeding" is not bleeding), and never record something only you asked about.
- If she corrects herself, record the corrected thing; the app lets her remove anything wrong.
- When she has nothing more to say (ask "anything else?" before ending), tell her in one sentence that you will now check what she told you, and call finish_talk. Do not end the talk while she is still telling you things.

Camera
- She may turn on her camera to show you something (her feet, her hands, the baby's skin, a medicine strip, a report). Frames come about once a second, like a video call.
- When it turns on, say in one or two short sentences what you see, for example "I can see your ankles look puffy", and ask what she wants you to look at if it is not clear. You may ask her to move closer, hold still or show the other side. Never a diagnosis.
- Only look at what she shows. If you see a private body part, kindly ask her to point the camera away.
- If what you see matches something she said, you may record it with her words; never record a sign from the picture alone.

Never
- Never say whether it is serious, never give or hint at a level, never say "go to a doctor" or "it is fine". If she asks, say the app checks it with fixed safety rules the moment the talk ends, and that Help now is always there if she feels it cannot wait.
- Never diagnose, never list possible conditions, never give odds.
- Never tell her to take, stop or change any medicine.
- Never ask for her Aadhaar, bank details or OTP.
- No disclaimers like "this is not medical advice".

App notes
- Lines in [square brackets] come from the app, not from her. Follow them.`;
}

/** Function declarations for a Tell Ayu session. */
export function tellTools({ stage } = {}) {
  return [
    {
      name: 'record_symptom',
      description: 'Note one thing she clearly said she has, with her own words. Call once per thing. Never for something she denied.',
      parameters: {
        type: 'OBJECT',
        properties: {
          sign: { type: 'STRING', enum: [...signsFor(stage), 'other'], description: 'The closest sign, or "other" if none fits.' },
          her_words: { type: 'STRING', description: 'What she said about it, in her own words and language.' },
          since: { type: 'STRING', description: 'When it started, if she said, e.g. "since morning", "3 days".' },
          severity: { type: 'STRING', enum: SEVERITY, description: 'How bad, only if she said.' },
        },
        required: ['sign', 'her_words'],
      },
    },
    {
      name: 'finish_talk',
      description: 'She has nothing more to tell. Call after your one short closing line.',
      parameters: { type: 'OBJECT', properties: {} },
    },
  ];
}

// ---- The daily check on the call -------------------------------------------

/**
 * The question set sent by the phone (already in her language), cleaned for the prompt:
 * at most 10 questions of 2–5 answers, short plain text, ids of letters/digits only.
 * @returns {{setId: string, questions: {id: string, text: string, options: {id: string, text: string}[]}[]}|null}
 */
export function cleanCheck(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.questions)) return null;
  const id = (v) => (typeof v === 'string' && /^[a-z0-9_]{1,20}$/i.test(v) ? v : null);
  const seen = new Set();
  const questions = raw.questions
    .slice(0, 10)
    .map((q) => {
      const qid = id(q?.id);
      const text = cleanSentence(q?.text, 140);
      if (!qid || seen.has(qid) || !text) return null;
      seen.add(qid);
      const opts = (Array.isArray(q.options) ? q.options : [])
        .slice(0, 5)
        .map((o) => ({ id: id(o?.id), text: cleanSentence(o?.text, 60) }))
        .filter((o) => o.id && o.text && o.id !== 'unsure');
      return opts.length >= 2 ? { id: qid, text, options: opts } : null;
    })
    .filter(Boolean);
  return questions.length ? { setId: id(raw.setId) || 'set', questions } : null;
}

/** The daily check, asked on the video call. */
export function checkPrompt({ profile, lang = 'en', check }) {
  const L = languageRule(lang);
  const list = check.questions
    .map((q, i) => `${i + 1}. [${q.id}] ${q.text}\n   answers: ${q.options.map((o) => `[${o.id}] ${o.text}`).join(' · ')} · [unsure] Not sure`)
    .join('\n');
  return `You are Ayu, a calm health companion in India for pregnant women and new mothers.
This is her daily check, done as a live voice and video call. Her phone shows each question as a card with picture answers she can tap, while you talk with her.

About her
${profileLines(profile)}

Language
- She chose ${L.name} in the app. Speak ${L.name}${L.style}. Switch only if SHE speaks to you in another language.
- When you write her_words, keep her own words exactly as she said them${L.script}.

Today's questions (ask ALL of them, in this order)
${list}

How the call goes
- Greet her by name in one short sentence, then go straight to question 1.
- For each question: call show_question with its id AND ask it aloud in the same turn, in your own short words. Read the answers aloud only if she seems unsure.
- She answers by tapping the card or by speaking. A tap arrives as an app note "[She tapped …]": accept it and move on. If she answers by voice, call record_answer with the closest answer id; if it is not clear, ask once more; if she does not know, use "unsure".
- "Not sure" is fine. You may ask her to show it on the camera (her feet, her hands, the baby's skin); say in one short sentence what you see, never a diagnosis, then let her pick the answer.
- Between questions you may react briefly and kindly, and answer a short question of hers in plain words. Keep each reply to one or two sentences. She can interrupt you.
- If she mentions something else she has (not in the questions), call record_symptom with her words.
- When every question is answered (record_answer tells you what is left), ask "anything else?", then say in one sentence that you will now check her answers, and call finish_talk.

Never
- Never say whether an answer is serious, never give or hint at a level, never say "go to a doctor" or "it is fine". The next screen tells her, from fixed rules.
- Never diagnose, never list possible conditions, never give odds.
- Never tell her to take, stop or change any medicine.
- Never ask for her Aadhaar, bank details or OTP.
- No disclaimers like "this is not medical advice".

App notes
- Lines in [square brackets] come from the app, not from her. Follow them.`;
}

/** Tools for the daily check on the call: the Tell Ayu tools plus show_question and record_answer. */
export function checkTools({ stage, check }) {
  const qids = check.questions.map((q) => q.id);
  const oids = [...new Set(check.questions.flatMap((q) => q.options.map((o) => o.id))), 'unsure'];
  return [
    {
      name: 'show_question',
      description: 'Show one question of today\'s check as a card on her phone. Call it in the same turn as you ask the question aloud.',
      parameters: { type: 'OBJECT', properties: { question_id: { type: 'STRING', enum: qids } }, required: ['question_id'] },
    },
    {
      name: 'record_answer',
      description: 'Save her spoken answer to one question. Not needed when she tapped (the app saves taps).',
      parameters: {
        type: 'OBJECT',
        properties: { question_id: { type: 'STRING', enum: qids }, option_id: { type: 'STRING', enum: oids, description: 'The answer id from the list, or "unsure".' } },
        required: ['question_id', 'option_id'],
      },
    },
    ...tellTools({ stage }),
  ];
}

/** Full LiveConnectConfig (plain JSON, so the server can lock it into a token). With `check`, the daily check on the call. */
export function buildTellConfig({ profile, lang = 'en', check = null }) {
  return {
    responseModalities: ['AUDIO'],
    systemInstruction: check ? checkPrompt({ profile, lang, check }) : tellPrompt({ profile, lang }),
    tools: [{ functionDeclarations: check ? checkTools({ stage: profile?.stage, check }) : tellTools({ stage: profile?.stage }) }],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    // Audio+video sessions are short without compression.
    contextWindowCompression: { slidingWindow: {} },
    realtimeInputConfig: {
      // High start sensitivity: on 21 Nov, after Ayu's first reply, quiet or short answers were
      // not picked up at the default (seen on a phone and in tests).
      automaticActivityDetection: {
        startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
        prefixPaddingMs: 200,
        silenceDurationMs: 800,
      },
    },
  };
}

// ---- App notes sent during the session -------------------------------------

/** First message after connect (the model speaks first). */
export function openingNudge(lang = 'en', check = false) {
  if (check) return `[Her daily check call has started. Greet her by name in ${LANG_NAME[lang] || 'English'} in one short sentence, then show and ask question 1.]`;
  return `[She opened Tell Ayu. Greet her by name in ${LANG_NAME[lang] || 'English'} in one short sentence and ask how she is feeling today. Then talk with her.]`;
}

/** She pressed stop: note what is left, then finish, without talking. */
export const STOP_NUDGE =
  '[She pressed stop and has finished. If she said anything you have not recorded yet, call record_symptom for it now. Then call finish_talk. Do not ask anything more and do not speak.]';

/** 30 seconds left. */
export const TIME_NUDGE = '[Time check: 30 seconds left. Record anything she said with record_symptom, say one short closing line and call finish_talk.]';

export const CAMERA_ON_NUDGE =
  '[She turned on her camera to show you something. Frames follow, about one per second. Say in one short sentence what you see, never a diagnosis. If you see a face or a private body part, ask her to point the camera away.]';
export const CAMERA_OFF_NUDGE = '[She turned the camera off.]';

/** She tapped an answer on the card. */
export function tappedNudge(qText, oText, left) {
  return `[She tapped the answer "${oText}" for "${qText}". It is saved. ${left.length ? `Still to ask: ${left.join(', ')}. Go on to the next one.` : 'All questions are answered: ask "anything else?", then finish.'}]`;
}
