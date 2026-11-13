# Gaps: app vs Figma, and what is mock (13 Nov 2026)

Compared every screen of the app (`#/screens`) with the Figma page "Her daily 5-min consult"
(file `ZzHDfsxwIWGvTfXwmc27MH`, board `37:1598`): UI rules `45:2399`, new screens `39:1609`,
flows `42:1911`, ASHA `43:2367`. Screenshots of the Figma frames were taken through the Figma MCP.

Status: **built** = done in this round (see the commit log), **design-only** = stays a mock on purpose,
**open** = not done.

## The live talk (`#/talk`, Gemini Live or the mock)

| # | Gap | Figma / rule | Status |
|---|-----|--------------|--------|
| T1 | "Not sure" opened a still-photo screen (S9). It should be a camera button that turns the talk into a **camera/video turn**: back camera on, JPEG frames ≤1 fps to the model, the model says what it sees, then she confirms. | UI rule 1 "Tap to act", S4, C2 | built |
| T2 | A yes/no card with a `picture_set` showed no pictures. Figma S4 and C2 show the pictures as the answers ("Yes — puffy feet", "Yes — a dent stays", "Pink · normal", "Yellow · check today"). | S4, C2, UI rule 3 | built |
| T3 | Picture answers did not reach the fixed rules (a "very yellow" tile or a "dent stays" tile set no sign unless the script recorded it by hand). | rules decide | built (`PICTURE_SIGNS` in `shared/talk-state.js`) |
| T4 | `toolCallCancellation` from Gemini was logged but the card stayed on screen. | — | built |
| T5 | No 5-minute limit: the model was never told time is up, so `finish_talk` might never come. | "5-minute talk" | built (4:30 nudge, 5:00 wrap-up) |
| T6 | Ending the talk (✕) or a dropped socket threw away everything she said; the result screens then showed persona text. | S10/S11 driven by the talk | built (local `finish_talk` on end/close) |
| T7 | Weak network only checked `navigator.connection.effectiveType`. No RTT, no `offline`, no socket failure → S7. | S7 | built (`src/live/network.js`) |
| T8 | Hindi: UI strings existed, but the model was not told to write the **card text** in Hindi, and the opening nudge was English. | — | built |
| T9 | No tool for the birth/travel plan, so S12 could not change from a talk. | S12 "built inside daily talks" | built (`update_plan`) |
| T10 | Session resumption (`goAway` → resume handle) is not handled; a talk longer than the session limit just ends. | — | open (5-min talk is inside the limit) |
| T11 | Real Gemini Live end to end. | — | built + checked 13 Nov in headless Chrome with a fake mic/camera (7 short sessions): picture card via `ask_yes_no`, camera turn ("I can see your feet and ankles look a bit puffy"), `record_symptom` → `red_flag_check` → `finish_talk` → S10, in English and Hindi |
| T12 | Live findings fixed in the prompt: the model followed her profile language (spoke Romanized Marathi in an English session), put a card on "how are you?", wrote advice as a card question, bundled 3 signs into one yes/no, added "not medical advice" disclaimers, and did not always call `finish_talk` after see_today. | — | built (prompt) + app finishes 25 s after an urgent rule result if the model has not |
| T13 | The model may still over-attribute signs in `red_flag_check.extra_signs` (only ever raises a referral, never lowers). | rules decide | open — watch in review |
| T15 | Om (13 Nov): the talk showed the illustration until a tap on the camera button, and the tile shrank to a strip under cards. | UI rule: only her, zoomed in | built: mic + front camera from one tap, full-bleed video, cards as a sheet over it, voice-only fallback line, auto back camera for picture cards |
| T16 | Om (13 Nov): only English and Hindi. | — | built: mr, bn, ta, te, kn, gu, ml UI + prompt + mock (drafts for native review); token server accepts all nine |
| T17 | Om (13 Nov): no state while Ayu is thinking, etc. | rule 4 | built: state chip from engine events (`src/live/phase.js`), spinner on the tapped answer, reconnect, waits on S2/S3/S8/S9/S13 |
| T18 | Om (13 Nov, after Ada): more answer types and depth, not every question a card. | — | built: duration, severity, body map, symptom search, "What does this mean?", "Previous", one card at a time, missing-card nudge; no ranked conditions |
| T19 | The model sometimes still shows a card without saying the question aloud, and once added a "not medical advice" line (live run 13 Nov). | — | open — prompt tightened; watch in review |
| T20 | Om (13 Nov): two one-tap demo cases at the top (pregnant week 34; grandma on new metformin). | — | built: demo bar on S1 + Today, Reena default, new persona Shanti (`stage: elder`), metformin side-effect rules, picture/icon answers, "Ayu knows" strip |
| T21 | Live runs of the demos (13 Nov): the grandma demo asked the stomach picture card first and said the reassurance line, then waited for her voice instead of going on to the danger signs; the pregnant demo asked headache severity instead of the feet picture card. | — | prompt tightened (persona focus for Reena; "go straight on" for the new medicine); not re-run live |
| T14 | S13 model note once said "Routine referral level" while the rules said see today. | rules decide | built: the note may not state the level; a note that sounds routine on see_today/emergency is dropped (`noteContradicts`) |

