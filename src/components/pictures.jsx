// Pick-the-picture answers (Om's rule 3: what people say ≠ what they mean).
// These are simple illustrations until licensed real photos are added
// (see README → Photos). No real person is shown.

const SKIN = '#9c6b4e';

function Foot({ swell = 0, dent = false }) {
  const w = 34 + swell * 10;
  return (
    <svg viewBox="0 0 120 120" role="img">
      <rect width="120" height="120" fill="#4a4656" />
      <path
        d={`M${60 - w / 2} 10 L${60 - w / 2 - swell * 3} 70 Q${30 - swell * 4} 100 40 108 L${86 + swell * 4} 108 Q${96 + swell * 4} 96 ${80 + swell * 2} 74 L${60 + w / 2} 10 Z`}
        fill={SKIN}
      />
      {swell === 0 && <circle cx={60 + w / 2 - 6} cy="62" r="4" fill="#82563e" />}
      {dent && <ellipse cx="62" cy="80" rx="7" ry="4" fill="#7a4f39" />}
      {swell === 2 && <path d="M52 80 q10 -6 20 0" stroke="#7a4f39" strokeWidth="2" fill="none" />}
    </svg>
  );
}

function BabyChest({ tint }) {
  return (
    <svg viewBox="0 0 120 120" role="img">
      <rect width="120" height="120" fill="#4a4656" />
      <rect x="18" y="18" width="84" height="84" rx="18" fill={SKIN} />
      <rect x="18" y="18" width="84" height="84" rx="18" fill={tint} opacity="0.55" />
      <circle cx="44" cy="52" r="3" fill="#6d4532" />
      <circle cx="76" cy="52" r="3" fill="#6d4532" />
    </svg>
  );
}

function Swatch({ color, texture }) {
  return (
    <svg viewBox="0 0 120 120" role="img">
      <rect width="120" height="120" fill="#f3efe9" />
      <ellipse cx="60" cy="64" rx="34" ry="24" fill={color} />
      {texture && <ellipse cx="50" cy="58" rx="10" ry="5" fill="#fff" opacity="0.25" />}
    </svg>
  );
}

function Strip({ pill, round = true }) {
  return (
    <svg viewBox="0 0 120 120" role="img">
      <rect width="120" height="120" fill="#4a4656" />
      <rect x="12" y="34" width="96" height="52" rx="8" fill="#e8e4ee" />
      {[0, 1, 2, 3].map((c) =>
        [0, 1].map((r) =>
          round ? (
            <circle key={`${c}${r}`} cx={28 + c * 21} cy={50 + r * 20} r="7" fill={pill} />
          ) : (
            <rect key={`${c}${r}`} x={20 + c * 21} y={45 + r * 20} width="16" height="10" rx="5" fill={pill} />
          ),
        ),
      )}
    </svg>
  );
}

export const PICTURES = {
  feet_swelling: [
    { key: 'normal', art: <Foot swell={0} /> },
    { key: 'puffy', art: <Foot swell={1} /> },
    { key: 'pitting', art: <Foot swell={2} dent /> },
  ],
  baby_skin_colour: [
    { key: 'normal', art: <BabyChest tint="transparent" /> },
    { key: 'light', art: <BabyChest tint="#f2d24b" /> },
    { key: 'deep', art: <BabyChest tint="#f0b400" /> },
  ],
  stool_colour: [
    { key: 'yellow', art: <Swatch color="#d9a521" texture /> },
    { key: 'green', art: <Swatch color="#6f7f2a" texture /> },
    { key: 'pale', art: <Swatch color="#ece5cf" /> },
  ],
  medicine_strip: [
    { key: 'red_round', art: <Strip pill="#F15C3E" /> },
    { key: 'white_round', art: <Strip pill="#ffffff" /> },
    { key: 'capsule', art: <Strip pill="#4f7fd1" round={false} /> },
  ],
};
