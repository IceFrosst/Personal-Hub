// Generate Cookie Jar PWA icons from an inline SVG using sharp.
//   node scripts/gen-icons.mjs
// Outputs the four PWA sizes into public/icons and copies the 512 into the
// hub's public/app-icons/cookie-jar.png for the launcher tile.
import sharp from 'sharp'
import { mkdir, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appRoot = join(__dirname, '..')
const iconsDir = join(appRoot, 'public', 'icons')
const hubAppIcons = join(appRoot, '..', 'hub', 'public', 'app-icons')

// A cream cookie with chocolate chips, centred on the canvas.
function cookie(cx, cy, r) {
  const chips = [
    [-0.34, -0.30, 0.12], [0.30, -0.40, 0.10], [0.42, 0.22, 0.11],
    [-0.22, 0.40, 0.10], [0.06, 0.04, 0.09], [-0.50, 0.10, 0.08],
    [0.20, -0.05, 0.07],
  ]
  const dots = chips
    .map(([dx, dy, dr]) =>
      `<circle cx="${cx + dx * r}" cy="${cy + dy * r}" r="${dr * r}" fill="#5a3210"/>`
    )
    .join('')
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#f0d29a"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#d9b878" stroke-width="${r * 0.05}"/>
    ${dots}
  `
}

function svg({ rounded }) {
  const S = 512
  const bg = rounded
    ? `<rect x="0" y="0" width="${S}" height="${S}" rx="112" fill="url(#g)"/>`
    : `<rect x="0" y="0" width="${S}" height="${S}" fill="url(#g)"/>`
  const r = rounded ? 150 : 128 // maskable cookie sits inside the safe zone
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ec5d5e"/>
        <stop offset="0.5" stop-color="#e5484d"/>
        <stop offset="1" stop-color="#aa2429"/>
      </linearGradient>
    </defs>
    ${bg}
    ${cookie(256, 256, r)}
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
