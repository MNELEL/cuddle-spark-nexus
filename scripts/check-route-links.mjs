#!/usr/bin/env node
/**
 * Route-link coverage check.
 *
 * Every authenticated route must be reachable from the in-app navigation:
 * either it has an entry in src/lib/tool-registry.ts (a toolkit card), or it is
 * explicitly listed as NAV_EXEMPT_ROUTES (header nav / class screens / detail
 * pages opened from a list). Anything else is an orphan route — a page users
 * can only reach by typing the URL.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const routesDir = join(root, "src", "routes");
const registrySrc = readFileSync(join(root, "src", "lib", "tool-registry.ts"), "utf8");

/** Paths declared in the registry (`to: "/x/$classId"`). */
const registryPaths = new Set([...registrySrc.matchAll(/to:\s*"([^"]+)"/g)].map((m) => m[1]));
const exemptBlock = registrySrc.match(/NAV_EXEMPT_ROUTES\s*=\s*\[([\s\S]*?)\]/);
const exemptPaths = new Set(
  exemptBlock ? [...exemptBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [],
);

/** `_authenticated.reports.$classId.tsx` → `/reports/$classId` */
function routePath(file) {
  const base = file.replace(/\.tsx?$/, "").replace(/^_authenticated\./, "");
  if (base === "_authenticated") return null; // the layout itself
  const parts = base.split(".").filter((p) => p !== "index");
  return `/${parts.join("/")}`.replace(/\/$/, "") || "/";
}

const files = readdirSync(routesDir).filter(
  (f) => f.startsWith("_authenticated") && /\.tsx?$/.test(f) && f !== "_authenticated.tsx",
);

const orphans = [];
for (const file of files) {
  const path = routePath(file);
  if (!path) continue;
  if (registryPaths.has(path) || exemptPaths.has(path)) continue;
  orphans.push({ file, path });
}

if (orphans.length > 0) {
  console.error(`✗ ${orphans.length} orphan route(s) missing from in-app navigation:\n`);
  for (const o of orphans) console.error(`  ${o.path}   (src/routes/${o.file})`);
  console.error(
    "\nFix: add a ToolEntry to src/lib/tool-registry.ts (so it appears in /toolkit),\n" +
      "or list the path in NAV_EXEMPT_ROUTES when it is reached from another screen.",
  );
  process.exit(1);
}

console.log(`✓ route-link coverage: all ${files.length} authenticated routes are reachable from navigation`);
