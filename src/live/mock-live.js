// Mock talk: no network, no key. A scripted Ayu that emits exactly the same
// events as gemini-live.js (captions, tool calls → cards, referral, finish),
// and runs the same local tool handlers and red-flag rules.

import { createTalkState, handleTool, recordAnswer, referral } from '../../shared/talk-state.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createMockTalk({ persona, lang = 'en', t, speak = true }) {
  const listeners = new Set();
  const emit = (e) => listeners.forEach((fn) => fn(e));
  const state = createTalkState(persona);
  const pending = new Map();
  let stopped = false;
  let paused = false;
  let level = null;

  const vars = { name: persona.name, weeks: persona.weeks, days: persona.daysAfterBirth };

  async function holdWhilePaused() {
    while (paused && !stopped) await wait(200);
  }

  function voice(text) {
    if (!speak || typeof speechSynthesis === 'undefined') return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      u.rate = 1.02;
      speechSynthesis.speak(u);
    } catch {
      // no voices — captions only
    }
  }

  /** Ayu says a line: captions word by word, like the real transcript. */
  async function say(key, extra = {}) {
    if (stopped) return;
    await holdWhilePaused();
    const text = t(key, { ...vars, ...extra });
    voice(text);
    const words = text.split(' ');
    for (let i = 0; i < words.length && !stopped; i++) {
      emit({ type: 'caption', who: 'ayu', text: (i ? ' ' : '') + words[i], partial: true });
      await wait(lang === 'hi' ? 150 : 120);
    }
    emit({ type: 'turn-complete' });
    await wait(350);
  }

  /** What she "says" in the mock (shown as her caption). */
  async function her(key) {
    if (stopped) return;
    await wait(500);
    emit({ type: 'caption', who: 'her', text: t(key, vars), partial: false });
    emit({ type: 'turn-complete' });
    await wait(500);
  }

  /** Model-style tool call → local handler → card; resolves with her answer. */
  function tool(name, args) {
    const out = handleTool(state, name, args);
    emit({ type: 'tool', name, args, result: out.response });
    if (out.referral) emit({ type: 'referral', referral: out.referral });
    if (out.finish) emit({ type: 'finish', ...out.finish });
    if (!out.card) return Promise.resolve(out.response);
    emit({ type: 'card', card: out.card });
    return new Promise((resolve) => pending.set(out.card.id, { card: out.card, resolve }));
  }

  async function pregnantScript() {
    await say('mock.greet');
    await her('mock.herFine');

    // S4 — yes / no with the camera / pictures for "Not sure"
    await say('mock.qSwelling');
    let a = await tool('ask_yes_no', {
      question: t('mock.qSwelling'),
      not_sure_action: 'pictures',
      picture_set: 'feet_swelling',
      sign: 'swelling_feet',
    });
    if (a === 'not_sure') {
      await say('mock.pickPicture');
      a = await tool('ask_single_choice', {
        question: t('mock.pickPictureQ'),
        picture_set: 'feet_swelling',
        options: [t('pictures.feet_swelling.normal'), t('pictures.feet_swelling.puffy'), t('pictures.feet_swelling.pitting')],
      });
      if (a === t('pictures.feet_swelling.pitting')) {
        tool('record_symptom', { sign: 'swelling_feet', her_words: a, severity: 'moderate' });
      }
    }
    if (stopped) return;
    await say(a === 'yes' ? 'mock.ackNoted' : 'mock.ackThanks');

    // S5 — her words first, then 3 ways to say it
    await her('mock.herPain');
    await say('mock.qPainKind');
    const kind = await tool('ask_single_choice', {
      question: t('mock.qPainKind'),
      her_words: t('mock.herPain'),
      options: [t('mock.painTight'), t('mock.painSharp'), t('mock.painBurning')],
    });
    if (stopped) return;
    tool('record_symptom', {
      sign: kind === t('mock.painSharp') ? 'severe_abdominal_pain' : 'other',
      her_words: `${t('mock.herPain')} — ${kind}`,
      since: 'sometimes',
      severity: 'mild',
    });
    await say(kind === t('mock.painBurning') ? 'mock.ackBurning' : 'mock.ackNoted');

    // S6 — danger signs, multiple choice; fixed rules decide
    await say('mock.qDanger');
    const signs = await tool('ask_multi_choice', {
      question: t('mock.qDanger'),
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
    let a = await tool('ask_yes_no', {
      question: t('mock.pnQYellow'),
      not_sure_action: 'pictures',
      picture_set: 'baby_skin_colour',
      sign: 'baby_yellow_skin',
    });
    if (a === 'not_sure') {
      await say('mock.pickPicture');
      a = await tool('ask_single_choice', {
        question: t('mock.pnPickQ'),
        picture_set: 'baby_skin_colour',
        options: [t('pictures.baby_skin_colour.normal'), t('pictures.baby_skin_colour.light'), t('pictures.baby_skin_colour.deep')],
      });
      if (a !== t('pictures.baby_skin_colour.normal')) {
        tool('record_symptom', { sign: 'baby_yellow_skin', her_words: a });
      }
    }
    if (stopped) return;
    await say('mock.ackNoted');
    await say('mock.pnQFeeding');
    const signs = await tool('ask_multi_choice', {
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
    const r = tool('red_flag_check', {});
    await r;
    const now = referral(state);
    if (now.level === 'emergency') await say('mock.emergency');
    else if (now.level === 'see_today') await say('mock.seeToday');
    else await say('mock.allFine');
    if (signs?.length) await say('mock.keepTablets');
    tool('finish_talk', {
      noted: state.answers.map((x) => `${x.question} → ${Array.isArray(x.answer) ? x.answer.join(', ') || '—' : x.answer}`),
    });
    emit({ type: 'status', status: 'ended' });
  }

  return {
    mode: 'mock',
    state,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    async start() {
      emit({ type: 'status', status: 'connecting' });
      await wait(600);
      emit({ type: 'info', model: 'mock (scripted)' });
      emit({ type: 'status', status: 'live' });
      level = setInterval(() => emit({ type: 'level', rms: paused ? 0 : Math.random() * 0.05 }), 200);
      (persona.stage === 'postnatal' ? postnatalScript() : pregnantScript()).catch((e) =>
        emit({ type: 'status', status: 'error', detail: e.message }),
      );
    },
    answer(cardId, answer) {
      const p = pending.get(cardId);
      if (!p) return;
      pending.delete(cardId);
      const r = recordAnswer(state, p.card, answer);
      emit({ type: 'referral', referral: r });
      p.resolve(answer);
    },
    sendPhoto(_b64, purpose) {
      state.photos.push({ purpose, at: Date.now() });
    },
    setCamera() {},
    pause(v) {
      paused = v;
      if (v && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    },
    referral: () => referral(state),
    end() {
      stopped = true;
      clearInterval(level);
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
      for (const p of pending.values()) p.resolve(null);
      pending.clear();
      emit({ type: 'status', status: 'ended' });
    },
  };
}
