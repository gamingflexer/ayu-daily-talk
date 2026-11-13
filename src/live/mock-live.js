// Mock talk: no network, no key. A scripted Ayu that emits exactly the same
// events as gemini-live.js (captions, tool calls → cards, referral, plan,
// finish, camera-turn, speaking, thinking, out-level, level), and runs the
// same local tool handlers and red-flag rules.
//
// The script has the shape of a real talk: voice-only turns (greeting, "how
// are you", confirming her words) between cards, a follow-up bundle for her
// pain (where, since when, how bad, worse with), a search for anything else,
// then the danger signs and the fixed-rule result.

import { createTalkState, handleTool, recordAnswer, changeAnswer, referral } from '../../shared/talk-state.js';
import { LANG_LOCALE } from '../i18n/dicts.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createMockTalk({ persona, lang = 'en', t, speak = true }) {
  const listeners = new Set();
  const emit = (e) => listeners.forEach((fn) => fn(e));
  const state = createTalkState(persona);
  const pending = new Map();
  const cards = new Map();
  let stopped = false;
  let paused = false;
  let micMeter = null;
  let micStop = null;

  const vars = { name: persona.name, weeks: persona.weeks, days: persona.daysAfterBirth };

  async function holdWhilePaused() {
    while (paused && !stopped) await wait(200);
  }

  function voice(text) {
    if (!speak || typeof speechSynthesis === 'undefined') return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LANG_LOCALE[lang] || 'en-IN';
      u.rate = 1.02;
      speechSynthesis.speak(u);
    } catch {
      // no voices — captions only
    }
  }

  /** Ayu "thinks" for a moment after she answers, like the model does. */
  async function think(ms = 700) {
    if (stopped) return;
    emit({ type: 'thinking', reason: 'answer' });
    await wait(ms);
  }

  /** Ayu says a line: captions word by word, like the real transcript; the voice orb moves while she speaks. */
  async function say(key, extra = {}) {
    if (stopped) return;
    await holdWhilePaused();
    const text = t(key, { ...vars, ...extra });
    voice(text);
    emit({ type: 'speaking', on: true });
    const words = text.split(' ');
    for (let i = 0; i < words.length && !stopped; i++) {
      emit({ type: 'caption', who: 'ayu', text: (i ? ' ' : '') + words[i], partial: true });
      emit({ type: 'out-level', rms: 0.05 + Math.random() * 0.12 });
      await wait(lang === 'en' ? 120 : 150);
    }
    emit({ type: 'out-level', rms: 0 });
    emit({ type: 'speaking', on: false });
    emit({ type: 'turn-complete' });
    await wait(350);
  }

  /** What she "says" in the mock (shown as her caption). */
  async function her(key) {
    if (stopped) return;
    await wait(500);
    emit({ type: 'caption', who: 'her', text: t(key, vars), partial: false });
    emit({ type: 'turn-complete' });
    await think(800);
  }

  /** Model-style tool call → local handler → card; resolves with her answer {answer, meta}. */
  function tool(name, args) {
    const out = handleTool(state, name, args);
    emit({ type: 'tool', name, args, result: out.response });
    if (out.referral) emit({ type: 'referral', referral: out.referral });
    if (out.plan) emit({ type: 'plan', plan: out.plan });
    if (out.finish) emit({ type: 'finish', ...out.finish });
    if (!out.card) return Promise.resolve({ answer: out.response });
    out.card.callId = `mock-${out.card.id}`;
    cards.set(out.card.id, out.card);
    emit({ type: 'card', card: out.card });
    return new Promise((resolve) => pending.set(out.card.id, { card: out.card, resolve }));
  }

  /** Demo 1 — pregnant, week 34 (Flow B): puffy feet + a headache → the fixed rules say see a doctor today. */
  async function swellingHeadacheScript() {
    await say('mock.greet');
    await her('mock.herHeadache');
    await say('mock.qSwelling');
    const { answer: a } = await tool('ask_yes_no', {
      question: t('mock.qSwelling'),
      not_sure_action: 'camera',
      picture_set: 'feet_swelling',
      sign: 'swelling_feet',
      explain: t('mock.explainSwelling'),
    });
    if (stopped) return;
    await think();
    await say(a === 'yes' ? 'mock.ackNoted' : 'mock.ackThanks');
    await say('mock.qHeadache');
    await tool('ask_yes_no', { question: t('mock.qHeadache'), sign: 'severe_headache', not_sure_action: 'none', explain: t('mock.explainHeadache') });
    if (stopped) return;
    await finish(null);
  }

  /** Demo 2 — grandma, 68, metformin since 5 days: stomach question with picture answers; red flags still apply. */
  async function metforminScript() {
    await say('mock.elGreet');
    await say('mock.elQStomach');
    const { meta } = await tool('ask_single_choice', {
      question: t('mock.elQStomach'),
      picture_set: 'stomach_upset',
      options: [t('pictures.stomach_upset.upset'), t('pictures.stomach_upset.vomiting'), t('pictures.stomach_upset.fine')],
      explain: t('mock.explainStomach'),
    });
    if (stopped) return;
    if (meta?.picture === 'upset') tool('record_symptom', { sign: 'other', her_words: t('pictures.stomach_upset.upset'), since: '5 days', severity: 'mild' });
    await think();
    await say('mock.elQThirst');
    await tool('ask_yes_no', { question: t('mock.elQThirst'), sign: 'dehydration', not_sure_action: 'none', explain: t('mock.explainThirst') });
    if (stopped) return;
    tool('red_flag_check', {});
    await wait(1400);
    if (stopped) return;
    const lvl = referral(state).level;
    await say(lvl === 'none' || lvl === 'watch' ? 'mock.elFine' : lvl === 'emergency' ? 'mock.emergency' : 'mock.elSeeToday');
    await say('mock.allDone');
    if (!state.finished) tool('finish_talk', {});
  }

  async function pregnantScript() {
    // Voice only: greeting and "how are you".
    await say('mock.greet');
    await her('mock.herFine');

    // S4 — yes / no with pictures (the app turns the back camera on); "Not sure" → camera turn.
    await say('mock.qSwelling');
    let { answer: a } = await tool('ask_yes_no', {
      question: t('mock.qSwelling'),
      not_sure_action: 'camera',
      picture_set: 'feet_swelling',
      sign: 'swelling_feet',
      explain: t('mock.explainSwelling'),
    });
    if (a === 'not_sure') {
      await say('mock.pickPicture');
      ({ answer: a } = await tool('ask_single_choice', {
        question: t('mock.pickPictureQ'),
        picture_set: 'feet_swelling',
        options: [t('pictures.feet_swelling.normal'), t('pictures.feet_swelling.puffy'), t('pictures.feet_swelling.pitting')],
      }));
      if (a === t('pictures.feet_swelling.pitting')) tool('record_symptom', { sign: 'swelling_feet', her_words: a, severity: 'moderate' });
    }
    if (stopped) return;
    await think();
    await say(a === 'yes' ? 'mock.ackNoted' : 'mock.ackThanks');

    // S5 — her words first, then ways to say it; then the follow-up bundle.
    await her('mock.herPain');
    await say('mock.qPainKind');
    const { answer: kind } = await tool('ask_single_choice', {
      question: t('mock.qPainKind'),
      her_words: t('mock.herPain'),
      options: [t('mock.painTight'), t('mock.painSharp'), t('mock.painBurning')],
    });
    if (stopped) return;
    await think();
    await say('mock.qWhere');
    const { answer: area } = await tool('ask_body_map', { question: t('mock.qWhere'), explain: t('mock.explainWhere') });
    if (stopped) return;
    await think(500);
    await say('mock.qSince');
    const { answer: since } = await tool('ask_duration', { question: t('mock.qSince'), explain: t('mock.explainSince') });
    if (stopped) return;
    await think(500);
    await say('mock.qSeverity');
    const { answer: sev } = await tool('ask_severity', {
      question: t('mock.qSeverity'),
      sign: 'severe_abdominal_pain',
      explain: t('mock.explainSeverity'),
    });
    if (stopped) return;
    await think(500);
    await say('mock.qWorse');
    await tool('ask_yes_no', { question: t('mock.qWorse'), not_sure_action: 'none' });
    if (stopped) return;
    tool('record_symptom', {
      sign: kind === t('mock.painSharp') ? 'severe_abdominal_pain' : 'other',
      her_words: `${t('mock.herPain')} — ${kind}`,
      since: since && since !== 'dont_know' ? t(`cards.duration.${since}`) : undefined,
      severity: ['mild', 'moderate', 'severe'].includes(sev) ? sev : 'unknown',
      area,
    });
    await think();
    await say(kind === t('mock.painBurning') ? 'mock.ackBurning' : 'mock.ackNoted');

    // S12 — one birth-plan question per talk, saved with update_plan
    if (persona.weeks >= 20) {
      await say('mock.qBag');
      const { answer: bag } = await tool('ask_yes_no', { question: t('mock.qBag'), not_sure_action: 'none' });
      if (stopped) return;
      tool('update_plan', { item: 'documents_bag', value: t('mock.bagValue'), ready: bag === 'yes' });
      await think(500);
      await say(bag === 'yes' ? 'mock.ackBagReady' : 'mock.ackBagTodo');
    }

    // Anything else? — symptom search
    await say('mock.qAnything');
    const { answer: other } = await tool('ask_symptom_search', { question: t('mock.qAnything'), explain: t('mock.explainAnything') });
    if (stopped) return;
    if (other) {
      await think(500);
      await say('mock.ackSearch');
    }

    // S6 — danger signs, multiple choice; fixed rules decide
    await say('mock.qDanger');
    const { answer: signs } = await tool('ask_multi_choice', {
      question: t('mock.qDanger'),
      explain: t('mock.explainDanger'),
      options: [
        { label: t('signs.severe_headache'), sign: 'severe_headache' },
        { label: t('signs.blurred_vision'), sign: 'blurred_vision' },
        { label: t('signs.swelling_face_hands'), sign: 'swelling_face_hands' },
        { label: t('signs.bleeding'), sign: 'bleeding' },
        { label: t('signs.reduced_fetal_movement'), sign: 'reduced_fetal_movement' },
      ],
    });
    if (stopped) return;
    await finish(signs);
  }

  async function postnatalScript() {
    await say('mock.pnGreet');
    await say('mock.pnQYellow');
    let { answer: a } = await tool('ask_yes_no', {
      question: t('mock.pnQYellow'),
      not_sure_action: 'camera',
      picture_set: 'baby_skin_colour',
      sign: 'baby_yellow_skin',
    });
    if (a === 'not_sure') {
      await say('mock.pickPicture');
      ({ answer: a } = await tool('ask_single_choice', {
        question: t('mock.pnPickQ'),
        picture_set: 'baby_skin_colour',
        options: [t('pictures.baby_skin_colour.normal'), t('pictures.baby_skin_colour.light'), t('pictures.baby_skin_colour.deep')],
      }));
      if (a !== t('pictures.baby_skin_colour.normal')) tool('record_symptom', { sign: 'baby_yellow_skin', her_words: a });
    }
    if (stopped) return;
    await think();
    await say('mock.ackNoted');
    await say('mock.pnQFeeding');
    const { answer: signs } = await tool('ask_multi_choice', {
      question: t('mock.pnQFeeding'),
      options: [
        { label: t('signs.baby_poor_feeding'), sign: 'baby_poor_feeding' },
        { label: t('signs.baby_fast_breathing'), sign: 'baby_fast_breathing' },
        { label: t('signs.baby_cold_or_hot'), sign: 'baby_cold_or_hot' },
        { label: t('signs.heavy_bleeding'), sign: 'heavy_bleeding' },
        { label: t('signs.very_low_mood'), sign: 'very_low_mood' },
      ],
    });
    if (stopped) return;
    await finish(signs);
  }

  async function finish(signs) {
    // "Checking with the safety rules…" — the rules are instant; the pause lets her see the step.
    tool('red_flag_check', {});
    await wait(1400);
    if (stopped) return;
    const now = referral(state);
    if (now.level === 'emergency') await say('mock.emergency');
    else if (now.level === 'see_today') await say('mock.seeToday');
    else await say('mock.allFine');
    if (signs?.length) await say('mock.keepTablets');
    await say('mock.allDone');
    if (state.finished) return;
    // Like the model: short lines in her language are left to the screen (built from the answers).
    tool('finish_talk', { questions_for_doctor: signs?.length ? [t('mock.doctorQ')] : [] });
  }

  return {
    mode: 'mock',
    state,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** @param {{stream?: MediaStream}} opts  her mic (only its level is used: nothing leaves the phone) */
    async start({ stream } = {}) {
      emit({ type: 'status', status: 'connecting' });
      await wait(700);
      if (stopped) return;
      emit({ type: 'info', model: 'mock (scripted)' });
      emit({ type: 'status', status: 'live' });
      micStop = meterMic(stream, (rms) => emit({ type: 'level', rms: paused ? 0 : rms }));
      if (!micStop) micMeter = setInterval(() => emit({ type: 'level', rms: paused ? 0 : Math.random() * 0.05 }), 200);
      // The two demo cases have short scripts of their own; the other personas get the full talk.
      const script = persona.id === 'reena' ? swellingHeadacheScript : persona.id === 'shanti' ? metforminScript : persona.stage === 'postnatal' ? postnatalScript : pregnantScript;
      script().catch((e) =>
        emit({ type: 'status', status: 'error', detail: e.message }),
      );
    },
    answer(cardId, answer, _labels, meta = {}) {
      const p = pending.get(cardId);
      if (!p) return;
      pending.delete(cardId);
      const r = recordAnswer(state, p.card, answer, meta);
      emit({ type: 'referral', referral: r });
      p.resolve({ answer, meta });
    },
    changeAnswer(cardId, answer, _labels, meta = {}) {
      const card = cards.get(cardId);
      if (!card) return;
      const { referral: r } = changeAnswer(state, card, answer, meta);
      emit({ type: 'referral', referral: r });
    },
    /** "Not sure" → camera: the scripted Ayu "looks" and comments, then asks her to pick the picture. */
    startCameraTurn(cardId, _stream, purpose) {
      const p = pending.get(cardId);
      state.photos.push({ purpose, kind: 'video', at: Date.now() });
      emit({ type: 'camera-turn', on: true, purpose });
      if (p) {
        pending.delete(cardId);
        emit({ type: 'referral', referral: recordAnswer(state, p.card, 'not_sure', { via: 'camera' }) });
      }
      (async () => {
        await think(1800);
        await say(`mock.cameraSaw.${purpose}`);
        p?.resolve({ answer: 'not_sure' });
      })();
    },
    endCameraTurn() {
      emit({ type: 'camera-turn', on: false });
    },
    cameraFor() {},
    sendPhoto(_b64, purpose) {
      state.photos.push({ purpose, kind: 'photo', at: Date.now() });
    },
    setCamera() {},
    timeCheck() {},
    /** Test hook (?drop=1): the connection drops and comes back. */
    async simulateDrop() {
      emit({ type: 'status', status: 'reconnecting', attempt: 1 });
      await wait(2500);
      if (!stopped) emit({ type: 'status', status: 'live' });
    },
    finishLocal(by = 'app') {
      if (state.finished) return;
      const out = handleTool(state, 'finish_talk', { by });
      emit({ type: 'finish', ...out.finish });
    },
    get speaking() {
      return typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking;
    },
    pause(v) {
      paused = v;
      if (v && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    },
    referral: () => referral(state),
    end() {
      stopped = true;
      clearInterval(micMeter);
      micStop?.();
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      for (const p of pending.values()) p.resolve({ answer: null });
      pending.clear();
      emit({ type: 'status', status: 'ended' });
    },
  };
}

/** Level of her real mic (for the listening ring) without sending audio anywhere. */
function meterMic(stream, onLevel) {
  if (!stream || typeof AudioContext === 'undefined') return null;
  try {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    const id = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      onLevel(Math.sqrt(sum / buf.length));
    }, 150);
    return () => {
      clearInterval(id);
      ctx.close().catch(() => {});
    };
  } catch {
    return null;
  }
}
