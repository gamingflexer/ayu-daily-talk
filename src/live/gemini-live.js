// Live talk with the Gemini Live API (bidirectional WebSocket via @google/genai).
//
// 1. Ask our server for a one-use ephemeral token (the API key stays there).
// 2. Connect with the token; stream mic PCM (16 kHz) and, while a camera is on,
//    JPEG frames (≤1 fps).
// 3. Play Ayu's audio (24 kHz), show both captions, and turn tool calls into
//    question cards. Red-flag rules run locally (shared/red-flags.js).
// 4. If the socket drops before the talk is done, get a new token and
//    reconnect (twice at most), telling Ayu what was already said.
//
// Emits the same events as mock-live.js, so the screens don't care which runs:
//   status (connecting · live · reconnecting · ended · error) · info · caption ·
//   turn-complete · card · tool · tool-cancel · referral · plan · finish ·
//   level (her mic) · out-level (Ayu's voice) · speaking · thinking ·
//   camera-turn · card-missing

import { GoogleGenAI } from '@google/genai';
import { AUDIO_IN, AUDIO_OUT, openingNudge } from '../../shared/live-config.js';
import { createTalkState, handleTool, recordAnswer, changeAnswer, answerText, changedText, cameraTurnText, referral } from '../../shared/talk-state.js';
import { startMic, createPlayer, startFrames } from './audio.js';
import { liveServerUrl, pagePass } from './server.js';
import { runToolCalls, looksLikeCardQuestion, lastQuestion, missingCardNudge } from './tool-flow.js';

