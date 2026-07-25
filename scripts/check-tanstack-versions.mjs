#!/usr/bin/env node
/**
 * Guardrails against @tanstack/* version drift.
 *
 * Past incident: bumping @tanstack/react-start without matching
 * @tanstack/react-router broke the build with
 *   "getScriptPreloadAttrs" is not exported by "@tanstack/router-core".
 *
 * This script fails CI when the installed minor versions of the coupled
 * @tanstack/* packages do not match. Run via `bun run check:tanstack`.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// These packages MUST share the same minor version. TanStack ships them in
// lockstep and mixing minors reintroduces the router-core export mismatch.
const COUPLED = [
  "@tanstack/react-start",
  "@tanstack/react-router",
  "@tanstack/react-router-devtools",
  "@tanstack/router-plugin",
  "@tanstack/router-core",
];

function readInstalledVersion(pkg) {
  const pkgJson = resolve(ROOT, "node_modules", pkg, "package.json");
  if (!existsSync(pkgJson)) return null;
  try {
    return JSON.parse(readFileSync(pkgJson, "utf8")).version ?? null;
  } catch {
    return null;
  }
}

function minor(v) {
  const m = /^(\d+)\.(\d+)\./.exec(v ?? "");
  return m ? `${m[1]}.${m[2]}` : null;
}

const rows = COUPLED.map((name) => {
  const version = readInstalledVersion(name);
  return { name, version, minor: minor(version) };
}).filter((r) => r.version !== null);

if (rows.length === 0) {
  console.error(
    "[check-tanstack-versions] No @tanstack/* packages found in node_modules. Did you run `bun install`?",
  );
  process.exit(1);
}

const uniqueMinors = [...new Set(rows.map((r) => r.minor))];

console.log("[check-tanstack-versions] Installed versions:");
for (const r of rows) console.log(`  - ${r.name}@${r.version}`);

if (uniqueMinors.length > 1) {
  console.error("\n[check-tanstack-versions] FAIL: minor version drift detected.");
  console.error(
    "The following @tanstack/* packages must share the same major.minor version:",
  );
  for (const r of rows) console.error(`  - ${r.name}@${r.version} (minor ${r.minor})`);
  console.error(
    "\nAlign the versions in package.json (see README.md > TanStack version policy) and re-run `bun install`.",
  );
  process.exit(1);
}

console.log(
  `\n[check-tanstack-versions] OK — all coupled @tanstack/* packages on minor ${uniqueMinors[0]}.`,
);