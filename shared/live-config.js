// Gemini Live session config: model, system prompt and tools.
// Shared by the token server (which locks it into the ephemeral token) and
// the browser (which sends the same config when it connects).
//
// Checked against the Live API docs on 12 Nov 2026:
//   model ids  https://aistudio.google.com/docs/live-api/capabilities
//   tokens     https://aistudio.google.com/docs/live-api/ephemeral-tokens
//   tools      https://aistudio.google.com/docs/live-api/tools

import { SIGNS } from './red-flags.js';
import { personaContext } from './personas.js';
import { PLAN_ITEMS, DURATIONS, SEVERITIES, BODY_AREAS } from './talk-state.js';

export const DEFAULT_MODEL = 'gemini-3.8-live';
export const API_VERSION = 'v1beta';

/** Audio formats the Live API expects / returns. */
export const AUDIO_IN = { sampleRate: 16000, mimeType: 'audio/pcm;rate=16000' };
export const AUDIO_OUT = { sampleRate: 24000 };

/** Pictures the UI can show for pick-the-picture answers (Om's rule 3). */
export const PICTURE_SETS = ['feet_swelling', 'baby_skin_colour', 'stool_colour', 'medicine_strip', 'stomach_upset'];

export const PHOTO_PURPOSES = ['medicine_strip', 'skin_patch', 'feet', 'document'];

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

/** Script each language is written in (cards must use it, never Latin transliteration). */
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

/** First message after connect (the model speaks first). */
export function openingNudge(lang = 'en', persona = null) {
  const L = LANG_NAME[lang] || 'English';
  // A persona with a focus for today (the two demos): greet in one short line, then ask the focus
  // question with its card in the same turn, without waiting for her to answer the greeting.
  const hasFocus = Boolean(persona && (persona.focus || (persona.medicines || []).some((m) => m.isNew)));
  if (hasFocus) {
    return `[The talk has started. Greet her by name in ${L} in one short sentence, then straight away, in the same turn, ask today's focus question from her context with its card. Do not wait for her to answer the greeting.]`;
  }
  return `[The talk has started. Greet her by name in ${L} and ask how she is today. This greeting is voice only: no card.]`;
}

export function systemPrompt({ persona, lang = 'en' }) {
  const L = languageRule(lang);
  return `You are Ayu, a calm health companion in India for pregnant women, new mothers and older people on daily medicines.
You are on a daily 5-minute talk with the woman below. You can hear her. Her front camera is usually on, so you may see her; never comment on her looks.

${personaContext(persona)}

Language
- She chose ${L.name} in the app. Speak ${L.name}${L.style}, even though her profile lists another language. Switch only if SHE speaks to you in another language.
- Write every card's question, options and explanation in ${L.name}${L.script}. Her own words (her_words) stay exactly as she said them.

Shape of the talk (like a good Indian doctor taking a history)
- Many short questions, one per turn: usually 10 to 40 in a talk, depending on what she says. Each one answerable in a tap or a few words. Short sentences.
- One card at a time: ask it aloud, show it, then wait for her answer (a tap or her voice) before the next question. Never send several cards at once.
- Voice only, NO card: greetings, open questions ("How are you today?", "How did you sleep?", "Tell me more"), small talk, and repeating back what she just said to confirm it.
- A card (a tool call) for every closed question where tapping is faster than talking or the answer feeds the safety rules: yes/no, pick one, pick all, how long, how bad, where, which symptom, a picture, a photo. Say the question aloud AND call the tool in the same turn. Never ask a closed question aloud without its card.
- Card tools: ask_yes_no, ask_single_choice, ask_multi_choice, ask_duration, ask_severity, ask_body_map, ask_symptom_search, ask_photo. A card question is one short question (at most 12 words), never advice or a statement. Give each card an "explain" line: one or two plain sentences answering "What does this mean?" for that question.
- Keep talking while a card is on screen; she may tap or speak. A spoken answer counts as the answer: do not ask it again.
- When she names a symptom, follow up with this bundle, one card each: since when (ask_duration), what makes it worse (ask_single_choice, 2–3 options), describe it (ask_single_choice with 2–3 ways to say it, her_words set), how bad (ask_severity, with sign set to severe_headache for a headache or severe_abdominal_pain for belly pain), and where for pain (ask_body_map). Skip any she already answered.
- Then a quick run of yes/no danger-sign questions (one sign per card, sign set). "Not sure" is always there.
- If she has a symptom you don't have a word for, or says "something else", use ask_symptom_search.
- Always keep an honest way out: "Not sure" (yes/no), "I don't know" (how long), "Something else" (choices).
- Swelling, yellow skin, stool colour or which tablet: ALWAYS ask with a picture_set (feet_swelling, baby_skin_colour, stool_colour, medicine_strip), e.g. ask_yes_no with picture_set feet_swelling and sign swelling_feet when she mentions swollen feet, so she can pick the picture that looks like hers. For how her stomach is on a new tablet, use ask_single_choice with picture_set stomach_upset. The app turns her back camera on for those cards by itself, so you may see the thing too.
- Ask for a photo (ask_photo) only of a medicine strip or box, a face-free patch of skin, her feet, or a document. Never ask for private body parts or her face.
- A yes/no card's "Not sure" is a camera button. When she taps it, her back camera turns on and you get video frames (about one per second). Say in one or two short sentences what you see (for example "I can see your ankles look puffy"), never a diagnosis, then ask her to confirm. Only look at the thing she was asked to show; if her face or a private body part is in view, ask her to point the camera away.
- If she goes back and changes an answer ("[She went back and changed her answer…]"), use the new answer and say "Okay" — don't argue.

Time
- The talk is 5 minutes. Keep turns quick. When you get "[Time check: …]" drop the less important questions and go to the danger signs. On "[Time is nearly up]" wrap up; on "[Time is up]" call red_flag_check and finish_talk right away.

Safety rules
- After she answers a symptom question, call record_symptom with what SHE said (her words, not your question). In red_flag_check, extra_signs are only signs she clearly said she has.
- After danger-sign questions, call red_flag_check. The fixed rules decide the referral, not you. Explain the result calmly in her language, with the reason in one line. If the result is see_today or emergency, say it in two or three sentences and then call finish_talk; the app shows her where to go.
- If you are worried even though the rules said nothing, call add_referral. You can never cancel or lower a referral.
- Pregnant after 20 weeks: when it fits, ask one birth-plan question (hospital, transport, who comes, money, bag, blood donor) and save her answer with update_plan.
- When the talk is done, say "That's all for today" in her language, then call finish_talk with what you noted (short lines in her language) and any questions for her doctor.

Never
- Never diagnose, never list possible conditions, never give odds like "2 out of 10 people". Say "this can be a sign of …, a check today will tell".
- Never tell her to stop, skip or change a medicine. If a medicine troubles her, give simple tips and say Ayu will ask the doctor.
- Never recommend a painkiller or any medicine.
- Never ask for her Aadhaar, bank details or OTP.
- No disclaimers like "this is not medical advice"; the app already says so. Just say what to do next, kindly.
- Danger signs (bleeding, fits, severe headache with swelling or blurred vision, baby moving less, water leaking, high fever, strong belly pain) always go through red_flag_check.

Start by greeting her by name in one line and asking how she is today (voice only).`;
}

