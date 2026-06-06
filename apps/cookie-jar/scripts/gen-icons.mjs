// Generate Cookie Jar PWA icons from an inline SVG using sharp.
//   node scripts/gen-icons.mjs
// Outputs the four PWA sizes into public/icons and copies the 512 into the
// hub's public/app-icons/cookie-jar.png for the launcher tile.
//
// The mark is a coral glass JAR on a dark background, filled with small flat
// circles in the portfolio accent colours — "Cookie Jar" is the name.
import sharp from 'sharp'
import { mkdir, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = join(__dirname, '..')
const iconsDir = join(appRoot, 'public', 'icons')
const hubAppIcons = join(appRoot, '..', 'hub', 'public', 'app-icons')

// portfolio accent palette
export const COLORS = ['#e5484d', '#ffb224', '#12a594', '#8e4ec6', '#0090ff', '#d6409f', '#30a46c']

// Uniform balls settled by a 2D gravity simulation (drop + collide against the
// jar walls/floor/each other), then colour-balanced so neighbours differ. The
// pile fills the bottom wall-to-wall like a real jar ~a third full; each ball
// is sphere-shaded (highlight + edge shadow) for depth. [cx, cy, colorIdx],
// pre-computed so the icon is reproducible and matches CookieJarLogo.
export const BALL_R = 16
export const PILE = [
  [194,330.1,5], [287.6,330.5,2], [255.7,330.6,1], [334,357.3,6], [178,357.4,0],
  [271.5,358,0], [303.4,358.2,1], [209.2,358.2,2], [240,358.4,3], [319.9,385.6,3],
  [192.5,385.7,4], [288,386,4], [256.3,386,5], [224.6,386,6],
]

const circles = () =>
  PILE.map(([x, y, c]) =>
    `<circle cx="${x}" cy="${y}" r="${BALL_R}" fill="${COLORS[c]}"/>` +
    `<circle cx="${x}" cy="${y}" r="${BALL_R}" fill="url(#sphere)"/>`
  ).join('')

function svg({ rounded }) {
  const S = 512
  const bg = rounded
    ? `<rect width="${S}" height="${S}" rx="112" fill="url(#bg)"/>`
    : `<rect width="${S}" height="${S}" fill="url(#bg)"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="38%" r="75%">
        <stop offset="0" stop-color="#242427"/><stop offset="1" stop-color="#161618"/>
      </radialGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="rgba(229,72,77,0.30)"/><stop offset="1" stop-color="rgba(229,72,77,0)"/>
      </radialGradient>
      <radialGradient id="sphere" cx="36%" cy="32%" r="68%">
        <stop offset="0" stop-color="rgba(255,255,255,0.55)"/>
        <stop offset="0.34" stop-color="rgba(255,255,255,0)"/>
        <stop offset="1" stop-color="rgba(0,0,0,0.30)"/>
      </radialGradient>
      <clipPath id="clip"><rect x="162" y="182" width="188" height="220" rx="36"/></clipPath>
    </defs>
    ${bg}
    <circle cx="256" cy="300" r="190" fill="url(#glow)"/>
    <rect x="170" y="120" width="172" height="40" rx="14" fill="#e5484d"/>
    <rect x="160" y="152" width="192" height="22" rx="9" fill="#aa2429"/>
    <rect x="156" y="176" width="200" height="232" rx="40" fill="rgba(229,72,77,0.08)" stroke="#e5484d" stroke-width="11"/>
    <g clip-path="url(#clip)">${circles()}</g>
    <rect x="180" y="200" width="20" height="150" rx="10" fill="rgba(255,255,255,0.10)"/>
  </svg>`
}

async function png(svgStr, size, out) {
  await sharp(Buffer.from(svgStr)).resize(size, size).png().toFile(out)
  console.log('wrote', out)
}

await mkdir(iconsDir, { recursive: true })
await mkdir(hubAppIcons, { recursive: true })

const rounded = svg({ rounded: true })
const maskable = svg({ rounded: false })

await png(rounded, 180, join(iconsDir, 'cookie-jar-180.png'))
await png(rounded, 192, join(iconsDir, 'cookie-jar-192.png'))
await png(rounded, 512, join(iconsDir, 'cookie-jar-512.png'))
await png(maskable, 512, join(iconsDir, 'cookie-jar-512-maskable.png'))

await copyFile(join(iconsDir, 'cookie-jar-512.png'), join(hubAppIcons, 'cookie-jar.png'))
console.log('copied 512 -> hub/public/app-icons/cookie-jar.png')
