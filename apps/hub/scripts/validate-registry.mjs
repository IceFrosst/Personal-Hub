// Validate config/apps.json at build time (wired into `prebuild`).
//   node scripts/validate-registry.mjs [path-to-apps.json]
// Fails (exit 1) with a message naming the slug and the problem if any entry has:
//   - a non-kebab-case slug
//   - a `color` outside the 8 allowed palette names
//   - an `icon` not mapped in src/lib/icons.ts (the "two-step gotcha")
//   - an `iconImage` whose file doesn't exist under public/
//   - a missing/empty `versions.stable`
// Dependency-free: node:fs only.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");

const registryPath = process.argv[2] ?? join(appRoot, "config", "apps.json");
const iconsTsPath = join(appRoot, "src", "lib", "icons.ts");
const publicDir = join(appRoot, "public");

const ALLOWED_COLORS = ["coral", "teal", "purple", "amber", "blue", "pink", "green", "gray"];
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Parse the mapping keys out of src/lib/icons.ts source — don't import TS.
const iconsSource = readFileSync(iconsTsPath, "utf8");
const mapBlock = iconsSource.match(/const map[^{]*\{([\s\S]*?)\n\};/);
if (!mapBlock) {
  console.error(`validate-registry: could not find the icon map in ${iconsTsPath}`);
  process.exit(1);
}
const mappedIcons = new Set(
  [...mapBlock[1].matchAll(/^\s*["']?([\w-]+)["']?\s*:/gm)].map((m) => m[1])
);

const { apps } = JSON.parse(readFileSync(registryPath, "utf8"));
const errors = [];

for (const app of apps) {
  const slug = app.slug ?? "<missing slug>";
  if (!app.slug || !KEBAB_CASE.test(app.slug)) {
    errors.push(`${slug}: slug must be kebab-case (got ${JSON.stringify(app.slug)})`);
  }
  if (!ALLOWED_COLORS.includes(app.color)) {
    errors.push(
      `${slug}: color ${JSON.stringify(app.color)} is not one of: ${ALLOWED_COLORS.join(", ")}`
    );
  }
  if (!app.icon || !mappedIcons.has(app.icon)) {
    errors.push(
      `${slug}: icon ${JSON.stringify(app.icon)} is not mapped in src/lib/icons.ts — add it there or the tile falls back to a generic icon`
    );
  }
  if (app.iconImage && !existsSync(join(publicDir, app.iconImage))) {
    errors.push(`${slug}: iconImage ${app.iconImage} does not exist under public/`);
  }
  if (!app.versions?.stable) {
    errors.push(`${slug}: versions.stable is missing or empty`);
  }
}

if (errors.length > 0) {
  console.error(`validate-registry: ${registryPath} failed validation:`);
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}
console.log(`validate-registry: ${apps.length} app(s) OK`);
