// Fixed rules for measurements — numbers, not yes/no signs.
//
// red-flags.js handles signs she reports or taps. This file handles readings:
// a BP cuff, a pulse oximeter, a MUAC tape. It returns the same
// {level, reasons, rule} shape, so the two compose through combineRules().
//
// WHO TOOK THE READING DECIDES WHETHER IT CAN FIRE A RULE
// -------------------------------------------------------
// This is the part that is easy to miss. The same measurement has different
// accuracy depending on who held the tape, and the evidence is not subtle:
//
//   - Mothers screening their own children by MUAC were non-inferior to
//     community health workers, detected cases earlier, and cost a third as
//     much (Ale 2016, doi:10.1186/s13690-016-0149-5).
//   - A family-administered newborn foot-length card misclassified 84.5% of
//     babies under 2000 g as normal weight in a cluster-randomised trial of
//     4,454 pregnancies (Hodgins 2020, doi:10.1186/s12889-020-09317-w).
//
// So MUAC from a mother may trigger a referral. Foot length from a family
// member may not — it is kept and shown to the doctor as context, and
// `evaluateMeasurements` reports it under `contextOnly`.
//
// Like red-flags.js this is a demo rule set for research, not a clinical
// protocol. Every threshold carries the study it came from so a clinician can
// argue with it. Cut-offs for newborn size are population-specific and should
// be re-derived locally before they are switched on.

import { LEVELS, levelIndex, maxLevel } from './red-flags.js';

/** Who can take each reading such that it may fire a rule. */
export const TRUSTED_SOURCES = {
  systolic_bp: ['self', 'family', 'asha', 'clinician'],
  diastolic_bp: ['self', 'family', 'asha', 'clinician'],
  spo2: ['self', 'family', 'asha', 'clinician'],
  muac_child_mm: ['family', 'asha', 'clinician'],
  // Frontline worker with a rigid ruler only (Tikmani 2024). The family card failed.
  foot_length_mm: ['asha', 'clinician'],
  chest_circumference_cm: ['asha', 'clinician'],
};

/** Which stages each measurement applies to. */
const GROUPS = {
  systolic_bp: ['pregnant', 'postnatal', 'elder'],
  diastolic_bp: ['pregnant', 'postnatal', 'elder'],
  spo2: ['pregnant', 'postnatal', 'elder'],
  muac_child_mm: ['postnatal'],
  foot_length_mm: ['postnatal'],
  chest_circumference_cm: ['postnatal'],
};

export const CITATIONS = {
  bp_severe:
    'Bone 2021 doi:10.1016/S2214-109X(21)00219-9 — in 103,679 readings from 21,069 women in India, Mozambique and Pakistan, only severe stage 2 hypertension met diagnostic test standards (LR 6.36 maternal CNS events, 8.53 stillbirth)',
  bp_high:
    'Bone 2021 doi:10.1016/S2214-109X(21)00219-9 — the 140/90 threshold should be retained; stage 1 hypertension was NOT associated with adverse outcomes, so 130/80 deliberately does not fire',
  spo2_low:
    'McCollum 2023 doi:10.1016/S2213-2600(23)00098-X — SpO2 below 90% carried an adjusted risk ratio for death of 10.3 in outpatient children; WHO danger signs alone identified only 25% of the children who died',
  spo2_borderline:
    'McCollum 2023 doi:10.1016/S2213-2600(23)00098-X — SpO2 90–93% carried an adjusted risk ratio for death of 4.3. Chandna 2026 doi:10.1038/s41591-026-04338-1: adding pulse oximetry raised sensitivity for severe disease to 88.9% while cutting referrals threefold',
  muac_severe:
    'Blackwell 2015 doi:10.1186/s13690-015-0074-z — mothers reached >73% sensitivity and >98% specificity for severe acute malnutrition with a colour-banded strap',
  muac_moderate:
    'Blackwell 2015 doi:10.1186/s13690-015-0074-z — global acute malnutrition band',
  small_baby_chest:
    'Kapoor 1996 doi:10.1136/jech.50.6.683 — 29.5 cm gave about 80% sensitivity and specificity for birth weight under 2500 g in rural north India; chest circumference out-performed arm circumference',
  small_baby_foot:
    'Tikmani 2024 doi:10.1136/bmjopen-2024-089153 — 7.6 cm by rigid ruler gave 90.3% sensitivity and 81.8% specificity when taken by frontline health workers',
};

