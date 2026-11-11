// Live talk with the Gemini Live API (bidirectional WebSocket via @google/genai).
//
// 1. Ask our server for a one-use ephemeral token (the API key stays there).
// 2. Connect with the token; stream mic PCM (16 kHz) and, if she turns the
//    camera on, JPEG frames (1 fps).
// 3. Play Ayu's audio (24 kHz), show both captions, and turn tool calls into
//    question cards. Red-flag rules run locally (shared/red-flags.js).
//
// Emits the same events as mock-live.js, so the screens don't care which runs.

import { GoogleGenAI } from '@google/genai';
import { AUDIO_IN, AUDIO_OUT } from '../../shared/live-config.js';
import { createTalkState, handleTool, recordAnswer, answerText, referral } from '../../shared/talk-state.js';
import { startMic, createPlayer, startFrames } from './audio.js';
import { liveServerUrl } from './server.js';

const CARD_TOOLS = new Set(['ask_yes_no', 'ask_single_choice', 'ask_multi_choice', 'ask_photo']);

export function createGeminiTalk({ persona, lang = 'en' }) {
  const listeners = new Set();
  const emit = (e) => listeners.forEach((fn) => fn(e));
  const state = createTalkState(persona);
  let session = null;
  let mic = null;
  let player = null;
  let stopFrames = null;
  let paused = false;
  let closedByUs = false;
  const cards = new Map();
  let asyncTools = true;

  async function start() {
    emit({ type: 'status', status: 'connecting' });
    const res = await fetch(`${liveServerUrl()}/api/live-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: persona.id, lang }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw Object.assign(new Error(body.error || `Token request failed (${res.status})`), { mock: body.mock });
    }
    const { token, model, apiVersion, config } = await res.json();
    asyncTools = config.tools?.[0]?.functionDeclarations?.some((f) => f.behavior === 'NON_BLOCKING') ?? false;
    emit({ type: 'info', model });

    player = createPlayer(AUDIO_OUT.sampleRate);
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion } });
    session = await ai.live.connect({
      model,
      config,
      callbacks: {
        onopen: () => emit({ type: 'status', status: 'live' }),
        onmessage: onMessage,
        onerror: (e) => emit({ type: 'status', status: 'error', detail: e?.message || 'connection error' }),
        onclose: (e) => {
          emit({ type: 'status', status: 'ended', detail: closedByUs ? '' : e?.reason || 'closed' });
          cleanup();
        },
      },
    });

    mic = await startMic({
      targetRate: AUDIO_IN.sampleRate,
      onChunk: (data) => {
        if (!paused) session?.sendRealtimeInput({ audio: { data, mimeType: AUDIO_IN.mimeType } });
      },
      onLevel: (rms) => emit({ type: 'level', rms }),
    });
    // Nudge Ayu to start (the prompt asks her to greet first).
    session.sendRealtimeInput({ text: '[The talk has started. Greet her.]' });
  }

  function onMessage(msg) {
    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) player?.stop();
      for (const part of sc.modelTurn?.parts || []) {
        if (part.inlineData?.data) player?.play(part.inlineData.data);
      }
      if (sc.inputTranscription?.text) emit({ type: 'caption', who: 'her', text: sc.inputTranscription.text, partial: true });
      if (sc.outputTranscription?.text) emit({ type: 'caption', who: 'ayu', text: sc.outputTranscription.text, partial: true });
      if (sc.turnComplete) emit({ type: 'turn-complete' });
    }
    if (msg.toolCall?.functionCalls?.length) onToolCalls(msg.toolCall.functionCalls);
    if (msg.toolCallCancellation?.ids) emit({ type: 'tool-cancel', ids: msg.toolCallCancellation.ids });
    if (msg.goAway) emit({ type: 'status', status: 'going-away', detail: msg.goAway.timeLeft });
  }

  function onToolCalls(calls) {
    const functionResponses = [];
    for (const call of calls) {
      const out = handleTool(state, call.name, call.args || {});
      emit({ type: 'tool', name: call.name, args: call.args, result: out.response });
      if (out.card) {
        cards.set(out.card.id, out.card);
        emit({ type: 'card', card: out.card });
      }
      if (out.referral) emit({ type: 'referral', referral: out.referral });
      if (out.finish) emit({ type: 'finish', ...out.finish });
      const fr = { id: call.id, name: call.name, response: out.response };
      // Card tools are non-blocking: acknowledge silently so the voice keeps going.
      if (asyncTools && CARD_TOOLS.has(call.name)) fr.scheduling = 'SILENT';
      functionResponses.push(fr);
    }
    session?.sendToolResponse({ functionResponses });
  }

  function cleanup() {
    stopFrames?.();
    stopFrames = null;
    mic?.stop();
    mic = null;
    player?.close();
    player = null;
  }

  return {
    mode: 'gemini',
    state,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    start,
    /** She tapped an answer on a card. */
    answer(cardId, answer, labels) {
      const card = cards.get(cardId);
      if (!card) return;
      const r = recordAnswer(state, card, answer);
      emit({ type: 'referral', referral: r });
      session?.sendRealtimeInput({ text: answerText(card, answer, labels) });
    },
    /** A photo she took for an ask_photo card (JPEG base64). */
    sendPhoto(b64, purpose) {
      state.photos.push({ purpose, at: Date.now() });
      session?.sendRealtimeInput({ video: { data: b64, mimeType: 'image/jpeg' } });
      session?.sendRealtimeInput({ text: `[She sent a photo of: ${purpose}. Read it and ask her to confirm.]` });
    },
    /** Turn her camera on (MediaStream) or off (null). */
    setCamera(stream) {
      stopFrames?.();
      stopFrames = stream
        ? startFrames(stream, (data) => session?.sendRealtimeInput({ video: { data, mimeType: 'image/jpeg' } }))
        : null;
    },
    pause(v) {
      paused = v;
      mic?.setMuted(v);
      if (v) player?.stop();
    },
    referral: () => referral(state),
    end() {
      closedByUs = true;
      try {
        session?.sendRealtimeInput({ audioStreamEnd: true });
      } catch {
        // socket already closed
      }
      session?.close();
      cleanup();
    },
  };
}
