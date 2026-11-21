// Pictures for answers that are easier to recognise than to name.
// Photos first (some real, from the designer's Figma photo library; the rest AI-made: see
// docs/PHOTOS.md); the flat illustrations below are the fallback when a photo file is missing.

const SKIN = '#9c6b4e';
const SHADE = '#7a4f39';

function Foot({ swell = 0, dent = false, tint }) {
  const w = 34 + swell * 10;
  return (
    <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
      <rect width="120" height="120" fill={tint} />
      <path
        d={`M${60 - w / 2} 10 L${60 - w / 2 - swell * 3} 70 Q${30 - swell * 4} 100 40 108 L${86 + swell * 4} 108 Q${96 + swell * 4} 96 ${80 + swell * 2} 74 L${60 + w / 2} 10 Z`}
        fill={SKIN}
      />
      {swell === 0 && <circle cx={60 + w / 2 - 6} cy="62" r="4" fill="#82563e" />}
      {dent && <ellipse cx="62" cy="80" rx="7" ry="4" fill={SHADE} />}
      {swell === 2 && <path d="M52 80 q10 -6 20 0" stroke={SHADE} strokeWidth="2" fill="none" />}
    </svg>
  );
}

/** A puffy hand: fingers thick, ring tight. No face is ever drawn. */
function Hand({ tint }) {
  return (
    <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
      <rect width="120" height="120" fill={tint} />
      <path d="M38 120V78q-12-8-12-22 0-8 7-8t7 8v6h2V30q0-8 7.5-8T57 30v20h2V24q0-8 7.5-8T74 24v26h2V32q0-8 7.5-8T91 32v46q0 16-9 24v18z" fill={SKIN} />
      <path d="M59 62h15" stroke="#e3a33a" strokeWidth="4" strokeLinecap="round" />
      <path d="M44 86q14 8 32 0" stroke={SHADE} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function BabyChest({ wash, tint }) {
  return (
    <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
      <rect width="120" height="120" fill={tint} />
      <rect x="18" y="26" width="84" height="84" rx="18" fill={SKIN} />
      {wash && <rect x="18" y="26" width="84" height="84" rx="18" fill={wash} opacity="0.55" />}
      <circle cx="44" cy="60" r="3" fill="#6d4532" />
      <circle cx="76" cy="60" r="3" fill="#6d4532" />
    </svg>
  );
}

// Tints step from calm to warm with the answer, as on the board.
const T = ['#e3dcd3', '#e6d6c8', '#e8d3c4', '#eacfc1'];

const ART = {
  feet_normal: <Foot swell={0} tint={T[0]} />,
  feet_puffy: <Foot swell={1} tint={T[1]} />,
  feet_dent: <Foot swell={2} dent tint={T[2]} />,
  face_puffy: <Hand tint={T[3]} />,
  baby_normal: <BabyChest tint={T[0]} />,
  baby_light: <BabyChest wash="#f2d24b" tint={T[1]} />,
  baby_deep: <BabyChest wash="#f0b400" tint={T[3]} />,
};

// Photos, when the files exist in src/assets/photos (see docs/PHOTOS.md for where each
// came from). A missing file simply falls back to the illustration, or to word answers.
const FILES = import.meta.glob('../assets/photos/*.webp', { eager: true, query: '?url', import: 'default' });
const PHOTO = Object.fromEntries(Object.entries(FILES).map(([path, url]) => [path.split('/').pop().replace('.webp', ''), url]));

/** Which photo belongs to which built-in answer (`<question>:<answer>`) or danger sign. */
const PHOTO_FOR = {
  'swell:none': 'feet_normal',
  'swell:feet': 'feet_puffy',
  'swell:dent': 'feet_dent',
  'swell:face': 'hands_puffy',
  'head:none': 'head_none',
  'head:mild': 'head_mild',
  'head:stays': 'head_stays',
  'head:vision': 'vision_blur',
  'baby:usual': 'baby_usual',
  'baby:less': 'baby_less',
  'baby:still': 'baby_still',
  'bleed:none': 'cloth_clean',
  'bleed:spot': 'cloth_spots',
  'bleed:heavy': 'cloth_soaked',
  'bleed:water': 'cloth_wet',
  'body:fine': 'body_fine',
  'body:tired': 'body_tired',
  'body:fever': 'body_fever',
  'body:fits': 'body_fits',
  'skin:normal': 'skin_normal',
  'skin:light': 'skin_light',
  'skin:deep': 'skin_deep',
};
const SIGN_PHOTO = {
  severe_headache: 'head_stays',
  blurred_vision: 'vision_blur',
  swelling_feet: 'feet_puffy',
  swelling_face_hands: 'hands_puffy',
  reduced_fetal_movement: 'baby_less',
  bleeding: 'cloth_spots',
  heavy_bleeding: 'cloth_soaked',
  fluid_leak: 'cloth_wet',
  fever: 'body_fever',
  convulsions: 'body_fits',
  vomiting_no_food: 'vomit',
  very_low_mood: 'mood_low',
  baby_yellow_skin: 'skin_deep',
};

const img = (url) => <img src={url} alt="" loading="lazy" decoding="async" />;

/** The picture for one answer of a built-in question: a photo, else an illustration, else nothing. */
export function picFor(set, q, o) {
  const photo = set?.builtin ? PHOTO[PHOTO_FOR[`${q.id}:${o.id}`]] : null;
  if (photo) return img(photo);
  return (o.pic && ART[o.pic]) || null;
}

/** The picture for a danger sign (Tell Ayu's quick taps and "I understood" rows), or null. */
export function signPic(sign) {
  const photo = PHOTO[SIGN_PHOTO[sign]];
  return photo ? img(photo) : null;
}

/** A question shows pictures only when every answer has one. */
export const hasPictures = (set, q) => q.options.every((o) => picFor(set, q, o));
