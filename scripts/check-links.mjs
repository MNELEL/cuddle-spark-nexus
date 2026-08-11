#!/usr/bin/env node
/**
 * Link audit — scans every page (src/routes, src/components, src/lib) and every
 * document (root *.md, docs/*.md, public/*.txt, public/downloads/*.html) and
 * verifies that:
 *   1. every internal link resolves to a real route (src/routeTree.gen.ts) or a
 *      real file under public/,
 *   2. every external link uses https and points at an allowed host (no
 *      localhost, no example.com, no stale project domains),
 *   3. optionally (--external) that external URLs actually respond.
 *
 * Usage:
 *   node scripts/check-links.mjs            # static audit (CI default)
 *   node scripts/check-links.mjs --external # also hit the network
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SITE_HOST = "hakitasheli.lovable.app";

/** Hosts we are allowed to link out to. */
const ALLOWED_HOSTS = [
  SITE_HOST,
  "lovable.dev",
  "docs.lovable.dev",
  "netfree.link",
  "www.netfree.link",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "schema.org",
  "www.schema.org",
  "www.w3.org",
  "search.google.com",
  "developers.google.com",
  "www.sefaria.org",
  "sefaria.org",
  "hebcal.com",
  "www.hebcal.com",
  "supabase.com",
  "github.com",
  "www.gov.il",
  "play.google.com",
  "api.whatsapp.com",
  "wa.me",
  "tanstack.com",
  "js.hcaptcha.com",
  "api.hcaptcha.com",
  "hcaptcha.com",
  "api.resend.com",
  "ai.gateway.lovable.dev",
  "storage.googleapis.com",
];

/** XML/SVG namespace identifiers — not navigable links. */
const NAMESPACE_URLS = [
  "http://www.w3.org/",
  "https://www.w3.org/",
  "http://www.sitemaps.org/",
  "https://www.sitemaps.org/",
];

/** Substrings that must never appear inside a URL. */
const BANNED_URL_PARTS = [
  "localhost",
  "127.0.0.1",
  "example.com",
  "your-domain",
  "classalign",
  "lovable.app/undefined",
  "id-preview--",
];

