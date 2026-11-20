// Tell Ayu words (Telugu). Draft translation of en.tell.js for native review before field use.
export default {
  // Top line while a session is open: real time since Ayu started listening.
  listening: 'వింటున్నాను · {time}',
  speaking: 'Ayu మాట్లాడుతోంది · {time}',
  meta: {
    idle: 'Ayuకి చెప్పండి',
    mic: 'మైక్',
    connecting: 'కలుపుతోంది',
    reconnecting: 'మళ్ళీ కలుపుతోంది',
    wrapping: 'రాసుకుంటోంది',
    failed: 'వినడం లేదు',
  },
  // The grey line under the button, before her words arrive.
  hint: {
    idle: 'మాట్లాడటానికి నొక్కండి',
    mic: 'Ayu మీ మాట వినేలా మైక్‌కి అనుమతి ఇవ్వండి…',
    connecting: 'Ayuతో కలుపుతోంది…',
    start: 'ఎలా ఉందో చెప్పండి. Ayu మీతో మాట్లాడుతుంది.',
    reconnecting: 'లైన్ తెగిపోయింది — మళ్ళీ కలుపుతోంది…',
    wrapping: 'మీరు చెప్పింది రాసుకుంటోంది…',
  },
  // One plain line when Ayu can't listen; the quick taps below still work.
  fail: {
    mic: 'Ayuకి వినిపించడం లేదు — మైక్ ఆగి ఉంది. మీకు ఏమనిపిస్తోందో అది నొక్కండి.',
    offline: 'ఇంటర్నెట్ లేదు, అందుకే Ayu వినలేదు. మీకు ఏమనిపిస్తోందో అది నొక్కండి.',
    other: 'Ayu ఇప్పుడు వినలేదు. మీకు ఏమనిపిస్తోందో అది నొక్కండి.',
  },
  tapToSpeak: 'మాట్లాడటానికి నొక్కండి',
  tryAgain: 'మళ్ళీ ప్రయత్నించండి',
  stop: 'మాటలు ముగించి చూడండి',
  cancel: 'వద్దు',
  orTap: 'లేదా ఒకటి నొక్కండి',
  camera: {
    on: 'Ayuకి కెమెరాలో చూపించండి',
    off: 'కెమెరా ఆపండి',
    flip: 'కెమెరా మార్చండి',
    notice: 'దీన్ని Ayu మాత్రమే చూస్తుంది. ఏదీ దాచి ఉంచదు.',
    failed: 'కెమెరా మొదలవలేదు. మీరు మాట్లాడుతూనే ఉండొచ్చు.',
  },
  call: {
    camera: 'కెమెరా',
    flip: 'తిప్పు',
    mute: 'మైక్ ఆఫ్',
    unmute: 'మైక్ ఆన్',
    mutedLine: 'మైక్ ఆఫ్‌లో ఉంది — Ayu కి మీ మాట వినిపించదు.',
  },
  heard: {
    meta: 'మీరు చెప్పింది',
    understood: 'నాకు అర్థమైంది — తప్పుగా ఉన్నది నొక్కి తీసేయండి',
    yes: 'అవును, సరిగ్గా ఉంది',
    again: 'మళ్ళీ చెప్పండి',
    nothing: 'దాని నుంచి ఏమీ రాసుకోలేకపోయాను. మళ్ళీ చెప్పండి, లేదా మీకు ఏమనిపిస్తోందో అది నొక్కండి.',
    sendWords: 'నా మాటలు ఉన్నవి ఉన్నట్టు పంపండి',
  },
};