/**
 * A reading that may drive a rule.
 * @typedef {{key: string, value: number, source?: string}} Measurement
 */

function usable(m, stage) {
  if (!(m?.key in TRUSTED_SOURCES)) return { ok: false, why: 'unknown' };
  if (typeof m.value !== 'number' || Number.isNaN(m.value)) return { ok: false, why: 'not a number' };
  const stages = GROUPS[m.key];
  if (stage && stages && !stages.includes(stage)) return { ok: false, why: `not used in stage ${stage}` };
  const source = m.source || 'self';
  if (!TRUSTED_SOURCES[m.key].includes(source)) {
    return { ok: false, why: `${m.key} taken by ${source} is not validated for a referral` };
  }
  return { ok: true };
}

/**
 * Run the fixed measurement rules.
 * @param {{measurements?: Measurement[], stage?: string}} input
 * @returns {{level: string, reasons: string[], rule: string|null, contextOnly: {key: string, why: string}[]}}
 */
export function evaluateMeasurements({ measurements = [], stage } = {}) {
  const reasons = [];
  const contextOnly = [];
  let level = 'none';
  let rule = null;

  const hit = (lvl, why, ruleId) => {
    reasons.push(why);
    if (levelIndex(lvl) > levelIndex(level)) {
      level = lvl;
      rule = ruleId;
    }
  };

  /** @type {Record<string, number>} */
  const v = {};
  for (const m of measurements) {
    const check = usable(m, stage);
    if (!check.ok) {
      if (check.why !== 'unknown') contextOnly.push({ key: m?.key, why: check.why });
      continue;
    }
    v[m.key] = m.value;
  }

  // Blood pressure. Severe first so the more urgent rule wins the `rule` slot.
  if (v.systolic_bp >= 160 || v.diastolic_bp >= 110) {
    hit('emergency', 'bp_severe', 'measurement:bp>=160/110');
  } else if (v.systolic_bp >= 140 || v.diastolic_bp >= 90) {
    hit('see_today', 'bp_high', 'measurement:bp>=140/90');
  }

  // Oxygen saturation.
  if (v.spo2 !== undefined) {
    if (v.spo2 < 90) hit('emergency', 'spo2_low', 'measurement:spo2<90');
    else if (v.spo2 < 94) hit('see_today', 'spo2_borderline', 'measurement:spo2<94');
  }

  // Arm circumference, the one measurement a mother may take for a referral.
  if (v.muac_child_mm !== undefined) {
    if (v.muac_child_mm < 115) hit('emergency', 'muac_severe', 'measurement:muac<115');
    else if (v.muac_child_mm < 125) hit('see_today', 'muac_moderate', 'measurement:muac<125');
  }

  // Newborn size proxies. Frontline-worker measurement only.
  if (v.chest_circumference_cm !== undefined && v.chest_circumference_cm < 29.5) {
    hit('see_today', 'small_baby_chest', 'measurement:chest<29.5');
  }
  if (v.foot_length_mm !== undefined && v.foot_length_mm <= 76) {
    hit('see_today', 'small_baby_foot', 'measurement:foot<=76');
  }

  return { level, reasons, rule, contextOnly };
}

/**
 * Combine the sign rules with the measurement rules. Highest level wins; the
 * winning rule id is kept so the doctor page can say which rule fired.
 */
export function combineRules(signRule, measurementRule) {
  const a = signRule || { level: 'none', reasons: [], rule: null };
  const b = measurementRule || { level: 'none', reasons: [], rule: null };
  const level = maxLevel(a.level, b.level);
  const winner = levelIndex(b.level) > levelIndex(a.level) ? b : a;
  return {
    level,
    reasons: [...(a.reasons || []), ...(b.reasons || [])],
    rule: winner.rule,
    contextOnly: b.contextOnly || [],
  };
}

/** The citation behind a reason, for the doctor page. */
export function citationFor(reason) {
  return CITATIONS[reason] || null;
}

export { LEVELS };
