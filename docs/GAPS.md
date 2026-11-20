# Gaps: what is real, what is not yet (20 Nov 2026)

The app was rebuilt on 20 Nov 2026 to Vrindar's v0 boards (patient app and ASHA app). The older
"5-minute talk" screens, the demo personas, the scripted (mock) Ayu, the flows, the screens index,
the phone-call stub and the doctor summary are gone; they are in git history before this date.

## For clinical review before any real use

The built-in pregnancy check follows the designer's board. Where the board asks for more than the
older fixed rules (`shared/red-flags.js`), the higher level is kept as an answer floor
(`shared/question-sets.js`). Nothing was lowered. Each needs a clinician's yes or no:

| Answer | Fixed rule alone | In the daily check | Why |
|---|---|---|---|
| Headache that won't go | none | doctor today | board; also when told by voice |
| Not moved since morning | doctor today | 108 | board |
| Heavy bleeding (pregnant) | doctor today | 108 | board |
| Water leaking | doctor today | 108 | board |
| A dent stays when pressed | ASHA | ASHA | board has this at ASHA; the rule already agrees |
| Dent or face/hands swollen **with** headache-won't-go or blurry vision | doctor today | 108 | board ("call 108 now") |
| "Not sure" on any question | — | ASHA | board |

Two places where the fixed rule is **higher** than the board, and the rule wins:

- **"Feet a little swollen"** alone: the board shows "All fine today"; the rule says ASHA (`watch:swelling_feet`). At week 34 many women will see amber most days. Decide whether mild feet swelling alone should stay at ASHA.
- **"Tired, breathless at work"** on the board is a calm answer, but `breathlessness` alone is a 108 rule. The answer is worded "More tired than usual" and carries no sign, so real breathlessness is only caught through Tell Ayu. Decide the wording.

Also for review:

- **A set an ASHA approves replaces the built-in check for that woman** (`setFor`). If her set has no question about bleeding, swelling or the baby moving, those are no longer asked daily; Tell Ayu and Help now still cover them. Decide whether ASHA sets should be added to the built-in danger-sign questions instead.
- The **new-mother daily check** (5 questions) is not on the boards; it is built from the postnatal and newborn rules.
- **Low mood** now applies at every stage (it was after-birth only), because it is one of the Tell Ayu quick taps.
- Anything she **tells Ayu** and confirms is at least "talk to your ASHA", even when no rule fires.
- All non-English text is a draft translation. The danger-sign and answer wording decides where a woman goes; a native speaker with clinical sense must read `signs.*` and `sets.*` in each language.

## Not built yet

| Gap | What happens today |
|---|---|
| **Sharing between phones.** No accounts, no server database. | Data is on one phone. An ASHA sees only women added on her phone and checks done on it. The woman's app gives call and SMS buttons and never claims the ASHA was told. Needs a server store and sign-in. |
| **Verified sign-in.** | Name + phone number, not checked. No OTP provider is connected. |
| **Real photos** for picture answers. | The 21 pictures in the pregnancy check and the Tell Ayu pills are **AI-generated** (one woman, not a real person; sources and cost in [`PHOTOS.md`](PHOTOS.md)). No openly licensed real photo fitted. A clinician and the designer must review them: the pitting dent is exaggerated on purpose, "face or hands swollen" shows only mild swelling, and "not moved since morning" looks much like "moving like usual" without its caption. The new-mother check uses illustrations for baby skin colour and words elsewhere. |
| **Health centre details** (distance, opening hours). | She types the centre's name; the result links to map directions. No distance or hours are shown because none are known. |
| **Reminders.** | No notification asks her to do today's check. |
| **Session resumption** in Tell Ayu beyond two reconnects. | A call is capped at 5 minutes, inside the session limit. |
| **Her first words while the call connects** (about 3–6 s). | The screen says "Connecting to Ayu…" and Ayu greets her first. Holding her early audio and sending it when the socket opened was tried on 21 Nov and made transcription worse, so it was taken out. |
| **Voice for drafted sets.** | Read aloud with the phone's own voice where the phone has one for that language; the send screen says so only when it is true. |
| **Rate limits** are per server instance. | The hard limit is the Gemini quota in Google Cloud. |
| **GitHub Pages workflow** has failed since 16 Nov (it ends in 3 s, before the build). | The Vercel deploy is the live site. |

## Checked live (20 Nov 2026)

Headless Chrome, recorded speech as the microphone, real Gemini:

- Tell Ayu in English, 5 runs of the same recording: 4 clean (greeting by name → transcript → "headache that won't go" + "feet swollen" recorded → Ayu ended the talk → "You said" → pair rule → See a doctor today). **1 run lost her opening words**: the transcript began at "since morning…", the headache was kept only as her own words, and the result was "talk to your ASHA" instead of "see a doctor today". It did not repeat when the speech started earlier (2 s) or later (10 s). "You said" shows her exactly what was heard so she can say it again, and anything she confirms is at least ASHA level, but a dropped phrase can still under-triage. Watch this on real phones.
- Tell Ayu in Hindi: Ayu spoke Hindi → fever + baby moving less recorded → See a doctor today, shown in Hindi.
- Draft set for new mothers (English + Hindi) → review of 8 questions → approve → sent to the one matching woman.
- Patient flow at 390 and 360 px (English, Marathi, Tamil, Malayalam); ASHA flow at 390 px.
- 21 Nov: Tell Ayu as a real conversation (5-minute call, camera dock): one multi-turn English call with the camera on → Ayu said what it saw, asked about vision and belly pain, did not record "no bleeding", ended the call itself → headache + feet swollen → See a doctor today.
- One phone, both roles: she signs up → the phone is also set up for an ASHA → the ASHA does today's check with her and lands back on her page → "Open her app" returns to her Home, Tell Ayu and Help now.
- A hand-made approved set whose "pad soaked in an hour" answer was marked Fine still gave Call 108 (the fixed rule).

Not checked: a real phone (iOS Safari audio start, Android install), the camera frames reaching the model, a dropped connection mid-talk, the other seven languages by voice.
