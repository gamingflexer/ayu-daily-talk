// Tell Ayu words (Tamil). Draft translation of en.tell.js for native review before field use.
export default {
  // Top line while a session is open: real time since Ayu started listening.
  listening: 'கேட்டுட்டு இருக்கேன் · {time}',
  speaking: 'Ayu பேசுது · {time}',
  meta: {
    idle: 'Ayu-கிட்ட சொல்லுங்க',
    mic: 'மைக்',
    connecting: 'இணைக்குது',
    reconnecting: 'மறுபடி இணைக்குது',
    wrapping: 'குறிச்சுக்குது',
    failed: 'கேட்கலை',
  },
  // The grey line under the button, before her words arrive.
  hint: {
    idle: 'பேச தொடுங்க',
    mic: 'Ayu நீங்க பேசறதைக் கேட்க, மைக்கை அனுமதிங்க…',
    connecting: 'Ayu-வோட இணைக்குது…',
    start: 'எப்படி இருக்குன்னு சொல்லுங்க. Ayu உங்ககிட்ட பேசும்.',
    reconnecting: 'இணைப்பு போச்சு — மறுபடி இணைக்குது…',
    wrapping: 'நீங்க சொன்னதைக் குறிச்சுக்குது…',
  },
  // One plain line when Ayu can't listen; the quick taps below still work.
  fail: {
    mic: 'Ayu-க்கு கேட்கலை — மைக் அணைஞ்சிருக்கு. உங்களுக்கு இருக்கறதைத் தொடுங்க.',
    offline: 'இன்டர்நெட் இல்லை, அதனால Ayu கேட்க முடியாது. உங்களுக்கு இருக்கறதைத் தொடுங்க.',
    other: 'Ayu-வால இப்போ கேட்க முடியாது. உங்களுக்கு இருக்கறதைத் தொடுங்க.',
  },
  tapToSpeak: 'பேச தொடுங்க',
  tryAgain: 'மறுபடி முயற்சி',
  stop: 'பேச்சை முடிச்சு பாருங்க',
  cancel: 'வேண்டாம்',
  orTap: 'அல்லது ஒண்ணைத் தொடுங்க',
  camera: {
    on: 'Ayu-க்கு கேமராவுல காட்டுங்க',
    off: 'கேமராவை அணை',
    flip: 'கேமராவை மாத்து',
    notice: 'இதை Ayu மட்டும்தான் பார்க்கும். எதுவும் சேமிக்கப்படாது.',
    failed: 'கேமரா திறக்கலை. நீங்க தொடர்ந்து பேசலாம்.',
  },
  call: {
    camera: 'கேமரா',
    flip: 'திருப்பு',
    mute: 'மைக் ஆஃப்',
    unmute: 'மைக் ஆன்',
    mutedLine: 'மைக் ஆஃப்ல இருக்கு — Ayu-க்கு உங்க குரல் கேட்கலை.',
  },
  heard: {
    meta: 'நீங்க சொன்னது',
    understood: 'எனக்குப் புரிஞ்சது — தப்பா இருந்தா தொட்டு நீக்குங்க',
    yes: 'ஆமா, சரிதான்',
    again: 'மறுபடி சொல்லுங்க',
    nothing: 'அதுல இருந்து எதையும் குறிச்சுக்க முடியலை. மறுபடி சொல்லுங்க, அல்லது உங்களுக்கு இருக்கறதைத் தொடுங்க.',
    sendWords: 'நான் சொன்னதை அப்படியே அனுப்பு',
  },
};