## Core screens S1–S13

| Screen | Figma vs app | What is mock | Status |
|---|---|---|---|
| S1 Web entry | Matches (language chips, +6 more, one action low). All nine languages work now. | OTP is not sent | built (languages) |
| S2 OTP | Matches. | Any 6 digits work | design-only |
| S3 Today | Matches. Journey lines are persona text, not updated from talks. | journey | open (journey from talks) |
| S4 yes/no | Pictures missing (T2); "Not sure" → still photo (T1). Figma uses GHMP video frames for her tile — kept out of this public repo; the app shows an illustration. | her video tile | built (T1, T2) |
| S5 follow-up | Matches ("her words" quote, 3 options + something else). | — | — |
| S6 danger signs | Figma shows two options as photos (headache, blurry vision from GHMP). App uses text only. | photos | design-only (GHMP stays out) |
| S7 weak network | Only shown by a demo button or `effectiveType` (T7). | — | built |
| S8 phone call | Fixed three questions; keypad presses did nothing to the rules and always went to S11. The talk recorded before the drop was lost. | PSTN bridge is a stub (501) | built: keypad answers feed the fixed rules and continue the same talk state; bridge still a stub |
| S9 medicine photo | Works with the real camera; the "reading" result is a fixed IFA strip in mock mode. | strip reading in mock | design-only |
| S10 see someone today | Reason line came from tapped signs only; model-raised reasons and symptoms were ignored. Figma "What the ASHA measured today" (BP gauge, urine strip) uses GHMP frames. | ASHA readings | built (reasons from talk state); photos design-only |
| S11 all fine | "Ayu noted today" was always the persona's fixed list, never what the talk recorded. | — | built |
| S12 birth plan | Static persona list; Meera (week 9) fell back to Sunita's plan. | — | built (talk updates + "updated today", Meera/Anita get an empty plan) |
| S13 share with doctor | Static persona list; nothing from the talk. | QR is decorative | built: deterministic 2-minute summary from the talk (`shared/doctor-summary.js`) + optional short model note (`/api/summary`) |

## Flows A, B, C (`#/flows/…`)

The flows are fixed story screens (not driven by an engine) and match Figma's text. Differences:

- **A2** Figma has a "This one — the red tablet · From your ASHA" picture row and a fourth answer "What tablet?". App has the camera button instead. design-only.
- **A4** Figma shows two blurred "Sensitive photo · Tap to see" stool photos (UI rule 4). App has no blurred photos. open (needs licensed photos).
- **B3** Figma "What it looks like" (BP machine, 108 ambulance) from GHMP. design-only.
- **B4** Figma CTA "Call Raju (backup)", **B5** "I've reached the hospital"; app uses "Done". open (copy).
- **C2** Figma: two zoomed skin tiles (Pink / Yellow · check today) + Not sure. App reuses the illustration tiles. design-only until licensed photos.
- **C4** Figma CTA "Call ASHA Pinky"; app "Next — your own talk". open (copy).
- **C5** Figma adds "I'd rather not say". open (copy).

## ASHA screen

Matches Figma ("3 things to check", rules note). Fully mock: nothing aggregates talks by village.
design-only.

## Call test (`#/call-test`)

Works with both engines. Shows transcript, tool log and referral. It does not show the camera
turn or the doctor summary. open (not needed for the demo).

## Server / deploy

| Gap | Status |
|---|---|
| Token server only as Express; no Vercel functions | built (`api/`, `server/lib/`) |
| CORS let any origin call `/api/live-token` (only headers were withheld) | built (403 for unknown origins; no-Origin callers allowed through the same rate limit) |
| No daily cap on minted tokens | built (`LIVE_TOKEN_DAILY_CAP`, per instance) |
| Rate limit and cap are in memory, per instance | open (needs a shared store, e.g. Upstash, before real traffic) |
| Phone bridge (`/api/phone`) | stub, 501 |
