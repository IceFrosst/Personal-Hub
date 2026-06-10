// Generate the hub's PWA icons from public/icon.svg using sharp.
//   node scripts/gen-icons.mjs
// iOS does not render SVG apple-touch icons (blank home-screen tile), so we
// rasterize real PNGs into public/icons:
//   hub-180.png          — apple-touch icon, flattened onto opaque #161618
//   hub-192.png          — manifest icon (purpose: any)
//   hub-512.png          — manifest icon (purpose: any)
//   hub-512-maskable.png — same art scaled to ~70% inside a full-bleed
//                          #161618 background (purpose: maskable)
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const iconsDir = join(appRoot, "public", "icons");
const BG = "#161618";

const svg = await readFile(join(appRoot, "public", "icon.svg"));

await mkdir(iconsDir, { recursive: true });

async function png(size, name, { flatten = false } = {}) {
  let img = sharp(svg).resize(size, size);
  if (flatten) img = img.flatten({ background: BG });
  await img.png().toFile(join(iconsDir, name));
  console.log("wrote", join(iconsDir, name));
}

// apple-touch icon must be fully opaque — iOS fills transparency with black.
await png(180, "hub-180.png", { flatten: true });
await png(192, "hub-192.png");
await png(512, "hub-512.png");

// Maskable: art at ~70% on a full-bleed background so it survives the safe zone.
const artSize = Math.round(512 * 0.7);
const offset = Math.round((512 - artSize) / 2);
const art = await sharp(svg).resize(artSize, artSize).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
  .composite([{ input: art, left: offset, top: offset }])
  .png()
  .toFile(join(iconsDir, "hub-512-maskable.png"));
console.log("wrote", join(iconsDir, "hub-512-maskable.png"));
