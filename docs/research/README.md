# Research behind the rules

Why each threshold in `shared/red-flags.js` and `shared/measurements.js` is the
number it is, and which published study says so. Every DOI here was resolved
against Crossref; none carries a retraction mark.

Two things this folder is **not**. It is not a clinical protocol — the rule sets
remain a demo for research, and a clinician must review them before any real
use. And the figures are screening and referral evidence, not diagnostic
performance: positive predictive values in community use are low by
construction, so no number here should ever be shown to a woman as a result
rather than as a reason to get a test.

## What is here

| File | What it is |
|---|---|
| [`low-resource-triage-scan.md`](low-resource-triage-scan.md) | The landscape scan. Symptom checkers, LLM triage safety, CHW protocols, cough audio, smartphone imaging, low-cost vitals, point-of-care tests. ~4,000 words, 75 verified DOIs. |
| [`prenatal-to-1000-days.md`](prenatal-to-1000-days.md) | What the 40 research-board stories actually need, and what a tape, a phone camera or a rupee note can really measure. |
| [`triage-input-evidence.csv`](triage-input-evidence.csv) | 63 rows: input, use case, evidence-supported grade, key numbers, n, population, DOI. |
| [`case-study-solvability-map.csv`](case-study-solvability-map.csv) | All 40 stories with `bottleneck_class` and `input_solvability`. |
| [`home-instrument-measurement-evidence.csv`](home-instrument-measurement-evidence.csv) | 38 rows on measuring with household objects: tape, thread, ruler, coin, phone camera. |
| [`pubmed-corpus-screened.csv`](pubmed-corpus-screened.csv) | 397 screened PubMed records with design and LMIC flags, if you want to push the screen further. |

## The finding that should shape the roadmap

**Only 12 of the 40 stories can be changed by a better input. Eighteen cannot be
touched by one at all.** Case 03 is a broken road, Case 19 an Aadhaar gate,
Case 23 a vaccination card left with a grandmother, Case 39 a newborn moved
between five hospitals with valid insurance. No camera, tape or sensor reaches
any of those; they fail on a record that did not travel, an explanation nobody
gave, transport, a stock-out or a referral nobody followed.

Narrower still: only **eight** of the forty turn on a measurement that was never
taken. The rest of the twelve need a follow-up, an adherence signal, or a
sentence that names a symptom as a symptom.

That is not an argument against this app. It is an argument for what the app is
already for — the README's own line, *nobody gives the family the record*, is a
sharper statement of the problem than any accuracy figure in this folder.

## How the flows line up

The README maps Flow A to stories 14 and 16, Flow B to 08 and 05, Flow C to 22,
18 and 20. Against the solvability map, **five of those seven are
input-solvable** (08, 14, 18, 20, 22). Two are not: story 05 is a
navigation-and-plan failure and story 16 is record portability — both real, both
worth building for, neither fixed by asking a better question.

**Seven input-solvable stories have no flow yet**: 02, 10, 13, 24, 26, 32, 35.
Story 02 is Gadchiroli — BP climbing for days, measured, nobody watching. That is
exactly what `shared/measurements.js` now covers, and Sunita's persona already
ends at 138/92. See [`../MEASUREMENTS.md`](../MEASUREMENTS.md).

## Where the research lands in the code

| Finding | Lives in |
|---|---|
| 140/90 is the right threshold; stage 1 is not (Bone 2021, doi:10.1016/S2214-109X(21)00219-9) | `shared/measurements.js` |
| SpO₂ is the highest-yield low-resource input (Chandna 2026, doi:10.1038/s41591-026-04338-1; McCollum 2023, doi:10.1016/S2213-2600(23)00098-X) | `shared/measurements.js` |
| A mother may fire a MUAC referral (Ale 2016, doi:10.1186/s13690-016-0149-5); a family foot-length card may not (Hodgins 2020, doi:10.1186/s12889-020-09317-w) | `TRUSTED_SOURCES` in `shared/measurements.js` |
| A model may raise a referral, never lower it (Ramaswamy 2026, doi:10.1038/s41591-026-04297-7) | `escalate()` in `shared/red-flags.js` — already built |
| Never tell her to stop a medicine | `mentionsStoppingMedicine()` — already built |
| Kick counting does not reduce stillbirth, so ask for prompt reporting of a *change* (Norman 2018, doi:10.1016/S0140-6736(18)31543-5) | `reduced_fetal_movement` as a sign, not a daily count |
| EPDS at a cut-off of 13 is validated in India (Fellmeth 2021, doi:10.1186/s12888-021-03190-6) — but self-report scored higher than interviewer-administered (Badiya 2021, doi:10.1016/j.ajp.2021.102890), and a voice agent is the interviewer condition | **not built** — `very_low_mood` is a `watch` sign with no instrument behind it |

## Three claims worth not repeating

The scan corrected things that are easy to find stated more confidently
elsewhere, including in earlier versions of our own notes:

1. **Skin-photo jaundice is not safe unmodified for Indian skin tones.** It held
   at r = 0.91 across US ethnicities, but reached only 64% sensitivity in darkly
   pigmented newborns (Zimmer 2026, doi:10.1111/apa.70454). The sclera route has
   the better claim (Enweronu-Laryea 2022, doi:10.1542/peds.2021-053600).
2. **Eyelid and sclera imaging for anaemia fails in this population.** 89.6%
   sensitivity at 26.1% specificity in 486 pregnant Indian women; excluding
   visible scleral pigmentation moved specificity only to 28.6%
   (Wemyss 2025, doi:10.1088/1361-6579/adab4d).
3. **Consumer LLM triage is far worse than the usual quoted figure.** 52% of
   gold-standard emergencies under-triaged, with family minimisation shifting
   recommendations toward less urgent care at an odds ratio of 11.7
   (Ramaswamy 2026). This is why `escalate()` exists and why the rules are not a
   model prompt.

## Do not rebuild

Smartphone video newborn anthropometry already exists in India as Wadhwani AI's
Shishu Maapan (NurtureNet, arXiv:2405.05530 — mean absolute error 114.3 g, 15 MB
offline model, a preprint evaluated by its developers). The research board's own
Case 26 reports 111 g across 92 ASHAs at four PHCs in Daman, with impact
explicitly unmeasured. The gap there is the loop after the measurement, not the
measurement.
