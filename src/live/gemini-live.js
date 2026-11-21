// "Tell Ayu" with the Gemini Live API (bidirectional WebSocket via @google/genai).
// Loaded with import() only after /api/health says live listening is on, so the
// SDK chunk stays off phones that never use it (vite.config.js keeps it out of the precache).
//
// 1. Ask our server for a one-use ephemeral token (the API key stays there); the
//    server builds the prompt from her cleaned profile and locks it into the token.
// 2. Connect; stream mic PCM (16 kHz) and, while her camera is on, JPEG frames (≤1 fps).
// 3. Play Ayu's short replies (24 kHz); pass on both transcriptions.
// 4. record_symptom / finish_talk are handled locally (shared/talk-state.js).
//    The model never decides a level: the app runs the fixed rules after she confirms.
// 5. Stop: no more audio, a note to the model, ≤4 s for its last record_symptom
//    calls, then close. finish_talk, the 3-minute limit and a lost connection end it too.
// 6. If the socket drops mid-talk, get a new token and reconnect (twice at most).
//
// Events (engine.on):
//   status   {status: 'connecting'|'live'|'reconnecting'|'wrapping'|'failed', reason?}
//            reason (failed): 'no-key'|'pass'|'busy'|'cap'|'token'|'offline'|'server'|'connect'|'socket'|'mic'
//   her      {text}            everything she has said so far (input transcription)
//   ayu      {text}            what Ayu is saying in the current turn (output transcription)
//   level    {rms}             her mic level, ~10×/s
//   speaking {on}              Ayu's voice is playing
//   tick     {secs}            session clock, every second while open
//   noted    {symptoms, signs} what Ayu recorded (deduped, in order)
//   finish   {by: 'model'|'stop'|'timeout'|'drop', heard, symptoms, signs}   exactly once

import { GoogleGenAI } from '@google/genai';
import { AUDIO_IN, AUDIO_OUT, TELL_SECONDS, TELL_NUDGE_AT, openingNudge, tappedNudge, STOP_NUDGE, TIME_NUDGE, CAMERA_ON_NUDGE, CAMERA_OFF_NUDGE } from '../../shared/live-config.js';
import { createTellState, appendHeard, recordedSigns, resumeText, tapAnswer, checkLeft } from '../../shared/talk-state.js';
import { startMic, createPlayer, startFrames } from './audio.js';
import { liveServerUrl, pagePass } from './server.js';
import { runToolCalls } from './tool-flow.js';

/** After stop: how long the model gets for its last record_symptom calls. */
export const WRAP_MS = 4000;
/** After finish_talk: let Ayu finish her closing line, at most this long. */
const CLOSE_LINE_MS = 6000;
const MAX_RECONNECTS = 2;
/**
 * Watchdog for a stuck turn: Gemini's voice detection sometimes stops hearing her after a
 * very short first reply that cut across Ayu's greeting (seen 21 Nov on a phone and in tests).
 * If the phone hears her speak for a while and Gemini shows no sign of hearing it within a few
 * seconds, the session is restarted (new token, same talk: resumeText tells Ayu what was said).
 * Closing only the audio stream (audioStreamEnd) was tried first and did not unstick it.
 */
const SPEECH_RMS = 0.012;
const SPEECH_TICKS = 6; // ~0.6 s of her voice
const STUCK_MS = 3500;
const DEBUG = (() => {
  try {
    return localStorage.getItem('ayu:debug') === '1';
  } catch {
    return false;
  }
})();

const failure = (reason, message) => Object.assign(new Error(message || reason), { reason });

/**
 * @param {{profile: object, lang?: string}} opts  profile: {name, stage, weeks?, daysAfterBirth?, village?}
 */
