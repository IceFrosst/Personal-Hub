// Sync each app's real PWA icon into the hub's launcher tiles (wired into `prebuild`).
//   node scripts/sync-app-icons.mjs
// For every apps.json entry with iconImage "/app-icons/<slug>.png", look for the
// source icon in the sibling app folder: apps/<slug>/public/icons/<slug>-512.png,
// or failing that the single non-maskable *-512.png (focus-gate's is
// instagram-512.png). If the bytes differ from public/app-icons/<slug>.png, copy.
// On Vercel (Root Directory apps/hub) sibling folders may be absent — that's a
// logged skip, never a build failure.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const appsDir = join(appRoot, "..");
const appIconsDir = join(appRoot, "public", "app-icons");

const { apps } = JSON.parse(readFileSync(join(appRoot, "config", "apps.json"), "utf8"));

function findSourceIcon(slug) {
  const iconsDir = join(appsDir, slug, "public", "icons");
  if (!existsSync(iconsDir)) return null;
  const preferred = join(iconsDir, `${slug}-512.png`);
  if (existsSync(preferred)) return preferred;
  const candidates = readdirSync(iconsDir).filter(
    (f) => f.endsWith("-512.png") && !f.includes("maskable")
  );
  return candidates.length === 1 ? join(iconsDir, candidates[0]) : null;
}

mkdirSync(appIconsDir, { recursive: true });

for (const app of apps) {
  if (app.iconImage !== `/app-icons/${app.slug}.png`) continue;
  if (!existsSync(join(appsDir, app.slug))) {
    console.log(`sync-app-icons: apps/${app.slug} not present (Root Directory build?) — skipping`);
    continue;
  }
  const source = findSourceIcon(app.slug);
  if (!source) {
    console.log(`sync-app-icons: no *-512.png found for ${app.slug} — skipping`);
    continue;
  }
  const dest = join(appIconsDir, `${app.slug}.png`);
  const sourceBytes = readFileSync(source);
  if (existsSync(dest) && sourceBytes.equals(readFileSync(dest))) continue;
  writeFileSync(dest, sourceBytes);
  console.log(`sync-app-icons: copied ${basename(source)} -> public/app-icons/${app.slug}.png`);
}
console.log("sync-app-icons: done");
