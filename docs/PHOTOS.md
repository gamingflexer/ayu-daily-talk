# Card photos

24 small photos (480x600 WebP, q72, about 373 KB in total) for the answer cards, in `src/assets/photos/`, exported by `src/assets/photos/index.js` as `PHOTOS` and mapped to answers in `src/patient/pics.jsx`.

**6 are real photos and 18 are AI-generated.** The real ones (`feet_dent`, `feet_puffy`, `vision_blur`, `skin_normal`, `skin_light`, `skin_deep`) come **from the designer's Figma photo library (file ZzHDfsxwIWGvTfXwmc27MH, frame 47:2389, "Photo library (internal mocks)"); sources to be credited by Om.** The other 18 are AI-generated (Google Gemini 3 Pro Image, "Nano Banana Pro"), show no real person, and need a clinician's and the designer's review before real use.

## Real photos (designer's Figma photo library)

Cropped with PIL to 4:5 on the subject and resized to 480x600, WebP q72, colours untouched.

| Key | Used for | Figma layer | What it shows |
|---|---|---|---|
| `feet_dent` | `swell:dent` | oedema_pitting-foot | left panel of a two-panel clinical photo: a finger pressing into a swollen shin (pitting test) |
| `feet_puffy` | `swell:feet`, sign `swelling_feet` | oedema_swollen-foot | a swollen foot next to a sandal on a tiled floor |
| `vision_blur` | `head:vision`, sign `blurred_vision` | sym_blurry-vision | a pregnant woman in a red shawl at a clinic, rubbing her eye |
| `skin_normal` | `skin:normal` (new-mother check) | newborn_skin-normal | a newborn's belly and arm, normal skin |
| `skin_light` | `skin:light` | jaundice_newborn-body | a newborn's arm and back, slightly yellow |
| `skin_deep` | `skin:deep`, sign `baby_yellow_skin` | jaundice_newborn-chest | a newborn's belly, clearly yellow |

Light and deep were assigned by how yellow each photo looks, not by the layer names (the "chest" photo is the yellower one). The baby-skin illustrations in `pics.jsx` (`baby_normal`, `baby_light`, `baby_deep`) stay as the fallback.

Review notes for the real photos:
- `skin_normal` shows a much paler-skinned baby than the two jaundice photos; a mother may compare tone rather than yellowness. Replace with a normal-skin photo of an Indian newborn when one is available.
- `vision_blur` is a real, identifiable woman; the gesture (rubbing her eye) suggests eye trouble but cannot show blurred sight. Consent and source need confirming.
- `feet_dent` is clinical (hospital sheet); the dent is shown by the pressing finger rather than a visible pit.
- Not used: call_face, ambulance, bp_150, urine_protein (Global Health Media watermark), iron-strip_red, stool_*, patch_*; sym_headache (the woman is smiling, it does not show a headache that stays, so `head_stays` stays AI).

## AI-generated tiles

### Sources

| Key | Source | Sheet / tile |
|---|---|---|
| `feet_normal` | AI-generated (Gemini image), not a real person | sheet1 tile 1 |
| `feet_puffy` | replaced by a real photo (see above); AI tile no longer in the repo | sheet2 tile 3 |
| `feet_dent` | replaced by a real photo (see above); AI tile no longer in the repo | sheet3 tile 1 |
| `hands_puffy` | AI-generated (Gemini image), not a real person | sheet2 tile 6 |
| `head_none` | AI-generated (Gemini image), not a real person | sheet1 tile 5 |
| `head_mild` | AI-generated (Gemini image), not a real person | sheet1 tile 6 |
| `head_stays` | AI-generated (Gemini image), not a real person | sheet1 tile 7 |
| `vision_blur` | replaced by a real photo (see above); AI tile no longer in the repo | sheet1 tile 8 |
| `baby_usual` | AI-generated (Gemini image), not a real person | sheet1 tile 9 |
| `baby_less` | AI-generated (Gemini image), not a real person | sheet1 tile 10 |
| `baby_still` | AI-generated (Gemini image), not a real person | sheet1 tile 11 |
| `cloth_clean` | AI-generated (Gemini image), not a real person | sheet1 tile 12 |
| `cloth_spots` | AI-generated (Gemini image), not a real person | sheet1 tile 13 |
| `cloth_soaked` | AI-generated (Gemini image), not a real person | sheet1 tile 14 |
| `cloth_wet` | AI-generated (Gemini image), not a real person | sheet1 tile 15 |
| `body_fine` | AI-generated (Gemini image), not a real person | sheet1 tile 16 |
| `body_tired` | AI-generated (Gemini image), not a real person | sheet1 tile 17 |
| `body_fever` | AI-generated (Gemini image), not a real person | sheet1 tile 18 |
| `body_fits` | AI-generated (Gemini image), not a real person | sheet1 tile 19 |
| `vomit` | AI-generated (Gemini image), not a real person | sheet1 tile 20 |
| `mood_low` | AI-generated (Gemini image), not a real person | sheet1 tile 21 |