export function createGeminiTalk({ profile, lang = 'en', check = null, intro = null }) {
  const listeners = new Set();
  const emit = (e) => listeners.forEach((fn) => fn(e));
  const state = createTellState({ stage: profile?.stage, check });
  /** The whole talk, turn by turn (for the research record): {who: 'her'|'ayu'|'app', text, at}. */
  const turns = [];
  let camUsed = false;
  let loudTicks = 0;
  let spokeAt = 0; // when the phone last heard her speak (above the watchdog's floor)
  let heardAt = 0; // when Gemini last showed it heard her (voice activity or transcription)
  let ayuSpeaking = false;
  let ayuAudioAt = 0; // last chunk of Ayu's voice from Gemini
  let kicks = 0;
  let lastKick = 0;
  const turn = (who, text) => {
    const last = turns[turns.length - 1];
    if (last && last.who === who && who !== 'app') last.text += text;
    else turns.push({ who, text, at: Date.now() });
  };

  let session = null;
  let mic = null;
  let player = null;
  let stopFrames = null;
  let cam = null;
  let given = null; // the mic stream from her tap: stopped on every exit, even before the mic starts
  let open = false;
  let closedByUs = false;
  let reconnects = 0;
  let muted = false; // no more mic audio to the model
  let userMuted = false; // she turned her mic off for a moment
  let silent = false; // no more Ayu audio to her
  let wrapping = null; // 'stop' | 'timeout' while waiting for the last tool calls
  let finished = false;
  let heard = '';
  let ayuText = '';
  let lastWho = null;
  let secs = 0;
  let clock = null;
  let wrapTimer = null;
  let closeTimer = null;

  const send = (input) => {
    if (DEBUG) console.log('[ayu-send]', JSON.stringify(input).slice(0, 200));
    if (!open || !session) return;
    try {
      session.sendRealtimeInput(input);
    } catch {
      // socket closing — the close handler reports it
    }
  };

  async function token() {
    let res;
    try {
      res = await fetch(`${liveServerUrl()}/api/live-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Talk-Pass': await pagePass() },
        body: JSON.stringify({ profile, lang, ...(check ? { check } : {}) }),
      });
    } catch {
      throw failure(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'server');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw failure(body.reason || (res.status === 503 ? 'no-key' : 'token'), body.error);
    }
    return res.json();
  }

  /** @param {{stream?: MediaStream}} opts  her mic, already granted from her tap */
  async function start({ stream } = {}) {
    given = stream || null;
    emit({ type: 'status', status: 'connecting' });
    try {
      const t = await token();
      if (closedByUs) return;
      try {
        mic = await startMic({
          targetRate: AUDIO_IN.sampleRate,
          stream,
          onChunk: (data) => {
            if (!muted && !userMuted) send({ audio: { data, mimeType: AUDIO_IN.mimeType } });
          },
          onLevel: (rms) => {
            emit({ type: 'level', rms: muted || userMuted ? 0 : rms });
            watch(rms);
          },
        });
      } catch {
        throw failure('mic');
      }
      if (closedByUs) return cleanup();
      // One AudioContext for mic and speaker: on iPhones a second context can silence the mic.
      player = createPlayer(AUDIO_OUT.sampleRate, { ctx: mic.ctx, onSpeaking: (on) => {
          ayuSpeaking = on;
          emit({ type: 'speaking', on });
        } });
      try {
        await connect(t);
      } catch {
        throw failure('connect');
      }
      if (closedByUs) return;
      // Ayu speaks first, in her language.
      send({ text: openingNudge(lang, Boolean(check), intro) });
      if (cam) send({ text: CAMERA_ON_NUDGE });
    } catch (err) {
      if (closedByUs) return;
      closedByUs = true;
      cleanup();
      emit({ type: 'status', status: 'failed', reason: err?.reason || 'connect' });
    }
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
        },
        onmessage: onMessage,
        onerror: () => {},
        onclose: (e) => {
          if (s && session !== s) return; // an old socket closing after a reconnect
          open = false;
          if (closedByUs || finished) return;
          if (wrapping) return finish(wrapping);
          if (reconnects < MAX_RECONNECTS) return reconnect(e?.reason || 'closed');
          dropped();
        },
      },
    });
    if (closedByUs) {
      s.close();
      return;
    }
    session = s;
    open = true;
    startClock();
    emit({ type: 'status', status: 'live' });
  }

  function startClock() {
    if (clock) return;
    clock = setInterval(() => {
      secs++;
      emit({ type: 'tick', secs });
      if (secs === TELL_NUDGE_AT) send({ text: TIME_NUDGE });
      // Wrap early enough that Heard shows by 5:00 even if the model uses its whole grace.
      if (secs >= TELL_SECONDS - WRAP_MS / 1000) wrap('timeout');
    }, 1000);
  }

  /** The socket dropped mid-talk: new token, new session, same state. */
  async function reconnect() {
    reconnects++;
    emit({ type: 'status', status: 'reconnecting', attempt: reconnects });
    player?.stop();
    try {
      await new Promise((r) => setTimeout(r, 600 * reconnects));
      if (closedByUs || finished) return;
      const t = await token();
      if (closedByUs || finished) return;
      await connect(t);
      send({ text: resumeText(state, heard) });
    } catch {
      if (!closedByUs && !finished) dropped();
    }
  }

  /** Gone for good: keep what she said if there is anything, else say it failed. */
  function dropped() {
    if (heard.trim() || state.symptoms.length) return finish('drop');
    closedByUs = true;
    cleanup();
    emit({ type: 'status', status: 'failed', reason: 'socket' });
  }

  /** See SPEECH_RMS above. */
  function watch(rms) {
    // Not while Ayu is talking (her own voice could leak into the mic): judged by Gemini's audio, not the speaker.
    if (!open || muted || userMuted || finished || wrapping || Date.now() - ayuAudioAt < 1500) {
      loudTicks = 0;
      return;
    }
    const now = Date.now();
    if (rms > SPEECH_RMS) {
      loudTicks++;
      if (loudTicks >= SPEECH_TICKS && !spokeAt) spokeAt = now;
      return;
    }
    loudTicks = 0;
    if (spokeAt && heardAt < spokeAt && now - spokeAt > STUCK_MS && now - lastKick > 8000 && kicks < 3) {
      lastKick = now;
      spokeAt = 0;
      kicks++;
      if (DEBUG) console.log('[ayu-watchdog] she spoke but Gemini did not hear: restarting the session');
      turn('app', 'watchdog: session restarted');
      restart();
    } else if (spokeAt && heardAt >= spokeAt) spokeAt = 0;
  }

  /** A fresh session for the same talk (the old socket's close is ignored). */
  function restart() {
    const old = session;
    session = null;
    open = false;
    try {
      old?.close();
    } catch {
      // already closed
    }
    reconnects = Math.max(0, reconnects - 1); // a stall restart does not use up the drop budget
    reconnect('stall');
  }

  function onMessage(msg) {
    if (msg.voiceActivity || msg.serverContent?.inputTranscription) heardAt = Date.now();
    // Debugging on a phone: localStorage['ayu:debug'] = '1' logs every message from Gemini.
    if (DEBUG) console.log('[ayu-live]', JSON.stringify(msg).slice(0, 600));
    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) player?.stop();
      if (!silent) {
        for (const part of sc.modelTurn?.parts || []) {
          if (part.inlineData?.data) {
            ayuAudioAt = Date.now();
            player?.play(part.inlineData.data);
          }
        }
      }
      if (sc.inputTranscription?.text && !finished) {
        heard = appendHeard(heard, sc.inputTranscription.text, lastWho !== 'her');
        turn('her', sc.inputTranscription.text);
        lastWho = 'her';
        emit({ type: 'her', text: heard });
      }
      // A finished model turn: the next caption starts fresh (one turn on screen at a time).
      if (sc.turnComplete && lastWho === 'ayu') lastWho = null;
      if (sc.outputTranscription?.text && !silent) {
        if (lastWho !== 'ayu') ayuText = '';
        ayuText += sc.outputTranscription.text;
        turn('ayu', sc.outputTranscription.text);
        lastWho = 'ayu';
        emit({ type: 'ayu', text: ayuText.replace(/\s+/g, ' ').trim() });
      }
    }
    if (msg.toolCall?.functionCalls?.length) onToolCalls(msg.toolCall.functionCalls);
  }

  function onToolCalls(calls) {
    const { events, functionResponses } = runToolCalls(state, calls);
    // Answer first, so the model is never left waiting, then act on the calls.
    if (open && functionResponses.length) {
      try {
        session?.sendToolResponse({ functionResponses });
      } catch {
        // closing
      }
    }
    for (const e of events) {
      if (e.type === 'finish') finish(wrapping || 'model');
      else emit(e);
    }
  }

  /** She pressed stop, or time is up: no more audio, the model notes what is left, then we close. */
  function wrap(by) {
    if (wrapping || finished) return;
    wrapping = by;
    muted = true;
    silent = true;
    player?.stop();
    mic?.setMuted(true);
    emit({ type: 'status', status: 'wrapping', by });
    if (!open) return finish(by);
    send({ audioStreamEnd: true });
    send({ text: STOP_NUDGE });
    wrapTimer = setTimeout(() => finish(by), WRAP_MS);
  }

  function finish(by) {
    if (finished) return;
    finished = true;
    muted = true;
    mic?.setMuted(true);
    clearTimeout(wrapTimer);
    clearInterval(clock);
    clock = null;
    emit({
      type: 'finish',
      by,
      heard: heard.trim(),
      symptoms: state.symptoms.map((x) => ({ ...x })),
      signs: recordedSigns(state),
      answers: state.check ? { ...state.check.answers } : null,
      turns: turns.map((x) => ({ ...x, text: x.text.replace(/\s+/g, ' ').trim() })),
      secs,
      camera: camUsed,
    });
    // Ayu's closing line may still be playing: let it end, then close.
    const t0 = Date.now();
    const tick = () => {
      if (closedByUs) return;
      if (player?.speaking && Date.now() - t0 < CLOSE_LINE_MS) closeTimer = setTimeout(tick, 200);
      else end();
    };
    if (by === 'model') tick();
    else end();
  }

  function cleanup() {
    clearTimeout(wrapTimer);
    clearTimeout(closeTimer);
    clearInterval(clock);
    clock = null;
    stopFrames?.();
    stopFrames = null;
    mic?.stop();
    mic = null;
    given?.getTracks().forEach((tr) => tr.stop());
    given = null;
    player?.close();
    player = null;
  }

  /** Close everything now (cancel, unmount, after finish). Safe to call twice. */
  function end() {
    closedByUs = true;
    try {
      if (open) session?.sendRealtimeInput({ audioStreamEnd: true });
    } catch {
      // socket already closed
    }
    open = false;
    try {
      session?.close();
    } catch {
      // already closed
    }
    session = null;
    cleanup();
  }

  /** Her camera on (MediaStream) or off (null). Frames ≤1 fps only while on. */
  function setCamera(stream) {
    const was = Boolean(cam);
    cam = stream || null;
    if (cam) camUsed = true;
    stopFrames?.();
    stopFrames = cam && !finished ? startFrames(cam, (data) => send({ video: { data, mimeType: 'image/jpeg' } })) : null;
    if (!was && cam) send({ text: CAMERA_ON_NUDGE });
    if (was && !cam) send({ text: CAMERA_OFF_NUDGE });
  }

  return {
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    start,
    /** "Stop and send". */
    stop: () => wrap('stop'),
    setCamera,
    /** She tapped an answer on the card: save it and tell Ayu, who goes on to the next question. */
    /** What was said so far (for a record when the call is cancelled or fails). */
    snapshot() {
      return { turns: turns.map((x) => ({ ...x, text: x.text.replace(/\s+/g, ' ').trim() })), secs, camera: camUsed, answers: state.check ? { ...state.check.answers } : null, signs: recordedSigns(state) };
    },
    tap(qid, oid, qText, oText) {
      const out = tapAnswer(state, qid, oid);
      if (!out.answer) return;
      turn('app', `tapped ${qid}=${oid}`);
      emit({ type: 'answer', ...out.answer, by: 'tap' });
      send({ text: tappedNudge(qText, oText, checkLeft(state)) });
    },
    /** Her own mic switch during the talk (nothing is sent while off). */
    setMuted(on) {
      userMuted = Boolean(on);
    },
    end,
  };
}