export const TALK_SECONDS = 300;
/** Ayu asked a closed question aloud and no card came: wait this long, then nudge once. */
export const CARD_GRACE_MS = 3500;
/** Her words stopped coming in and Ayu has not answered yet → "Ayu is thinking…". */
const THINK_AFTER_MS = 900;
const MAX_RECONNECTS = 2;

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
  let reconnects = 0;
  const nudged = new Set();
  const cards = new Map();
  let asyncTools = true;

  // Turn tracking for the "question without a card" guard and the thinking state.
  let ayuText = '';
  let ayuTurns = 0;
  let cardThisTurn = false;
  let guardTimer = null;
  let thinkTimer = null;
  let replyStarted = false;

  const send = (input) => {
    if (!open || !session) return;
    try {
      session.sendRealtimeInput(input);
    } catch {
      // socket closing — the close handler reports it
    }
  };

  async function token() {
    const res = await fetch(`${liveServerUrl()}/api/live-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Talk-Pass': await pagePass() },
      body: JSON.stringify({ persona: persona.id, lang }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw Object.assign(new Error(body.error || `Token request failed (${res.status})`), { mock: body.mock });
    }
    return res.json();
  }

  /** @param {{stream?: MediaStream}} opts  audio stream already granted from her tap */
  async function start({ stream } = {}) {
    emit({ type: 'status', status: 'connecting' });
    const t = await token();
    asyncTools = t.config.tools?.[0]?.functionDeclarations?.some((f) => f.behavior === 'NON_BLOCKING') ?? false;
    emit({ type: 'info', model: t.model });

    // Mic first: if she refuses the mic there is no point opening the socket.
    mic = await startMic({
      targetRate: AUDIO_IN.sampleRate,
      stream,
      onChunk: (data) => {
        if (!paused) send({ audio: { data, mimeType: AUDIO_IN.mimeType } });
      },
      onLevel: (rms) => emit({ type: 'level', rms }),
    });
    player = createPlayer(AUDIO_OUT.sampleRate, {
      onSpeaking: (on) => emit({ type: 'speaking', on }),
      onLevel: (rms) => emit({ type: 'out-level', rms }),
    });
    await connect(t);
    // Ayu speaks first, in her language.
    send({ text: openingNudge(lang, persona) });
  }

  async function connect(t) {
    const ai = new GoogleGenAI({ apiKey: t.token, httpOptions: { apiVersion: t.apiVersion } });
    let s = null;
    s = await ai.live.connect({
      model: t.model,
      config: t.config,
      callbacks: {
        onopen: () => {
          open = true;
          emit({ type: 'status', status: 'live' });
        },
        onmessage: onMessage,
        onerror: (e) => emit({ type: 'status', status: 'error', detail: e?.message || 'connection error', unexpected: !closedByUs }),
        onclose: (e) => {
          if (s && session !== s) return; // an old socket closing after a reconnect
          open = false;
          if (!closedByUs && !state.finished && reconnects < MAX_RECONNECTS) {
            reconnect(e?.reason || 'closed');
            return;
          }
          emit({ type: 'status', status: 'ended', detail: closedByUs ? '' : e?.reason || 'closed', unexpected: !closedByUs && !state.finished });
          cleanup();
        },
      },
    });
    session = s;
    open = true;
  }

  /** The socket dropped mid-talk: new token, new session, same talk state. */
  async function reconnect(reason) {
    reconnects++;
    emit({ type: 'status', status: 'reconnecting', detail: reason, attempt: reconnects });
    player?.stop();
    try {
      await new Promise((r) => setTimeout(r, 600 * reconnects));
      if (closedByUs) return;
      const t = await token();
      if (closedByUs) return;
      await connect(t);
      send({ text: resumeText() });
    } catch (err) {
      emit({ type: 'status', status: 'ended', detail: err?.message || reason, unexpected: true });
      cleanup();
    }
  }

  function resumeText() {
    const said = state.answers
      .filter((a) => !a.changed)
      .slice(-8)
      .map((a) => `"${a.question}" → ${Array.isArray(a.answer) ? a.answer.join(', ') : a.label || a.answer}`)
      .join('; ');
    const words = state.symptoms.map((x) => `"${x.her_words}"`).join('; ');
    return `[The connection dropped for a moment and is back. Do not greet her again. Already answered: ${said || 'nothing yet'}. Her words so far: ${words || 'none'}. Say you are back in one short line and continue with the next question.]`;
  }

  function onMessage(msg) {
    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) player?.stop();
      for (const part of sc.modelTurn?.parts || []) {
        if (part.inlineData?.data) {
          replyStarted = true;
          clearTimeout(thinkTimer);
          player?.play(part.inlineData.data);
        }
      }
      if (sc.inputTranscription?.text) {
        emit({ type: 'caption', who: 'her', text: sc.inputTranscription.text, partial: true });
        // She is talking; when her words stop and no reply has started → thinking.
        replyStarted = false;
        clearTimeout(thinkTimer);
        thinkTimer = setTimeout(() => {
          if (!replyStarted && !player?.speaking) emit({ type: 'thinking', reason: 'her-turn' });
        }, THINK_AFTER_MS);
      }
      if (sc.outputTranscription?.text) {
        ayuText += sc.outputTranscription.text;
        emit({ type: 'caption', who: 'ayu', text: sc.outputTranscription.text, partial: true });
      }
      if (sc.turnComplete) {
        emit({ type: 'turn-complete' });
        endAyuTurn();
      }
    }
    if (msg.toolCall?.functionCalls?.length) onToolCalls(msg.toolCall.functionCalls);
    if (msg.toolCallCancellation?.ids) emit({ type: 'tool-cancel', ids: msg.toolCallCancellation.ids });
    if (msg.goAway) emit({ type: 'status', status: 'going-away', detail: msg.goAway.timeLeft });
  }

  /** Ayu's turn ended: if she asked a closed question aloud without a card, nudge once after a grace period. */
  function endAyuTurn() {
    const text = ayuText;
    const turn = ayuTurns++;
    const hadCard = cardThisTurn;
    ayuText = '';
    cardThisTurn = false;
    clearTimeout(guardTimer);
    if (hadCard || state.finished || !looksLikeCardQuestion(text, turn)) return;
    const q = lastQuestion(text);
    guardTimer = setTimeout(() => {
      if (cardThisTurn || state.finished) return;
      emit({ type: 'card-missing', question: q });
      send({ text: missingCardNudge(q) });
    }, CARD_GRACE_MS);
  }

  function onToolCalls(calls) {
    replyStarted = true;
    clearTimeout(thinkTimer);
    const { events, functionResponses, cards: newCards } = runToolCalls(state, calls, { asyncTools });
    for (const c of newCards) cards.set(c.id, c);
    if (newCards.length) {
      cardThisTurn = true;
      clearTimeout(guardTimer);
    }
    events.forEach(emit);
    if (open && functionResponses.length) {
      try {
        session?.sendToolResponse({ functionResponses });
      } catch {
        // closing
      }
    }
  }

  function cleanup() {
    clearTimeout(guardTimer);
    clearTimeout(thinkTimer);
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

  /** She answered: Ayu is now working on the reply. */
  const sent = (text) => {
    replyStarted = false;
    send({ text });
    emit({ type: 'thinking', reason: 'answer' });
  };

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
      sent(answerText(card, answer, labels, meta));
    },
    /** "Previous": she changed her answer to a card she already answered. */
    changeAnswer(cardId, answer, labels, meta = {}) {
      const card = cards.get(cardId);
      if (!card) return;
      const { before, referral: r } = changeAnswer(state, card, answer, meta);
      emit({ type: 'referral', referral: r });
      sent(changedText(card, before, Array.isArray(answer) ? answer : meta.label || labels?.[answer] || answer, meta));
    },
    /** "Not sure" → camera turn: her back camera streams to the model, Ayu says what it sees. */
    startCameraTurn(cardId, stream, purpose) {
      const card = cards.get(cardId) || null;
      if (card) emit({ type: 'referral', referral: recordAnswer(state, card, 'not_sure', { via: 'camera' }) });
      state.photos.push({ purpose, kind: 'video', at: Date.now() });
      camOn = true;
      setCamera(stream);
      sent(cameraTurnText(card, purpose));
      emit({ type: 'camera-turn', on: true, purpose });
    },
    endCameraTurn() {
      if (!camOn) return;
      camOn = false;
      send({ text: '[She turned the back camera off.]' });
      emit({ type: 'camera-turn', on: false });
    },
    /** A picture card: the app turned her back camera on by itself, so Ayu may look too. */
    cameraFor(purpose) {
      const what = purpose === 'skin_patch' ? 'the skin' : purpose === 'feet' ? 'her feet' : 'the medicine strip';
      send({ text: `[Her back camera is on now so you can see ${what}. She can also just tap a picture.]` });
    },
    /** A still photo she took for an ask_photo card (JPEG base64). */
    sendPhoto(b64, purpose) {
      state.photos.push({ purpose, kind: 'photo', at: Date.now() });
      send({ video: { data: b64, mimeType: 'image/jpeg' } });
      sent(`[She sent a photo of: ${purpose}. Read it and ask her to confirm.]`);
    },
    /** Her camera (front or back) on (MediaStream) or off (null): frames ≤1 fps only while on. */
    setCamera,
    /** Called every second by the talk clock: the 5-minute limit. */
    timeCheck(secs) {
      if (secs >= 180 && !nudged.has('two')) {
        nudged.add('two');
        send({ text: '[Time check: 2 minutes left. Skip the less important questions; go to the danger signs soon.]' });
      }
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