Sheets (kept outside the repo): sheet1 = 5x5 collage at 4K (4096x4096) with 4 spare alternates; sheet2 = 3x2 collage at 2K, fixing swelling tiles; sheet3 = 3x1 at 2K, fixing the pitting dent. Sheets 2 and 3 were generated with a downsized copy of sheet1 as a style reference. Tiles were cut with PIL along detected white gutters, centre-cropped to 4:5, resized to 480x600.

## Real photos considered and rejected

Searched Wikimedia Commons and Openverse (swelling / pitting oedema / swollen feet and ankles / swollen hands). Every licence-compatible hit clashed with the set: hospital sheets or IV tape, pale or male skin, flash or bedroom light. Nothing was copied into the repo. Candidates (not used):

- Combinpedal.jpg, Commons, CC BY-SA 3.0 (clinical pitting oedema on a hospital sheet)
- Edema Hands 01.jpg, Commons, CC BY 2.0 (hand with IV tape, hospital gown)
- "swollen feet", Flickr, Karolina vslo, CC BY 2.0, https://www.flickr.com/photos/78967167@N04/7515305572 (pale skin, bed, dark sheet)
- Swollen ankle.jpg, Commons, CC BY 2.5 (male legs on a bed)

Unsplash, Pexels, Pixabay, NHM/MoHFW, WHO and CDC PHIL were allowed later in the task; they were not searched in depth (no reuse-licensed Indian-skin, home-setting swelling photo was found in the open-licence indexes, which already index much of that material). If a suitable real photo turns up, add its URL, photographer and licence here before swapping it in.

## Prompts

Common base (sheet1): a clean 5x5 contact sheet of 25 portrait tiles with thin white gutters, calm soft daylight, muted sand / terracotta / off-white, rural Maharashtra lime-washed wall and stone floor, the same pregnant Indian woman in her twenties (braid, terracotta-and-cream cotton saree, glass bangles, silver anklet), no nudity, gore, equipment, logos or text; then the per-tile scenes in order.

### Sheet 1 (`-r 1:1 -s 4K`)

```
One single image that is a clean contact-sheet grid of exactly 25 photographs: 5 columns by 5 rows, all tiles identical in size and portrait orientation (4:5), separated by thin plain pure-white gutters (about 1% of the width), no captions, no numbers, no text anywhere. Every tile is a calm, soft natural-daylight photograph in one consistent look: muted warm palette of sand, terracotta and off-white, soft window light from the left, no golden hour, no colour cast, no harsh shadows, no clutter, shallow depth of field. Setting: a rural Maharashtra home, lime-washed mud wall in warm off-white, grey stone floor. Any person is the SAME woman in every tile: Indian woman in her twenties, wheatish skin, long dark hair in a braid, simple faded terracotta-and-cream cotton saree, thin glass bangles, a thin silver anklet; she is visibly pregnant (about 7 months). No nudity, no gore, no medical equipment, no logos, no watermarks. Tiles in reading order, left to right, top to bottom:
Row 1: (1) top-down view of a pregnant woman's bare feet and ankles on a stone floor, normal slim ankles, silver anklet, no face. (2) the same top-down view but both feet and ankles visibly puffy and swollen, the anklet tight, no face. (3) close view of a shin and top of the foot with a woman's thumb pressing into the skin leaving a clear dent (pitting), no face. (4) close view of one swollen puffy hand with tight glass bangles and a tight ring, resting on a knee, no face. (5) the woman seated calmly, relaxed, eyes open, soft gentle look toward camera, head and shoulders.
Row 2: (6) the woman with one hand lightly resting on her forehead, mild discomfort, eyes open. (7) the woman with both hands holding her head, eyes shut tightly, in pain. (8) a deliberately blurred, out-of-focus view of a sunlit village lane with mud houses and a doorway, as seen through blurry eyes, no person, smeared soft shapes. (9) close crop of a pregnant belly in saree with both hands resting on it, relaxed, no face. (10) close crop of one hand on the belly with a tense worried posture, the woman looking down, face partly visible.
Row 3: (11) a woman seated on a mat, very still, looking down at her belly with both hands on it, calm worried, crop on belly and hands. (12) a clean neatly folded white cotton cloth on a stone floor, no person. (13) a white cotton cloth with a few small red spots, no person, not gory. (14) a white cotton cloth heavily stained red in the middle, no person, not gory, flat lay. (15) a white cotton cloth wet with clear water with a small puddle on the stone floor, no person.
Row 4: (16) the woman upright doing light housework, sweeping the floor with a short broom, healthy. (17) the woman seated resting against the mud wall, tired, shoulders slumped, eyes half closed. (18) the woman wrapped tightly in a grey shawl, shivering, hugging herself, looking unwell. (19) the woman lying on a floor mat with another woman's hands supporting her head and shoulder, the supporter shown only as hands and arms. (20) the woman bent over holding her stomach beside a steel bowl on the floor, nauseous.
Row 5: (21) the woman sitting alone on the doorstep of a doorway, looking down, sad and quiet. (22) alternate of tile 3: a thumb pressing the top of a swollen foot leaving a visible dent, close, no face. (23) alternate of tile 7: the woman with both hands pressed to her head, eyes shut, pained. (24) alternate of tile 11: the woman sitting, looking down at her very still belly, hands on it, crop on belly. (25) alternate of tile 19: the woman lying on a floor mat held by another woman's hands, side view.
```

