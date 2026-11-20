// Tell Ayu words (Malayalam). Draft translation — needs review by a native speaker before any field use.
export default {
  // Top line while a session is open: real time since Ayu started listening.
  listening: 'കേൾക്കുന്നു · {time}',
  speaking: 'Ayu സംസാരിക്കുന്നു · {time}',
  meta: {
    idle: 'Ayu-വിനോട് പറയൂ',
    mic: 'മൈക്ക്',
    connecting: 'ബന്ധിപ്പിക്കുന്നു',
    reconnecting: 'വീണ്ടും ബന്ധിപ്പിക്കുന്നു',
    wrapping: 'കുറിച്ചെടുക്കുന്നു',
    failed: 'കേൾക്കുന്നില്ല',
  },
  // The grey line under the button, before her words arrive.
  hint: {
    idle: 'സംസാരിക്കാൻ തൊടൂ',
    mic: 'Ayu-വിന് കേൾക്കാൻ മൈക്കിന് അനുവാദം കൊടുക്കൂ…',
    connecting: 'Ayu-വുമായി ബന്ധിപ്പിക്കുന്നു…',
    start: 'സംസാരിച്ചു തുടങ്ങൂ…',
    reconnecting: 'ബന്ധം മുറിഞ്ഞു — വീണ്ടും ബന്ധിപ്പിക്കുന്നു…',
    wrapping: 'നിങ്ങൾ പറഞ്ഞത് കുറിച്ചെടുക്കുന്നു…',
  },
  // One plain line when Ayu can't listen; the quick taps below still work.
  fail: {
    mic: 'Ayu-വിന് കേൾക്കാൻ പറ്റുന്നില്ല — മൈക്ക് അടച്ചിരിക്കുന്നു. നിങ്ങൾക്ക് തോന്നുന്നത് തൊടൂ.',
    offline: 'ഇന്റർനെറ്റ് ഇല്ല, അതുകൊണ്ട് Ayu-വിന് കേൾക്കാൻ പറ്റില്ല. നിങ്ങൾക്ക് തോന്നുന്നത് തൊടൂ.',
    other: 'Ayu-വിന് ഇപ്പോൾ കേൾക്കാൻ പറ്റുന്നില്ല. നിങ്ങൾക്ക് തോന്നുന്നത് തൊടൂ.',
  },
  tapToSpeak: 'സംസാരിക്കാൻ തൊടൂ',
  tryAgain: 'വീണ്ടും നോക്കൂ',
  stop: 'നിർത്തി അയയ്ക്കൂ',
  cancel: 'വേണ്ട',
  orTap: 'അല്ലെങ്കിൽ ഒന്ന് തൊടൂ',
  camera: {
    on: 'ക്യാമറയിൽ Ayu-വിന് കാണിക്കൂ',
    off: 'ക്യാമറ നിർത്തൂ',
    flip: 'ക്യാമറ മാറ്റൂ',
    notice: 'ഇത് Ayu മാത്രം കാണും. ഒന്നും സൂക്ഷിക്കില്ല.',
    failed: 'ക്യാമറ തുടങ്ങിയില്ല. നിങ്ങൾക്ക് സംസാരം തുടരാം.',
  },
  heard: {
    meta: 'നിങ്ങൾ പറഞ്ഞത്',
    understood: 'എനിക്ക് മനസ്സിലായത് — തെറ്റുള്ളത് തൊട്ട് മാറ്റൂ',
    yes: 'അതെ, ശരിയാണ്',
    again: 'വീണ്ടും പറയൂ',
    nothing: 'അതിൽ നിന്ന് എനിക്ക് ഒന്നും കുറിക്കാൻ പറ്റിയില്ല. വീണ്ടും പറയൂ, അല്ലെങ്കിൽ നിങ്ങൾക്ക് തോന്നുന്നത് തൊടൂ.',
    sendWords: 'എന്റെ വാക്കുകൾ അതുപോലെ അയയ്ക്കൂ',
  },
};
