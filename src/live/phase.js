// The talk's visible state, derived only from engine events (both engines
// emit the same events). Pure, so it is tested in test/phase.test.js.
//
//   permissions → connecting → listening ⇄ speaking
//   her turn ends / she taps → thinking → speaking | card
//   red_flag_check → checking → speaking
//   socket drop → reconnecting → listening
//   finish → saving → ended          any → error

export const PHASES = ['ready', 'permissions', 'connecting', 'listening', 'speaking', 'thinking', 'checking', 'saving', 'reconnecting', 'ended', 'error'];

export function nextPhase(phase, e) {
  if (phase === 'saving' && e.type !== 'status') return phase;
  switch (e.type) {
    case 'status':
      if (e.status === 'connecting') return phase === 'reconnecting' ? phase : 'connecting';
      if (e.status === 'reconnecting') return 'reconnecting';
      if (e.status === 'live') return 'listening';
      if (e.status === 'error') return phase === 'saving' ? phase : 'error';
      if (e.status === 'ended') return phase === 'saving' ? 'saving' : e.unexpected ? 'error' : 'ended';
      return phase;
    case 'speaking':
      if (e.on) return 'speaking';
      return phase === 'speaking' ? 'listening' : phase;
    case 'thinking':
      return phase === 'speaking' ? phase : 'thinking';
    case 'tool':
      if (e.name === 'red_flag_check') return 'checking';
      return phase;
    case 'card':
      // A card is on screen: she can answer now.
      return phase === 'thinking' || phase === 'checking' ? 'listening' : phase;
    case 'finish':
      return 'saving';
    default:
      return phase;
  }
}
