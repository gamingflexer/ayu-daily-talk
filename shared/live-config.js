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

/** Full LiveConnectConfig (plain JSON, so the server can lock it into a token). */
export function buildTellConfig({ profile, lang = 'en' }) {
  return {
    responseModalities: ['AUDIO'],
    systemInstruction: tellPrompt({ profile, lang }),
    tools: [{ functionDeclarations: tellTools({ stage: profile?.stage }) }],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    // Audio+video sessions are short without compression.
    contextWindowCompression: { slidingWindow: {} },
    realtimeInputConfig: {
      automaticActivityDetection: { silenceDurationMs: 700 },
    },
  };
}

// ---- App notes sent during the session -------------------------------------

/** First message after connect (the model speaks first). */
export function openingNudge(lang = 'en') {
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