/** Public paths that are served but not routes (files, anchors, mailto). */
const IGNORED_PREFIXES = ["#", "mailto:", "tel:", "data:", "javascript:", "{", "$"];

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walk(full, exts, out);
    } else if (exts.some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

/** Route paths declared in the generated route tree. */
export function readRoutePaths() {
  const src = readFileSync(join(ROOT, "src", "routeTree.gen.ts"), "utf8");
  const block = src.match(/export interface FileRoutesByTo \{([\s\S]*?)\n\}/);
  if (!block) throw new Error("could not read FileRoutesByTo from src/routeTree.gen.ts");
  return [...block[1].matchAll(/'([^']+)':/g)].map((m) => m[1]);
}

/** `/reports/$classId` → matcher for `/reports/abc-123`. */
function routeMatchers(paths) {
  return paths.map((p) => ({
    path: p,
    re: new RegExp(`^${p.replace(/[.]/g, "\\.").replace(/\$[^/]+/g, "[^/]+")}$`),
  }));
}

function isPublicFile(path) {
  const clean = path.split(/[?#]/)[0];
  return existsSync(join(ROOT, "public", clean.replace(/^\//, "")));
}

function collectFiles() {
  return [
    ...walk(join(ROOT, "src", "routes"), [".tsx", ".ts"]),
    ...walk(join(ROOT, "src", "components"), [".tsx", ".ts"]),
    ...walk(join(ROOT, "src", "lib"), [".ts", ".tsx"]),
    ...walk(join(ROOT, "docs"), [".md"]),
    ...readdirSync(ROOT).filter((f) => f.endsWith(".md")).map((f) => join(ROOT, f)),
    ...walk(join(ROOT, "public"), [".txt", ".html", ".xml"]),
  ];
}

/** Extract links from one file's source text. */
export function extractLinks(text) {
  const internal = new Set();
  const external = new Set();

  const push = (raw) => {
    if (!raw) return;
    const value = raw.trim();
    if (!value) return;
    if (IGNORED_PREFIXES.some((p) => value.startsWith(p))) return;
    if (value.includes("${")) return; // runtime-built URL
    if (NAMESPACE_URLS.some((n) => value.startsWith(n))) return;
    if (/^https?:\/\//.test(value)) {
      external.add(value.replace(/[.,);'"]+$/, ""));
      return;
    }
    if (value.startsWith("//")) return;
    if (!value.startsWith("/")) return;
    if (value.includes("${") || value.includes("$" + "{")) return;
    internal.add(value);
  };

  for (const m of text.matchAll(/\bto=["']([^"'`]+)["']/g)) push(m[1]);
  for (const m of text.matchAll(/\bhref=["']([^"'`]+)["']/g)) push(m[1]);
  for (const m of text.matchAll(/\bto:\s*["']([^"'`]+)["']/g)) push(m[1]);
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) push(m[1]); // markdown
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>\]]+/g)) push(m[0]);

  return { internal: [...internal], external: [...external] };
}

/** Static audit — no network access. Returns a list of problems. */
export function auditLinks() {
  const routes = readRoutePaths();
  const matchers = routeMatchers(routes);
  const problems = [];
  const externalUrls = new Set();
  let fileCount = 0;
  let linkCount = 0;

  for (const file of collectFiles()) {
    const rel = relative(ROOT, file);
    const { internal, external } = extractLinks(readFileSync(file, "utf8"));
    fileCount += 1;
    linkCount += internal.length + external.length;

    for (const link of internal) {
      const path = link.split(/[?#]/)[0].replace(/\/$/, "") || "/";
      if (matchers.some((m) => m.re.test(path))) continue;
      if (isPublicFile(link)) continue;
      problems.push({ file: rel, link, reason: "internal link does not match any route or public file" });
    }

    for (const url of external) {
      const lower = url.toLowerCase();
      const banned = BANNED_URL_PARTS.find((b) => lower.includes(b));
      if (banned) {
        problems.push({ file: rel, link: url, reason: `URL contains banned value "${banned}"` });
        continue;
      }
      if (url.startsWith("http://")) {
        problems.push({ file: rel, link: url, reason: "insecure http:// link (use https)" });
        continue;
      }
      let host;
      try {
        host = new URL(url).hostname;
      } catch {
        problems.push({ file: rel, link: url, reason: "malformed URL" });
        continue;
      }
      if (!ALLOWED_HOSTS.includes(host)) {
        problems.push({ file: rel, link: url, reason: `host "${host}" is not in the allow-list` });
        continue;
      }
      externalUrls.add(url);
    }
  }

  return { problems, externalUrls: [...externalUrls], fileCount, linkCount, routeCount: routes.length };
}

/**
 * Hosts whose URLs are API endpoints / preconnect origins, not pages: a live
 * GET legitimately answers 401/404/405, so the network pass skips them.
 */
const NON_PAGE_HOSTS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "ai.gateway.lovable.dev",
  "api.resend.com",
  "api.hcaptcha.com",
  "js.hcaptcha.com",
  "api.whatsapp.com",
];

/** Live check of external URLs (opt-in, network required). */
async function checkExternal(urls) {
  const dead = [];
  const pages = urls.filter((url) => {
    try {
      return !NON_PAGE_HOSTS.includes(new URL(url).hostname);
    } catch {
      return false;
    }
  });
  await Promise.all(
    pages.map(async (url) => {
      try {
        let res = await fetch(url, { method: "HEAD", redirect: "follow" });
        if (res.status === 405 || res.status === 403) {
          res = await fetch(url, { method: "GET", redirect: "follow" });
        }
        if (res.status >= 400) dead.push({ url, status: res.status });
      } catch (error) {
        dead.push({ url, status: String(error?.message ?? error) });
      }
    }),
  );
  return dead;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const { problems, externalUrls, fileCount, linkCount, routeCount } = auditLinks();

  if (problems.length > 0) {
    console.error(`✗ ${problems.length} broken/incorrect link(s):\n`);
    for (const p of problems) console.error(`  ${p.file}\n    ${p.link}\n    → ${p.reason}\n`);
  }

  let dead = [];
  if (process.argv.includes("--external")) {
    console.log(`… checking external URL(s) over the network`);
    dead = await checkExternal(externalUrls);
    for (const d of dead) console.error(`✗ unreachable: ${d.url} (${d.status})`);
  }

  if (problems.length > 0 || dead.length > 0) process.exit(1);

  console.log(
    `✓ link audit: ${linkCount} link(s) across ${fileCount} file(s) resolve correctly ` +
      `(${routeCount} routes, ${externalUrls.length} unique external URLs)`,
  );
}
