# Measurement rules

`shared/red-flags.js` decides referrals from **signs** — things she reports or
taps. `shared/measurements.js` adds the other half: **numbers** from a BP cuff,
a pulse oximeter or a MUAC tape. It returns the same `{level, reasons, rule}`
shape, so the two compose.

Tests: `test/measurements.test.js` (18, `node --test`, no network).

## The gap this closes

The rule engine currently has no numeric rule at all. That matters more than it
sounds, and the demo data already shows why.

Sunita's persona carries a BP trend ending at **138/92 today**
(`shared/personas.js`). `shared/doctor-summary.js` renders that with a `warn`
dot, because it checks `last.sys >= 140 || last.dia >= 90` inline. But that
threshold lives in a *presentation* file. No rule fires. Her referral level
stays whatever her tapped signs made it.

A diastolic of 92 in the third trimester is a same-day check. This is Case 02
(Gadchiroli) and Case 08 (Bahraich) from the research deck in miniature: the
number was measured, it was even displayed, and nothing acted on it.

## What fires, and on whose authority

| Reading | Threshold | Level | Basis |
|---|---|---|---|
| BP | ≥160 systolic or ≥110 diastolic | `emergency` | Bone 2021, doi:10.1016/S2214-109X(21)00219-9 |
| BP | ≥140 systolic or ≥90 diastolic | `see_today` | same |
| BP | 130/80 (stage 1) | **nothing, deliberately** | same — stage 1 was *not* associated with adverse outcomes across 103,679 readings from 21,069 women in India, Mozambique and Pakistan |
| SpO₂ | <90% | `emergency` | McCollum 2023, doi:10.1016/S2213-2600(23)00098-X — adjusted risk ratio for death 10.3 |
| SpO₂ | 90–93% | `see_today` | same — RR 4.3; Chandna 2026, doi:10.1038/s41591-026-04338-1 |
| MUAC | <115 mm | `emergency` | Blackwell 2015, doi:10.1186/s13690-015-0074-z |
| MUAC | 115–124 mm | `see_today` | same |
| Chest circumference | <29.5 cm | `see_today` | Kapoor 1996, doi:10.1136/jech.50.6.683 |
| Foot length | ≤7.6 cm | `see_today` | Tikmani 2024, doi:10.1136/bmjopen-2024-089153 |

Stage 1 hypertension not firing is a feature. Lowering that threshold would
flood an already-stretched ASHA with referrals the evidence does not support.

### Who held the tape decides whether it counts

This is the part with no equivalent anywhere else in the codebase. The same
measurement has different accuracy depending on who took it:

- **A mother may fire a MUAC referral.** Mothers screening their own children
  were non-inferior to community health workers, detected cases earlier, and
  cost a third as much (Ale 2016, doi:10.1186/s13690-016-0149-5).
- **A family member may not fire a foot-length referral.** A family-administered
  card misclassified **84.5% of babies under 2000 g as normal weight** in a
  cluster-randomised trial of 4,454 pregnancies (Hodgins 2020,
  doi:10.1186/s12889-020-09317-w). The same measurement by a frontline worker
  with a rigid ruler reaches 90.3% sensitivity (Tikmani 2024).

So `TRUSTED_SOURCES` gates each key by role. A reading from an untrusted source
is not discarded — it comes back under `contextOnly` for the doctor page, which
is where it belongs.

```js
evaluateMeasurements({
  measurements: [{ key: 'foot_length_mm', value: 70, source: 'family' }],
  stage: 'postnatal',
});
// → { level: 'none', contextOnly: [{ key: 'foot_length_mm', why: '… not validated for a referral' }] }
```

## Wiring it in

Nothing is wired yet, on purpose. Two lines make it live:

```js
// shared/talk-state.js
import { evaluateMeasurements, combineRules } from './measurements.js';

// …replacing the single `state.rule = evaluate({…})` assignment:
const signRule = evaluate({ signs: [...state.signs], weeks: p.weeks, daysAfterBirth: p.daysAfterBirth, stage: p.stage });
const measRule = evaluateMeasurements({ measurements: state.measurements || [], stage: p.stage });
state.rule = combineRules(signRule, measRule);
```

With `state.measurements` empty this changes nothing, and every existing test
still passes. Readings then arrive either from a new `record_measurement` tool
(needs a declaration in `shared/live-config.js` alongside `record_symptom`) or
by seeding from the persona.

### Seeding the persona BP is a product decision, not a technical one

```js
// in createTalkState, if you want it:
const latest = p.bp?.[p.bp.length - 1];
state.measurements = latest
  ? [
      { key: 'systolic_bp', value: latest.sys, source: 'asha' },
      { key: 'diastolic_bp', value: latest.dia, source: 'asha' },
    ]
  : [];
```

Be deliberate here. Sunita is the only persona with BP, and her latest reading
crosses the threshold, so this would open **every Sunita demo already at
`see_today`** before she taps anything. That may be exactly the story you want
to tell — the number was there all along and nobody acted on it — or it may wreck
the pacing of Flow A. It will also mask the existing talk-state tests that reach
`see_today` through tapped signs, because they would pass for the wrong reason.
Decide, then update those tests to say which rule they expect.

## Extending

Add a threshold to `evaluateMeasurements`, its citation to `CITATIONS`, and its
roles to `TRUSTED_SOURCES`. A test asserts that **every reason a rule can emit
has a citation containing a DOI**, so a new rule without one fails the suite.

Cut-offs for newborn size are population-specific; the foot-length literature
shows optimal values moving several millimetres between populations. Re-derive
locally before switching those two rules on.
