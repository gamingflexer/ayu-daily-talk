// What the Tell Ayu screen shows, derived only from engine events. Pure, so it
// is tested in test/tool-flow.test.js.
//
//   idle → mic → connecting → listening ⇄ speaking
//   socket drop → reconnecting → listening
//   she presses stop / time is up → wrapping → heard
//   finish_talk → heard          start failed / dropped with nothing said → failed

export const PHASES = ['idle', 'mic', 'connecting', 'listening', 'speaking', 'reconnecting', 'wrapping', 'heard', 'failed'];

/** Phases while a session is open (the timer runs, the stop button works). */
export const LIVE_PHASES = new Set(['listening', 'speaking']);

export function nextPhase(phase, e) {
  // Only a new tap ("Say it again", "Try again") moves her off Heard or a failure.
  if (phase === 'heard' || phase === 'failed') return e.type === 'begin' ? 'mic' : phase;
  switch (e.type) {
    case 'begin':
      return 'mic';
    case 'status':
      if (e.status === 'connecting') return phase === 'reconnecting' ? phase : 'connecting';
      if (e.status === 'reconnecting') return 'reconnecting';
      if (e.status === 'live') return phase === 'wrapping' ? phase : 'listening';
      if (e.status === 'wrapping') return 'wrapping';
      if (e.status === 'failed') return 'failed';
      return phase;
    case 'speaking':
      if (phase === 'wrapping' || phase === 'reconnecting') return phase;
      if (e.on) return 'speaking';
      return phase === 'speaking' ? 'listening' : phase;
    case 'finish':
      return 'heard';
    default:
      return phase;
  }
}