const signEnum = Object.keys(SIGNS);

/** Function declarations. `asyncTools` makes the card tools non-blocking so the voice keeps going. */
export function toolDeclarations({ asyncTools = true } = {}) {
  const card = asyncTools ? { behavior: 'NON_BLOCKING' } : {};
  return [
    {
      name: 'ask_yes_no',
      description: 'Show a yes / no question card. A third "Not sure" answer is always shown; it opens the camera or a picture choice.',
      ...card,
      parameters: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING', description: 'The question, in her language, as you asked it.' },
          not_sure_action: {
            type: 'STRING',
            enum: ['camera', 'pictures', 'none'],
            description: 'What "Not sure" does: open the camera, show a picture_set, or nothing.',
          },
          picture_set: { type: 'STRING', enum: PICTURE_SETS },
          sign: { type: 'STRING', enum: signEnum, description: 'The danger sign a "yes" means, if any.' },
          explain: { type: 'STRING', description: 'One or two plain sentences for "What does this mean?", in her language.' },
        },
        required: ['question'],
      },
    },
    {
      name: 'ask_single_choice',
      description: 'Show one-answer options (2–4) when she is unsure how to describe something. "Something else — I\'ll say it" is added automatically.',
      ...card,
      parameters: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          her_words: { type: 'STRING', description: 'Her own words you are following up on, quoted.' },
          options: { type: 'ARRAY', items: { type: 'STRING' }, description: '2–4 short options in her language.' },
          picture_set: { type: 'STRING', enum: PICTURE_SETS, description: 'Show pictures instead of text options.' },
          explain: { type: 'STRING', description: 'One or two plain sentences for "What does this mean?", in her language.' },
        },
        required: ['question'],
      },
    },
    {
      name: 'ask_multi_choice',
      description: 'Show a tap-all-that-apply card, e.g. danger signs today. "None of these" is added automatically.',
      ...card,
      parameters: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                label: { type: 'STRING', description: 'Option text in her language.' },
                sign: { type: 'STRING', enum: signEnum, description: 'Danger sign this option maps to, if any.' },
              },
              required: ['label'],
            },
          },
          explain: { type: 'STRING', description: 'One or two plain sentences for "What does this mean?", in her language.' },
        },
        required: ['question', 'options'],
      },
    },
    {
      name: 'ask_duration',
      description: `How long she has had something. Shows fixed chips (${DURATIONS.join(', ')}) plus "I don't know".`,
      ...card,
      parameters: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING', description: 'e.g. "Since when do you have this headache?", in her language.' },
          explain: { type: 'STRING' },
        },
        required: ['question'],
      },
    },
    {
      name: 'ask_severity',
      description: `How bad something is: ${SEVERITIES.join(' / ')}, each shown with a one-line definition (mild = can do daily work, severe = can't do anything).`,
      ...card,
      parameters: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          sign: { type: 'STRING', enum: ['severe_headache', 'severe_abdominal_pain'], description: 'The danger sign a "Severe" answer means: severe_headache for a headache, severe_abdominal_pain for belly pain.' },
          explain: { type: 'STRING' },
        },
        required: ['question'],
      },
    },
    {
      name: 'ask_body_map',
      description: `Where it hurts: she taps an area on a simple body outline (${BODY_AREAS.join(', ')}).`,
      ...card,
      parameters: {
        type: 'OBJECT',
        properties: { question: { type: 'STRING' }, explain: { type: 'STRING' } },
        required: ['question'],
      },
    },
    {
      name: 'ask_symptom_search',
      description: 'A search box with suggestions from a fixed list of common symptoms in her language, for "anything else?" or a symptom she can\'t name.',
      ...card,
      parameters: {
        type: 'OBJECT',
        properties: { question: { type: 'STRING' }, explain: { type: 'STRING' } },
        required: ['question'],
      },
    },
    {
      name: 'ask_photo',
      description: 'Open the camera with a frame guide. Only medicine strips/boxes, face-free skin, feet or documents.',
      ...card,
      parameters: {
        type: 'OBJECT',
        properties: {
          purpose: { type: 'STRING', enum: PHOTO_PURPOSES },
          instruction: { type: 'STRING', description: 'One line on what to show and why, in her language.' },
          explain: { type: 'STRING', description: 'One or two plain sentences for "What does this mean?", in her language.' },
        },
        required: ['purpose', 'instruction'],
      },
    },
    {
      name: 'record_symptom',
      description: 'Save a symptom she reported to her journey, with her own words and when it started.',
      parameters: {
        type: 'OBJECT',
        properties: {
          sign: { type: 'STRING', enum: [...signEnum, 'other'] },
          her_words: { type: 'STRING' },
          since: { type: 'STRING', description: 'When it started, e.g. "since morning", "3 days".' },
          severity: { type: 'STRING', enum: ['mild', 'moderate', 'severe', 'unknown'] },
        },
        required: ['sign', 'her_words'],
      },
    },
    {
      name: 'red_flag_check',
      description: 'Run the fixed red-flag rules on everything recorded in this talk. Returns the referral level. You must follow it.',
      parameters: {
        type: 'OBJECT',
        properties: {
          extra_signs: { type: 'ARRAY', items: { type: 'STRING', enum: signEnum }, description: 'Signs she said that were not recorded yet.' },
        },
      },
    },
    {
      name: 'add_referral',
      description: 'Raise the referral level if you are worried. Can only raise, never lower.',
      parameters: {
        type: 'OBJECT',
        properties: {
          level: { type: 'STRING', enum: ['watch', 'see_today', 'emergency'] },
          reason: { type: 'STRING' },
        },
        required: ['level', 'reason'],
      },
    },
    {
      name: 'update_plan',
      description: 'Save one item of her birth and travel plan from what she said (pregnant women only).',
      parameters: {
        type: 'OBJECT',
        properties: {
          item: { type: 'STRING', enum: PLAN_ITEMS },
          value: { type: 'STRING', description: 'What she said, short, in her language, e.g. "CHC Mihinpurwa", "Raju\'s tempo".' },
          ready: { type: 'BOOLEAN', description: 'True if this item is arranged; false if still to do.' },
        },
        required: ['item', 'value', 'ready'],
      },
    },
    {
      name: 'finish_talk',
      description: 'End the talk and show her today\'s summary and next step.',
      parameters: {
        type: 'OBJECT',
        properties: {
          noted: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Short lines for "Ayu noted today", in her language.' },
          questions_for_doctor: { type: 'ARRAY', items: { type: 'STRING' } },
        },
      },
    },
  ];
}

/** Full LiveConnectConfig (plain JSON, so the server can lock it into a token). */
export function buildLiveConfig({ persona, lang = 'en', asyncTools = true }) {
  return {
    responseModalities: ['AUDIO'],
    systemInstruction: systemPrompt({ persona, lang }),
    tools: [{ functionDeclarations: toolDeclarations({ asyncTools }) }],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    // Audio+video sessions are short without compression; the talk is 5 min.
    contextWindowCompression: { slidingWindow: {} },
    realtimeInputConfig: {
      automaticActivityDetection: { silenceDurationMs: 700 },
    },
  };
}
