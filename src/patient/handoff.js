// A daily check that started on the video call and must finish by tapping
// (the call ended before every question was answered). One hand-off at a time.
let pending = null;

/** @param {{answers: object, extraSigns: string[], turns?: object[]}} v */
export function handCheckOver(v) {
  pending = v;
}

export function takeCheckOver() {
  const v = pending;
  pending = null;
  return v;
}
