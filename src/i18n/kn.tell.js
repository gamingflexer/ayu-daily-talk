// Tell Ayu words (Kannada). Draft translation — needs review by a native speaker before any field use.
export default {
  // Top line while a session is open: real time since Ayu started listening.
  listening: 'ಕೇಳುತ್ತಿದೆ · {time}',
  speaking: 'Ayu ಮಾತಾಡುತ್ತಿದೆ · {time}',
  meta: {
    idle: 'Ayu ಗೆ ಹೇಳಿ',
    mic: 'ಮೈಕ್',
    connecting: 'ಸಂಪರ್ಕ ಆಗುತ್ತಿದೆ',
    reconnecting: 'ಮತ್ತೆ ಸಂಪರ್ಕ ಆಗುತ್ತಿದೆ',
    wrapping: 'ಬರೆದುಕೊಳ್ಳುತ್ತಿದೆ',
    failed: 'ಕೇಳುತ್ತಿಲ್ಲ',
  },
  // The grey line under the button, before her words arrive.
  hint: {
    idle: 'ಮಾತಾಡಲು ಒತ್ತಿ',
    mic: 'Ayu ನಿಮ್ಮ ಮಾತು ಕೇಳಲು ಮೈಕ್‌ಗೆ ಅನುಮತಿ ಕೊಡಿ…',
    connecting: 'Ayu ಜೊತೆ ಸಂಪರ್ಕ ಆಗುತ್ತಿದೆ…',
    start: 'ಹೇಗಿದೆ ಅಂತ ಹೇಳಿ. Ayu ನಿಮ್ಮ ಜೊತೆ ಮಾತಾಡುತ್ತದೆ.',
    reconnecting: 'ಸಂಪರ್ಕ ತಪ್ಪಿತು — ಮತ್ತೆ ಸಂಪರ್ಕ ಆಗುತ್ತಿದೆ…',
    wrapping: 'ನೀವು ಹೇಳಿದ್ದನ್ನು ಬರೆದುಕೊಳ್ಳುತ್ತಿದೆ…',
  },
  // One plain line when Ayu can't listen; the quick taps below still work.
  fail: {
    mic: 'Ayu ಗೆ ನಿಮ್ಮ ಮಾತು ಕೇಳುತ್ತಿಲ್ಲ — ಮೈಕ್ ಬಂದ್ ಆಗಿದೆ. ನಿಮಗೆ ಏನು ಅನಿಸುತ್ತಿದೆ ಅದನ್ನು ಒತ್ತಿ.',
    offline: 'ಇಂಟರ್ನೆಟ್ ಇಲ್ಲ, ಹಾಗಾಗಿ Ayu ಕೇಳಲು ಆಗುವುದಿಲ್ಲ. ನಿಮಗೆ ಏನು ಅನಿಸುತ್ತಿದೆ ಅದನ್ನು ಒತ್ತಿ.',
    other: 'Ayu ಗೆ ಈಗ ಕೇಳಲು ಆಗುತ್ತಿಲ್ಲ. ನಿಮಗೆ ಏನು ಅನಿಸುತ್ತಿದೆ ಅದನ್ನು ಒತ್ತಿ.',
  },
  tapToSpeak: 'ಮಾತಾಡಲು ಒತ್ತಿ',
  tryAgain: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
  stop: 'ಮಾತು ಮುಗಿಸಿ ನೋಡಿ',
  cancel: 'ಬೇಡ',
  orTap: 'ಅಥವಾ ಒಂದನ್ನು ಒತ್ತಿ',
  camera: {
    on: 'Ayu ಗೆ ಕ್ಯಾಮೆರಾದಲ್ಲಿ ತೋರಿಸಿ',
    off: 'ಕ್ಯಾಮೆರಾ ಬಂದ್ ಮಾಡಿ',
    flip: 'ಕ್ಯಾಮೆರಾ ಬದಲಿಸಿ',
    notice: 'ಇದನ್ನು Ayu ಮಾತ್ರ ನೋಡುತ್ತದೆ. ಏನೂ ಉಳಿಸುವುದಿಲ್ಲ.',
    failed: 'ಕ್ಯಾಮೆರಾ ಶುರು ಆಗಲಿಲ್ಲ. ನೀವು ಮಾತಾಡುತ್ತಾ ಇರಬಹುದು.',
  },
  call: {
    camera: 'ಕ್ಯಾಮೆರಾ',
    flip: 'ತಿರುಗಿಸಿ',
    mute: 'ಮೈಕ್ ಆಫ್',
    unmute: 'ಮೈಕ್ ಆನ್',
    mutedLine: 'ಮೈಕ್ ಆಫ್ ಆಗಿದೆ — Ayu ಗೆ ನಿಮ್ಮ ಮಾತು ಕೇಳಿಸುವುದಿಲ್ಲ.',
  },
  heard: {
    meta: 'ನೀವು ಹೇಳಿದ್ದು',
    understood: 'ನನಗೆ ಅರ್ಥ ಆಗಿದ್ದು — ತಪ್ಪು ಇದ್ದರೆ ಒತ್ತಿ ತೆಗೆಯಿರಿ',
    yes: 'ಹೌದು, ಸರಿ',
    again: 'ಮತ್ತೆ ಹೇಳಿ',
    nothing: 'ಅದರಿಂದ ನನಗೆ ಏನೂ ಬರೆದುಕೊಳ್ಳಲು ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳಿ, ಅಥವಾ ನಿಮಗೆ ಏನು ಅನಿಸುತ್ತಿದೆ ಅದನ್ನು ಒತ್ತಿ.',
    sendWords: 'ನನ್ನ ಮಾತು ಇದ್ದ ಹಾಗೆಯೇ ಕಳಿಸಿ',
  },
};
