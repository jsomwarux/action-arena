// Generates the raster assets that can't live as SVG:
//   public/apple-touch-icon.png  (180×180, iOS home-screen icon)
//   public/og-image.png          (1200×630, social share card — PLACEHOLDER)
//
// Both are rendered from inline SVG via sharp. The "A" mark is drawn as
// vector strokes (no font dependency) so it renders identically everywhere;
// the brand gradient matches favicon.svg / ArenaLogo.
//
// Run with: npm run gen:assets
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, '..', 'public');

const GRAD = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#00FF87"/>
    <stop offset="1" stop-color="#18DCFF"/>
  </linearGradient>`;

/** Geometric "A" centered in a `size` box, stroked in `fg`. Font-free. */
function letterA(size, fg) {
  const apexX = size * 0.5;
  const apexY = size * 0.26;
  const baseY = size * 0.74;
  const lx = size * 0.3;
  const rx = size * 0.7;
  const barY = size * 0.6;
  const sw = size * 0.12;
  return `
    <path d="M ${lx} ${baseY} L ${apexX} ${apexY} L ${rx} ${baseY}" fill="none" stroke="${fg}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="${size * 0.385}" y1="${barY}" x2="${size * 0.615}" y2="${barY}" stroke="${fg}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

async function render(svg, file) {
  await sharp(Buffer.from(svg)).png().toFile(join(PUBLIC, file));
  console.log(`  ✓ ${file}`);
}

async function main() {
  // ── apple-touch-icon.png — full-bleed gradient, iOS masks the corners.
  const S = 180;
  await render(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
      <defs>${GRAD}</defs>
      <rect width="${S}" height="${S}" fill="url(#g)"/>
      ${letterA(S, '#0A0E1A')}
    </svg>`,
    'apple-touch-icon.png',
  );

  // ── og-image.png — branded PLACEHOLDER (replace before launch).
  const W = 1200;
  const H = 630;
  const tile = 132;
  const tx = 90;
  const ty = 150;
  await render(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        ${GRAD}
        <radialGradient id="glow" cx="72%" cy="48%" r="62%">
          <stop offset="0" stop-color="#00FF87" stop-opacity="0.16"/>
          <stop offset="0.7" stop-color="#00FF87" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="#0A0E1A"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <g transform="translate(${tx} ${ty})">
        <rect width="${tile}" height="${tile}" rx="28" fill="url(#g)"/>
        ${letterA(tile, '#0A0E1A')}
      </g>
      <text x="${tx + tile + 30}" y="${ty + tile * 0.64}" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-weight="700" font-size="62" letter-spacing="4" fill="#F8FAFC">ACTION ARENA</text>
      <text x="${tx}" y="430" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-weight="800" font-size="72" fill="#F8FAFC">SETTLE IT IN THE ARENA.</text>
      <text x="${tx}" y="482" font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" font-weight="400" font-size="29" fill="#F8FAFC" fill-opacity="0.72">The private NFL pick league your group chat runs all season.</text>
      <rect x="${tx}" y="516" width="120" height="6" rx="3" fill="#00FF87"/>
    </svg>`,
    'og-image.png',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
