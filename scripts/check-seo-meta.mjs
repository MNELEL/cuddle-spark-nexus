#!/usr/bin/env node
/**
 * Guards the site title & description against drift.
 *
 * 1. src/lib/site-meta.ts must still export the approved defaults.
 * 2. src/routes/__root.tsx must build its head() from those constants
 *    (no inline title/description literals).
 * 3. Every route head() title must fit the title budget and every
 *    description must fit the description budget.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROUTES_DIR = "src/routes";

// The approved defaults. Changing these is an intentional, reviewed act.
const EXPECTED_TITLE = "הכיתה שלי · ניהול כיתה חכם לתלמודי תורה וחיידרים";
const EXPECTED_DESCRIPTION =
  "כלי ניהול כיתה מותאם לתלמודי תורה, חיידרים ובתי ספר — סידור הושבה AI, מעקב פדגוגי, דוחות חכמים, וחוויית 3D עוצרת נשימה.";
const TITLE_MAX = 60;
const DESC_MIN = 50;
const DESC_MAX = 160;

const errors = [];
const read = (p) => readFileSync(p, "utf8");

// --- 1. defaults ------------------------------------------------------------
const meta = read("src/lib/site-meta.ts");
const constant = (name) => {
  const m = meta.match(new RegExp(`export const ${name} =\\s*\\n?\\s*"([^"]*)"`));
  return m?.[1];
};
if (constant("SITE_TITLE") !== EXPECTED_TITLE) {
  errors.push(
    `SITE_TITLE drifted from the approved default.\n    expected: ${EXPECTED_TITLE}\n    found:    ${constant("SITE_TITLE")}`,
  );
}
if (constant("SITE_DESCRIPTION") !== EXPECTED_DESCRIPTION) {
  errors.push(
    `SITE_DESCRIPTION drifted from the approved default.\n    expected: ${EXPECTED_DESCRIPTION}\n    found:    ${constant("SITE_DESCRIPTION")}`,
  );
}
if (EXPECTED_TITLE.length > TITLE_MAX) errors.push(`Default title is ${EXPECTED_TITLE.length} chars (max ${TITLE_MAX}).`);
if (EXPECTED_DESCRIPTION.length < DESC_MIN || EXPECTED_DESCRIPTION.length > DESC_MAX) {
  errors.push(`Default description is ${EXPECTED_DESCRIPTION.length} chars (must be ${DESC_MIN}-${DESC_MAX}).`);
}

// --- 2. root route wires the constants in ----------------------------------
const root = read(join(ROUTES_DIR, "__root.tsx"));
for (const name of ["SITE_TITLE", "SITE_DESCRIPTION"]) {
  if (!root.includes(name)) errors.push(`src/routes/__root.tsx no longer uses ${name} from @/lib/site-meta.`);
}
if (root.includes(`"${EXPECTED_TITLE}"`) || root.includes(`"${EXPECTED_DESCRIPTION}"`)) {
  errors.push("src/routes/__root.tsx hardcodes the title/description; import them from @/lib/site-meta instead.");
}

// --- 3. per-route length budgets -------------------------------------------
const routeFiles = readdirSync(ROUTES_DIR, { recursive: true })
  .filter((f) => typeof f === "string" && /\.tsx?$/.test(f))
  .map((f) => join(ROUTES_DIR, f));

for (const file of routeFiles) {
  const src = read(file);
  for (const m of src.matchAll(/\{\s*title:\s*"([^"]+)"\s*\}/g)) {
    if (m[1].length > TITLE_MAX) errors.push(`${file}: title is ${m[1].length} chars (max ${TITLE_MAX}) — "${m[1]}"`);
  }
  for (const m of src.matchAll(/name:\s*"description",\s*\n?\s*content:\s*\n?\s*"([^"]+)"/g)) {
    const len = m[1].length;
    if (len < DESC_MIN || len > DESC_MAX) {
      errors.push(`${file}: description is ${len} chars (must be ${DESC_MIN}-${DESC_MAX}) — "${m[1].slice(0, 70)}…"`);
    }
  }
}

if (errors.length) {
  console.error(`\n✖ SEO metadata check failed (${errors.length} issue${errors.length > 1 ? "s" : ""}):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error("");
  process.exit(1);
}
console.log(`✔ SEO metadata check passed (${routeFiles.length} route files scanned).`);
