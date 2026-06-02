// Generate Cookie Jar PWA icons from an inline SVG using sharp.
//   node scripts/gen-icons.mjs
// Outputs the four PWA sizes into public/icons and copies the 512 into the
// hub's public/app-icons/cookie-jar.png for the launcher tile.
//
// The mark is a literal JAR on a dark background, with cookies inside —
// "Cookie Jar" is the name; the icon is the jar.
import sharp from 'sharp'
import { mkdir, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = join(__dirname, '..')
const iconsDir = join(appRoot, 'public', 'icons')
const hubAppIcons = join(appRoot, '..', 'hub', 'public', 'app-icons')

// A small cream cookie with chocolate chips.
function cookie(cx, cy, r) {
  const chips = [[-0.32, -0.28], [0.30, -0.18], [0.28, 0.30], [-0.22, 0.30], [0.02, 0.02]]
  const dots = chips
    .map(([dx, dy]) =>
      `<circle cx="${cx + dx * r}" cy="${cy + dy * r}" r="${r * 0.13}" fill="#7a4a1e"/>`
    )
    .join('')
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#f0d29a"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#d9b878" stroke-width="${r * 0.06}"/>
    ${dots}
  `
}

// The jar: a glass body (coral rim + lid), filled with a pile of cookies.
function jar() {
  const C = '#e5484d' // coral
  const Cd = '#aa2429' // deep coral (screw band)
  return `
    <!-- soft warm glow behind the jar -->
    <circle cx="256" cy="300" r="190" fill="url(#glow)"/>

    <!-- lid -->
    <rect x="170" y="120" width="172" height="40" rx="14" fill="${C}"/>
    <rect x="160" y="152" width="192" height="22" rx="9" fill="${Cd}"/>

    <!-- glass body -->
    <rect x="156" y="176" width="200" height="232" rx="40"
          fill="rgba(229,72,77,0.10)" stroke="${C}" stroke-width="11"/>

    <!-- cookies inside (clipped to the jar interior) -->
    <g clip-path="url(#jarClip)">
      ${cookie(214, 348, 46)}
      ${cookie(308, 356, 42)}
      ${cookie(262, 296, 44)}
    </g>

    <!-- glass highlight -->
    <rect x="180" y="200" width="20" height="150" rx="10" fill="rgba(255,255,255,0.10)"/>
  `
}

function svg({ rounded }) {
  const S = 512
  const bg = rounded
    ? `<rect x="0" y="0" width="${S}" height="${S}" rx="112" fill="url(#bg)"/>`
    : `<rect x="0" y="0" width="${S}" height="${S}" fill="url(#bg)"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="38%" r="75%">
        <stop offset="0" stop-color="#242427"/>
        <stop offset="1" stop-color="#161618"/>
      </radialGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="rgba(229,72,77,0.34)"/>
        <stop offset="1" stop-color="rgba(229,72,77,0)"/>
      </radialGradient>
      <clipPath id="jarClip">
        <rect x="162" y="182" width="188" height="220" rx="36"/>
      </clipPath>
    </defs>
    ${bg}
    ${jar()}
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
