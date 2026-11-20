# Research data (21 Nov 2026)

Every talk and check is saved to a research store, so Ayu can be improved after testing. This page says what is sent, where it goes, how to read it, and what it cannot do.

## Where it goes

- A Firestore database in a Google Cloud / Firebase project called `ayu-daily-talk-research`.
- Created on 21 Nov 2026 on Om's Ayu Google account. Free Spark plan, no billing linked. Region `asia-south1` (Mumbai).
- The phone writes one document into the collection `talks` over the Firestore REST API, using the public Firebase web key. Code: [`src/research.js`](../src/research.js).
- The rules ([`firebase/firestore.rules`](../firebase/firestore.rules)) allow only **creating** a record in `talks`, with a fixed list of fields. The app cannot read, update or delete anything. Every other path is closed.
- Om reads the records in the Firebase console: https://console.firebase.google.com/project/ayu-daily-talk-research/firestore

## When a record is saved

| `kind` | When |
|---|---|
| `call` | Today's check on the video call (`/call`) ended, or was cancelled. |
| `check` | Today's check by tapping (`/check`), including one that continues a call. |
| `tell` | Tell Ayu talk, after she confirmed "You said". |
| `quick` | A quick tap on the Tell Ayu screen. |

- A cancelled call is saved too: `endedBy` is `cancel` and `level` is `unknown`.
- A call that ended with questions unanswered is saved as `call` with `level` `unknown` and `endedBy` ending in `:unanswered`. The app then continues by tapping and saves a second record of kind `check` with `endedBy` `call-then-tap`.
- Saving runs in the background and never blocks her.

## What is sent

Only these fields leave the phone. The rules reject any other field.

| Field | What it holds |
|---|---|
| `v` | Record version, always `1`. |
| `kind` | `call`, `check`, `tell` or `quick`. |
| `device` | A random id made on this phone (`d_` + a random UUID). Not linked to a name or number. Up to 40 characters. |
| `at`, `endedAt` | Start and end time, in milliseconds. |
| `lang` | Language code, for example `hi`. |
| `stage` | `pregnant` or `postnatal`. |
| `weeks` | Week of pregnancy, if known. |
| `daysAfterBirth` | Days since the birth, if known. |
| `setId` | Id of the question set used (not the questions). |
| `turns` | What was said, turn by turn: who (`her` or Ayu), the text (up to 1000 characters) and the time. Up to 400 turns. This is the transcription text. |
| `answers` | Her answer id for each question id. |
| `signs` | Danger signs Ayu noted. |
| `confirmed` | Signs she confirmed on "You said". |
| `removed` | Signs she removed on "You said". |
| `level` | `none`, `watch`, `see_today`, `emergency`, or `unknown`. Set by the fixed rules, never the model. |
| `rule` | Which rule decided the level. |
| `items` | For each item behind the level: its code and level. |
| `camera` | Whether the camera was on. The frames are not sent here. |
| `endedBy` | How it ended (`model`, `stop`, `timeout`, `drop`, `cancel`, `tap`, or `call-then-tap`). |
| `model` | A model name. The app does not fill it today, so it is empty. |
| `app` | App version. |

**Not sent:** her name, phone number, village, ASHA's name or number, health centre, location, her voice, camera pictures.

The sign-up screen says: "Your talks with Ayu are saved without your name or number, to help improve Ayu."

## If it cannot be sent

- A record that fails to send (no network, server error) waits on the phone, up to 50, and goes the next time the app opens. If the phone's storage is full or blocked, that record is lost.
- A record the server refuses for good (a 4xx other than a rate limit) is dropped, not retried.

## Turning it on

Build-time env vars:

- `VITE_FIREBASE_PROJECT` (here `ayu-daily-talk-research`)
- `VITE_FIREBASE_API_KEY` (the public web key of that project)

Without both, nothing is sent.

## Export

- **Firebase console:** open the link above and read the `talks` collection. The console can export a collection's documents.
- **`gcloud`:** `gcloud firestore export gs://<bucket> --project ayu-daily-talk-research`. This needs a Cloud Storage bucket and a billing account linked to the project. The project has no billing today, so this does not work until billing is added.

## Delete everything

Delete the project `ayu-daily-talk-research` in the Google Cloud console. All records go with it. The app then keeps queuing records on phones until the env vars are removed.

## Limits

- **Anyone with the web key can add junk records.** The key is public in the app. The rules limit which fields are allowed, not who writes. There is no App Check yet.
- **Her voice is not stored.** Only the transcription text is.
- **Transcripts may hold a name.** If she says her own name, a village or a phone number aloud, it can be in `turns`. Nothing removes it.
- Records are tied to a phone by the random `device` id, not to a person. Clearing the browser data makes a new id.
- The app cannot delete a record, so one woman cannot ask the app to remove hers. Deleting means going through the console.
