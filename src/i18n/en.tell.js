// Tell Ayu words (English). Keys live under `tell.` in the dictionary.
// Listening and Heard follow Vrindar's boards ("5 · Tell Ayu — listening" and the
// prototype's Heard state); the camera lines and the honest state lines are ours.
export default {
  // Top line while a session is open: real time since Ayu started listening.
  listening: 'Listening · {time}',
  speaking: 'Ayu is speaking · {time}',
  meta: {
    idle: 'Tell Ayu',
    mic: 'Microphone',
    connecting: 'Connecting',
    reconnecting: 'Reconnecting',
    wrapping: 'Noting it down',
    failed: 'Not listening',
  },
  // The grey line under the button, before her words arrive.
  hint: {
    idle: 'Tap to speak',
    mic: 'Allow the microphone so Ayu can hear you…',
    connecting: 'Connecting to Ayu…',
    start: 'Say how you feel. Ayu talks with you.',
    reconnecting: 'The connection dropped — reconnecting…',
    wrapping: 'Noting what you said…',
  },
  // One plain line when Ayu can't listen; the quick taps below still work.
  fail: {
    mic: 'Ayu can’t hear you — the microphone is off. Tap what you feel.',
    offline: 'No internet, so Ayu can’t listen. Tap what you feel.',
    other: 'Ayu can’t listen right now. Tap what you feel.',
  },
  tapToSpeak: 'Tap to speak',
  tryAgain: 'Try again',
  stop: 'End the talk and check',
  cancel: 'Cancel',
  orTap: 'Or tap one',
  camera: {
    on: 'Show Ayu on camera',
    off: 'Turn camera off',
    flip: 'Switch camera',
    notice: 'Only Ayu sees this. Nothing is saved.',
    failed: 'The camera didn’t start. You can keep talking.',
  },
  // Today's check, asked by Ayu on the call.
  check: {
    byTap: 'Answer by tapping instead',
  },
  // The call controls while she talks with Ayu.
  call: {
    camera: 'Camera',
    flip: 'Turn',
    mute: 'Mic off',
    unmute: 'Mic on',
    mutedLine: 'Your mic is off — Ayu can’t hear you.',
  },
  heard: {
    meta: 'You said',
    understood: 'I understood — tap to remove anything wrong',
    yes: 'Yes, that’s right',
    again: 'Say it again',
    nothing: 'I couldn’t note anything from that. Say it again, or tap what you feel.',
    sendWords: 'Send my words as they are',
  },
};
