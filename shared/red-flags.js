// Fixed red-flag rules. These decide referrals — never the model.
//
// The model can only ADD a referral (see `escalate`). Nothing here, and no
// tool, lets the model lower a level that a rule has set.
//
// Signs follow the danger signs printed on India's MCP card and common
// postnatal / newborn danger signs. This is a demo rule set for research,
// not a clinical protocol: a clinician must review it before any real use.

/** Ordered from lowest to highest. */
export const LEVELS = ['none', 'watch', 'see_today', 'emergency'];

export const SIGNS = {
  // pregnancy
  severe_headache: { group: 'pregnancy' },
  blurred_vision: { group: 'pregnancy' },
  swelling_face_hands: { group: 'pregnancy' },
  swelling_feet: { group: 'pregnancy' },
  bleeding: { group: 'pregnancy' },
  fluid_leak: { group: 'pregnancy' },
  reduced_fetal_movement: { group: 'pregnancy' },
  severe_abdominal_pain: { group: 'pregnancy' },
  fever: { group: 'any' },
  convulsions: { group: 'any' },
  breathlessness: { group: 'any' },
  // after birth (mother)
  heavy_bleeding: { group: 'postnatal' },
  foul_discharge: { group: 'postnatal' },
  very_low_mood: { group: 'postnatal' },
  // newborn
  baby_yellow_skin: { group: 'newborn' },
  baby_poor_feeding: { group: 'newborn' },
  baby_fast_breathing: { group: 'newborn' },
  baby_cold_or_hot: { group: 'newborn' },
  baby_convulsions: { group: 'newborn' },
};

/** One sign alone means "call 108 now". */
const EMERGENCY = ['convulsions', 'heavy_bleeding', 'breathlessness', 'baby_convulsions'];

/** One sign alone means "see someone today". */
const SEE_TODAY_ALONE = [
  'bleeding',
  'fluid_leak',
  'reduced_fetal_movement',
  'blurred_vision',
  'severe_abdominal_pain',
  'fever',
  'foul_discharge',
  'baby_yellow_skin',
  'baby_poor_feeding',
  'baby_fast_breathing',
  'baby_cold_or_hot',
];

/** Signs that, together, mean "see someone today" (possible high BP). */
const PAIRS = [
  ['severe_headache', 'swelling_face_hands'],
  ['severe_headache', 'swelling_feet'],
  ['severe_headache', 'blurred_vision'],
];

export function levelIndex(level) {
  const i = LEVELS.indexOf(level);
  return i < 0 ? 0 : i;
}

export function maxLevel(a, b) {
  return levelIndex(a) >= levelIndex(b) ? a : b;
}

/**
 * Run the fixed rules.
 * @param {{signs: string[], weeks?: number, daysAfterBirth?: number}} input
 * @returns {{level: string, reasons: string[], rule: string|null}}
 */
export function evaluate({ signs = [], weeks, daysAfterBirth } = {}) {
  const set = new Set(signs.filter((s) => s in SIGNS));
  const reasons = [];
  let level = 'none';
  let rule = null;

  const hit = (lvl, why, ruleId) => {
    reasons.push(why);
    if (levelIndex(lvl) > levelIndex(level)) {
      level = lvl;
      rule = ruleId;
    }
  };

  for (const s of EMERGENCY) if (set.has(s)) hit('emergency', s, `emergency:${s}`);
  for (const s of SEE_TODAY_ALONE) if (set.has(s)) hit('see_today', s, `alone:${s}`);

  for (const [a, b] of PAIRS) {
    if (set.has(a) && set.has(b)) {
      // After 20 weeks this pair can mean pre-eclampsia; before 20 weeks it is still worth a same-day check.
      hit('see_today', `${a}+${b}`, `pair:${a}+${b}${weeks >= 20 ? ':after20w' : ''}`);
    }
  }

  // Any two danger signs together → see someone today (Figma S6 rule).
  const dangerCount = [...set].filter(
    (s) => s !== 'very_low_mood' && (s !== 'swelling_feet' || weeks >= 20),
  ).length;
  if (dangerCount >= 2 && levelIndex(level) < levelIndex('see_today')) {
    hit('see_today', 'two_or_more_signs', 'count:2+');
  }

  if (set.has('very_low_mood')) hit('watch', 'very_low_mood', 'mood:check_again');
  if (set.has('swelling_feet') && level === 'none') hit('watch', 'swelling_feet', 'watch:swelling_feet');

  // Jaundice in the first 24 hours of life is always urgent.
  if (set.has('baby_yellow_skin') && daysAfterBirth === 0) {
    hit('emergency', 'baby_yellow_first_day', 'emergency:yellow_day0');
  }

  return { level, reasons, rule };
}

/**
 * Combine the rule result with a level the model asked for.
 * The model may raise the level, never lower it.
 */
export function escalate(ruleLevel, modelLevel) {
  if (!LEVELS.includes(modelLevel)) return ruleLevel;
  return maxLevel(ruleLevel, modelLevel);
}

// Phrases that would tell her to stop a medicine. Used to flag (not rewrite)
// captions on the test page, so a reviewer can see if the model slipped.
const STOP_MEDICINE = [
  /\b(stop|quit|discontinue|skip)\b[^.]{0,30}\b(tablet|tablets|medicine|medicines|pill|pills|iron|calcium|dose)\b/i,
  /(दवा|गोली|गोलियां|गोलियाँ)[^।.]{0,20}(बंद|छोड़)/,
];

export function mentionsStoppingMedicine(text = '') {
  if (/\b(don['’]?t|do not|never|not)\s+(stop|quit|skip)\b/i.test(text)) return false;
  if (/(बंद\s*(न|मत)|मत\s*छोड़)/.test(text)) return false;
  return STOP_MEDICINE.some((re) => re.test(text));
}
