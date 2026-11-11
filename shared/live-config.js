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

export const DEFAULT_MODEL = 'gemini-3.8-live';
export const API_VERSION = 'v1beta';

/** Audio formats the Live API expects / returns. */
export const AUDIO_IN = { sampleRate: 16000, mimeType: 'audio/pcm;rate=16000' };
export const AUDIO_OUT = { sampleRate: 24000 };

/** Pictures the UI can show for pick-the-picture answers (Om's rule 3). */
export const PICTURE_SETS = ['feet_swelling', 'baby_skin_colour', 'stool_colour', 'medicine_strip'];

export const PHOTO_PURPOSES = ['medicine_strip', 'skin_patch', 'feet', 'document'];

const LANG_NAME = { en: 'English', hi: 'Hindi', mr: 'Marathi' };

export function systemPrompt({ persona, lang = 'en' }) {
  return `You are Ayu, a calm health companion for pregnant women and new mothers in India.
You are on a daily 5-minute talk with the woman below. You can hear her; you can see her only if she turns her camera on.

${personaContext(persona)}

How to talk
- Speak ${LANG_NAME[lang] || 'her language'} by default. If she speaks another Indian language, switch to it. Short, simple sentences. One question at a time.
- Talk like a good Indian doctor taking a history: ask, wait, listen to her words, then offer 2–3 ways to describe it when she is unsure.
- Every question you ask MUST also be shown as a card with a tool:
  ask_yes_no, ask_single_choice or ask_multi_choice. Keep talking while the card is on screen; she may tap or speak.
- Always keep an honest way out: "Not sure" (yes/no) or "Something else" (choices).
- When words are unclear (swelling, yellow skin, stool colour, which tablet), use a picture_set so she can pick the picture that looks like hers.
- Ask for a photo (ask_photo) only of a medicine strip or box, a face-free patch of skin, her feet, or a document. Never ask for private body parts or her face.
- After she answers a symptom question, call record_symptom with her own words.
- After danger-sign questions, call red_flag_check. The fixed rules decide the referral, not you. Explain the result calmly in her language.
- If you are worried even though the rules said nothing, call add_referral. You can never cancel or lower a referral.
- When the talk is done (about 5 minutes), call finish_talk with what you noted.

Never
- Never diagnose or name a disease as certain. Say "this can be a sign of …, a check today will tell".
- Never tell her to stop, skip or change a medicine. If a medicine troubles her, give simple tips and say Ayu will ask the doctor.
- Never recommend a painkiller or any medicine.
- Never ask for her Aadhaar, bank details or OTP.
- Danger signs (bleeding, fits, severe headache with swelling or blurred vision, baby moving less, water leaking, high fever) always go through red_flag_check.

Start by greeting her by name in one line and asking how she is today.`;
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
        },
        required: ['question', 'options'],
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
