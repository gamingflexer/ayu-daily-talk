// Live talk with the Gemini Live API (bidirectional WebSocket via @google/genai).
//
// 1. Ask our server for a one-use ephemeral token (the API key stays there).
// 2. Connect with the token; stream mic PCM (16 kHz) and, if she turns the
//    camera on (or taps "Not sure"), JPEG frames (≤1 fps).
// 3. Play Ayu's audio (24 kHz), show both captions, and turn tool calls into
//    question cards. Red-flag rules run locally (shared/red-flags.js).
//
// Emits the same events as mock-live.js, so the screens don't care which runs:
//   status · info · caption · turn-complete · card · tool · tool-cancel ·
//   referral · plan · finish · level · camera-turn

import { GoogleGenAI } from '@google/genai';
import { AUDIO_IN, AUDIO_OUT, openingNudge } from '../../shared/live-config.js';
import {
  createTalkState,
  handleTool,
  recordAnswer,
  answerText,
  cameraTurnText,
  referral,
} from '../../shared/talk-state.js';
import { startMic, createPlayer, startFrames } from './audio.js';
import { liveServerUrl } from './server.js';

const CARD_TOOLS = new Set(['ask_yes_no', 'ask_single_choice', 'ask_multi_choice', 'ask_photo']);
export const TALK_SECONDS = 300;

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
  let open = false;
  let camOn = false;
  const nudged = new Set();
  const cards = new Map();
  let asyncTools = true;

  const send = (input) => {
    if (!open || !session) return;
    try {
      session.sendRealtimeInput(input);
    } catch {
      // socket closing — the close handler reports it
    }
  };

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

    // Mic first: if she refuses the mic there is no point opening the socket.
    mic = await startMic({
      targetRate: AUDIO_IN.sampleRate,
      onChunk: (data) => {
        if (!paused) send({ audio: { data, mimeType: AUDIO_IN.mimeType } });
      },
      onLevel: (rms) => emit({ type: 'level', rms }),
    });

    player = createPlayer(AUDIO_OUT.sampleRate);
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion } });
    session = await ai.live.connect({
      model,
      config,
      callbacks: {
        onopen: () => {
          open = true;
          emit({ type: 'status', status: 'live' });
        },
        onmessage: onMessage,
        onerror: (e) => emit({ type: 'status', status: 'error', detail: e?.message || 'connection error', unexpected: !closedByUs }),
        onclose: (e) => {
          open = false;
          emit({ type: 'status', status: 'ended', detail: closedByUs ? '' : e?.reason || 'closed', unexpected: !closedByUs && !state.finished });
          cleanup();
        },
      },
    });
    open = true;
    // Ayu speaks first, in her language.
    send({ text: openingNudge(lang) });
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
        out.card.callId = call.id;
        cards.set(out.card.id, out.card);
        emit({ type: 'card', card: out.card });
      }
      if (out.referral) emit({ type: 'referral', referral: out.referral });
      if (out.plan) emit({ type: 'plan', plan: out.plan });
      if (out.finish) emit({ type: 'finish', ...out.finish });
      const fr = { id: call.id, name: call.name, response: out.response };
      // Card tools are non-blocking: acknowledge silently so the voice keeps going.
      if (asyncTools && CARD_TOOLS.has(call.name)) fr.scheduling = 'SILENT';
      functionResponses.push(fr);
    }
    if (open) {
      try {
        session?.sendToolResponse({ functionResponses });
      } catch {
        // closing
      }
    }
  }

  function cleanup() {
    stopFrames?.();
    stopFrames = null;
    mic?.stop();
    mic = null;
    player?.close();
    player = null;
  }

  function setCamera(stream) {
    stopFrames?.();
    stopFrames = stream ? startFrames(stream, (data) => send({ video: { data, mimeType: 'image/jpeg' } })) : null;
  }

  /** Finish from our side (she pressed ✕, time ran out, or the socket dropped). */
  function finishLocal(by = 'app') {
    if (state.finished) return;
    const out = handleTool(state, 'finish_talk', { by });
    emit({ type: 'finish', ...out.finish });
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
    answer(cardId, answer, labels, meta = {}) {
      const card = cards.get(cardId);
      if (!card) return;
      const r = recordAnswer(state, card, answer, meta);
      emit({ type: 'referral', referral: r });
      send({ text: answerText(card, answer, labels, meta) });
    },
    /** "Not sure" → camera turn: her back camera streams to the model, Ayu says what it sees. */
    startCameraTurn(cardId, stream, purpose) {
      const card = cards.get(cardId) || null;
      if (card) emit({ type: 'referral', referral: recordAnswer(state, card, 'not_sure', { via: 'camera' }) });
      state.photos.push({ purpose, kind: 'video', at: Date.now() });
      camOn = true;
      setCamera(stream);
      send({ text: cameraTurnText(card, purpose) });
      emit({ type: 'camera-turn', on: true, purpose });
    },
    endCameraTurn() {
      if (!camOn) return;
      camOn = false;
      setCamera(null);
      send({ text: '[She turned the camera off.]' });
      emit({ type: 'camera-turn', on: false });
    },
    /** A still photo she took for an ask_photo card (JPEG base64). */
    sendPhoto(b64, purpose) {
      state.photos.push({ purpose, kind: 'photo', at: Date.now() });
      send({ video: { data: b64, mimeType: 'image/jpeg' } });
      send({ text: `[She sent a photo of: ${purpose}. Read it and ask her to confirm.]` });
    },
    /** Her front camera on (MediaStream) or off (null). */
    setCamera,
    /** Called every second by the talk clock: the 5-minute limit. */
    timeCheck(secs) {
      if (secs >= TALK_SECONDS - 30 && !nudged.has('nearly')) {
        nudged.add('nearly');
        send({ text: '[Time is nearly up: 30 seconds left. Start wrapping up.]' });
      }
      if (secs >= TALK_SECONDS && !nudged.has('up')) {
        nudged.add('up');
        send({ text: '[Time is up. Call red_flag_check and finish_talk now.]' });
      }
      if (secs >= TALK_SECONDS + 40) finishLocal('timeout');
    },
    finishLocal,
    pause(v) {
      paused = v;
      mic?.setMuted(v);
      if (v) player?.stop();
    },
    get speaking() {
      return Boolean(player?.speaking);
    },
    referral: () => referral(state),
    end() {
      closedByUs = true;
      try {
        if (open) session?.sendRealtimeInput({ audioStreamEnd: true });
      } catch {
        // socket already closed
      }
      open = false;
      session?.close();
      cleanup();
    },
  };
}
