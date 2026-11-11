// Builds the PWA icons and the social preview image from the Ayu heart mark.
// Run: pnpm icons   (writes to public/icons and public/og-image.png)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const heart = fs.readFileSync(path.join(root, 'src/assets/brand/ayu-heart.svg'), 'utf8');
const inner = heart.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const out = path.join(root, 'public/icons');
fs.mkdirSync(out, { recursive: true });

const BG = '#FAF7F5';

/** Heart centred on a square, `pad` = share of the side left empty around it. */
function square(size, pad, bg = BG) {
  const w = size * (1 - pad * 2);
  const scale = w / 300;
  const x = (size - 300 * scale) / 2;
  const y = (size - 272 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ''}
  <g transform="translate(${x} ${y}) scale(${scale})">${inner}</g></svg>`;
}

const jobs = [
  ['icon-192.png', square(192, 0.14)],
  ['icon-512.png', square(512, 0.14)],
  ['icon-maskable-512.png', square(512, 0.24)],
  ['apple-touch-icon.png', square(180, 0.14)],
];
for (const [name, svg] of jobs) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, name));
}
fs.writeFileSync(path.join(out, 'favicon.svg'), square(64, 0.06, null));

// 1200×630 social preview. The headline is drawn as text; the Ayu wordmark
// is the heart + "Ayu™" only.
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <g transform="translate(90 92) scale(0.36)">${inner}</g>
  <text x="210" y="168" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="700" font-size="72" fill="#332F3C" letter-spacing="-3">Ayu<tspan font-size="22" dy="-36">™</tspan></text>
  <text x="90" y="330" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="700" font-size="64" fill="#332F3C" letter-spacing="-2.5">Her pregnancy, one day at a time.</text>
  <text x="90" y="410" font-family="Inter, Helvetica, Arial, sans-serif" font-size="34" fill="#5c5866" letter-spacing="-1">A 5-minute daily talk · question cards · phone-call fallback</text>
  <rect x="90" y="480" width="430" height="64" rx="32" fill="#F15C3E"/>
  <text x="305" y="522" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="600" font-size="28" fill="#fff">Open the demo</text>
  <text x="560" y="522" font-family="Inter, Helvetica, Arial, sans-serif" font-size="24" fill="#8a8592">Mock data only · UNICEF FemTech research</text>
</svg>`;
await sharp(Buffer.from(og)).png().toFile(path.join(root, 'public/og-image.png'));
console.log('icons written to public/icons and public/og-image.png');
