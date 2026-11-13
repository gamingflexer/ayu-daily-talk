// Mic + front camera for the talk, asked for together from her tap.
//
// iOS Safari only grants getUserMedia inside a user gesture, so the tap on
// "Start talking" (Today) or "Start today's talk" (the talk screen) calls
// acquireTalkMedia() before navigating; the talk screen picks the streams up
// with takeTalkMedia(). One prompt for both. If the camera is refused or
// missing, the talk goes on voice-only.

import { MIC_CONSTRAINTS } from './audio.js';

const FRONT = { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } };
let pending = null;

/**
 * @returns {Promise<{audio: MediaStream|null, video: MediaStream|null, micError?: string, camError?: string}>}
 */
export async function acquireTalkMedia({ camera = true } = {}) {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
  if (!md?.getUserMedia) return ({ audio: null, video: null, micError: 'unsupported', camError: 'unsupported' });
  let both = null;
  let camError;
  if (camera) {
    try {
      both = await md.getUserMedia({ audio: MIC_CONSTRAINTS, video: FRONT });
    } catch (err) {
      camError = err?.name || 'error';
    }
  }
  if (both) {
    const audio = new MediaStream(both.getAudioTracks());
    const video = new MediaStream(both.getVideoTracks());
    return ({ audio, video });
  }
  // Camera refused or missing → ask for the mic alone (no second prompt if the mic was already allowed).
  try {
    const audio = await md.getUserMedia({ audio: MIC_CONSTRAINTS });
    return ({ audio, video: null, camError: camError || 'off' });
  } catch (err) {
    return ({ audio: null, video: null, micError: err?.name || 'error', camError: camError || 'off' });
  }
}

/** Ask for one camera (front or back). Throws if refused; the caller shows "Tap to turn on camera". */
export async function openCamera(facing = 'user') {
  const md = navigator.mediaDevices;
  if (!md?.getUserMedia) throw Object.assign(new Error('no camera'), { name: 'NotFoundError' });
  return md.getUserMedia({
    video: facing === 'user' ? FRONT : { facingMode: { ideal: 'environment' }, width: { ideal: 640 } },
    audio: false,
  });
}

/** Call synchronously inside her tap (the getUserMedia call happens before the first await). */
export function beginTalkMedia(opts) {
  pending = acquireTalkMedia(opts);
  return pending;
}

/** The promise started by the last tap, once (or null). */
export function takeTalkMedia() {
  const p = pending;
  pending = null;
  return p;
}

export function stopStream(s) {
  s?.getTracks().forEach((t) => t.stop());
}
