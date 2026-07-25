#!/usr/bin/env node
/**
 * Guardrails against @tanstack/* version drift.
 *
 * Past incident: @tanstack/react-start was bumped past @tanstack/react-router,
 * and the transitive @tanstack/router-core no longer exported
 * `getScriptPreloadAttrs`, breaking the build with a cryptic type error.
 *
 * Rule enforced here: `@tanstack/router-core` and `@tanstack/react-router`
 * must be at the SAME OR HIGHER minor than `@tanstack/react-start`. The
 * broken case is router-core lagging behind react-start.
 *
 * Also warns (non-fatal) when any coupled @tanstack/* packages disagree on
 * minor, so drift shows up in CI logs before it becomes a build failure.
 *
 * Run via `bun run check:tanstack`.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

function parseMinor(v) {
  const m = /^(\d+)\.(\d+)\./.exec(v ?? "");
  return m ? { major: Number(m[1]), minor: Number(m[2]), label: `${m[1]}.${m[2]}` } : null;
}

function cmp(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  return a.minor - b.minor;
}

const versions = Object.fromEntries(
  COUPLED.map((name) => [name, readInstalledVersion(name)]),
);

console.log("[check-tanstack-versions] Installed versions:");
for (const name of COUPLED) console.log(`  - ${name}@${versions[name] ?? "<missing>"}`);

const start = parseMinor(versions["@tanstack/react-start"]);
const router = parseMinor(versions["@tanstack/react-router"]);
const core = parseMinor(versions["@tanstack/router-core"]);

if (!start || !router || !core) {
  console.error(
    "\n[check-tanstack-versions] FAIL: could not read installed versions for react-start / react-router / router-core. Did `bun install` run?",
  );
  process.exit(1);
}

const failures = [];
if (cmp(core, start) < 0) {
  failures.push(
    `@tanstack/router-core@${versions["@tanstack/router-core"]} is older than @tanstack/react-start@${versions["@tanstack/react-start"]}. ` +
      `react-start relies on router-core exports that only exist in matching or newer versions — the build will fail with a missing-export error.`,
  );
}
if (cmp(router, start) < 0) {
  failures.push(
    `@tanstack/react-router@${versions["@tanstack/react-router"]} is older than @tanstack/react-start@${versions["@tanstack/react-start"]}. ` +
      `Bump @tanstack/react-router to at least ${start.label}.x in package.json.`,
  );
}

if (failures.length > 0) {
  console.error("\n[check-tanstack-versions] FAIL:");
  for (const f of failures) console.error(`  • ${f}`);
  console.error(
    "\nSee README.md > TanStack version policy. Align versions in package.json and re-run `bun install`.",
  );
  process.exit(1);
}

const minors = new Set(
  COUPLED.map((n) => parseMinor(versions[n])?.label).filter(Boolean),
);
if (minors.size > 1) {
  console.warn(
    `\n[check-tanstack-versions] WARN: coupled @tanstack/* packages span multiple minors (${[...minors].join(", ")}). Build is currently compatible but drift is likely — consider aligning.`,
  );
}

console.log("\n[check-tanstack-versions] OK — router-core/react-router satisfy react-start.");