### Sheet 2 (`-i` sheet1 reference, `-r 3:2 -s 2K`)

```
Using the attached contact sheet only as a style, colour and lighting reference, create one NEW image that is a clean grid of exactly 6 photographs: 3 columns by 2 rows, equal portrait (4:5) tiles separated by thin plain pure-white gutters, no captions, no text. Same look as the reference: soft daylight from the left, muted sand, terracotta and off-white palette, grey stone floor, lime-washed mud wall, Indian woman in her twenties, wheatish skin, pregnant, silver anklet, glass bangles, cotton saree. No faces in any of these tiles. Tiles in reading order:
Row 1: (1) close-up of a pregnant woman's lower leg and ankle, very swollen and puffy, a woman's thumb pressing firmly into the front of the shin and a clearly visible round deep dent (pit) left in the skin beside the thumb, side view, grey stone floor behind. (2) the same idea from a different angle: thumb lifted just away from the top of a swollen foot, leaving a clearly visible deep oval dent in the skin, sharp focus on the dent. (3) top-down view of both feet and ankles, grossly puffy and swollen, ankles no longer visible, skin stretched and shiny, silver anklet pressing tightly into the flesh, on a grey stone floor.
Row 2: (4) close-up of one clearly swollen puffy hand, fingers thick and sausage-like, a ring sunk tightly into the swollen finger and several glass bangles tight on a swollen wrist, hand resting open on the lap of a terracotta saree, no face. (5) another swollen puffy hand held in front of a lime-washed wall, fingers fat and tight, ring cutting into the finger, bangles tight, no face. (6) top-down view of both hands resting on a saree-covered knee, noticeably swollen and puffy with a tight ring and tight bangles, no face.
```

### Sheet 3 (`-i` sheet1 reference, `-r 3:2 -s 2K`)

```
Same style, colours and light as the attached reference. One new image: a clean row of exactly 3 portrait (4:5) photographs separated by thin plain white gutters, no text, no faces. Each tile: macro close-up of the swollen, puffy shin of a pregnant Indian woman (wheatish skin, silver anklet at the bottom edge, grey stone floor blurred behind), medical sign of pitting oedema: a deep, clearly visible round hollow about 2 cm wide pressed into the swollen skin, with raking side light making the depression obvious, the skin around it taut and shiny. Tile 1: the thumb has just been lifted away (thumb blurred at the left edge) and the deep round dent remains. Tile 2: the thumb is pressing in, the dent forming, a visible deep pit with the skin pushed in around the thumb. Tile 3: no hand at all, only the swollen shin with one deep round dent left in it, from slightly above. The dent must be unmistakable at a glance.
```

## Cost ledger

No published price was in the skill docs, so these are assumed list prices for `gemini-3-pro-image-preview`: $0.134 per 1K/2K image, $0.24 per 4K image.

| Call | Size | Price |
|---|---|---|
| Sheet 1 | 4K | $0.240 |
| Sheet 2 | 2K | $0.134 |
| Sheet 3 | 2K | $0.134 |
| **Total** | 3 calls | **$0.508** (cap $3.00) |

## Review notes

- `feet_dent`: the dent is deliberately exaggerated (deep round pit, raking light) so it reads at a glance; the leg skin is a little darker and more contrasty than the rest. A clinician should confirm it is not misleading.
- `baby_still`: reads as "woman looking down at belly, hands on it"; stillness is not visually distinguishable from `baby_usual`. Pair it with the caption.
- `hands_puffy`: swelling is modest (tight bangles and ring carry the meaning).
- `cloth_soaked`: strong red stain, flat lay, not gory.
- `body_fine`: she is sweeping (slightly bent), not fully upright.
- Sheet1 tiles were square, so 4:5 crops trim the sides; on `body_fine` and `body_tired` the figure is small in frame.
