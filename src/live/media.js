// Mic and camera for Tell Ayu, asked for inside her tap.
//
// iOS Safari only grants getUserMedia inside a user gesture. Home's "Tell Ayu"
// card calls beginTell() synchronously in its tap handler, before navigating;
// the Tell screen picks the promise up with takeTell(). Only the mic is asked
// for here; the camera is asked for when she taps the camera button.
// No SDK import here, so Home can import this file cheaply.

import { MIC_CONSTRAINTS } from './audio.js';

/** A started-but-never-picked-up mic is stopped after this long (no hidden live mic). */
const UNCLAIMED_MS = 15_000;
let pending = null;
let unclaimed = null;

/**
 * Ask for the mic now. The getUserMedia call happens before the first await, so a tap allows it.
 * @returns {Promise<{audio: MediaStream|null, error?: string}>}
 */
export function requestMic() {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
  if (!md?.getUserMedia) return Promise.resolve({ audio: null, error: 'unsupported' });
  return md.getUserMedia({ audio: MIC_CONSTRAINTS }).then(
    (audio) => ({ audio }),
    (err) => ({ audio: null, error: err?.name || 'error' }),
  );
}

/**
 * Call synchronously inside her tap on Home's "Tell Ayu" card, then navigate to /tell.
 * @returns {Promise<{audio: MediaStream|null, error?: string}>}
 */
export function beginTell() {
  dropPending();
  const p = requestMic();
  pending = p;
  unclaimed = setTimeout(() => {
    if (pending === p) dropPending();
  }, UNCLAIMED_MS);
  return p;
}

/** The mic promise started by the last tap, once (or null). */
export function takeTell() {
  const p = pending;
  pending = null;
  clearTimeout(unclaimed);
  return p;
}

function dropPending() {
  const p = pending;
  pending = null;
  clearTimeout(unclaimed);
  p?.then((m) => stopStream(m.audio));
}

/** One camera. Back ('environment') by default: it is for showing feet, skin or a medicine strip. */
export async function openCamera(facing = 'environment') {
  const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
  if (!md?.getUserMedia) throw Object.assign(new Error('no camera'), { name: 'NotFoundError' });
  return md.getUserMedia({
    video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 640 } },
    audio: false,
  });
}

export function stopStream(s) {
  s?.getTracks().forEach((t) => t.stop());
}
