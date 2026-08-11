#!/usr/bin/env node
/**
 * Automated SEO URL audit: canonical tags, Open Graph URLs, the sitemap and
 * robots.txt — all cross-checked against the real route files so a wrong,
 * missing or duplicated URL fails CI instead of reaching a crawler.
 *
 * Exported as auditSeoUrls() so src/test/seo-urls.test.ts can assert on the
 * exact same logic that `bun run check:seo:urls` runs.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROUTES_DIR = "src/routes";
const read = (p) => readFileSync(p, "utf8");

/** Routes that exist publicly but are intentionally kept out of the sitemap. */
const SITEMAP_EXCLUDED = new Set([
  "/login",
  "/reset-password",
  "/theme-test",
  "/rss.xml",
  "/sitemap.xml",
  "/blog", // layout wrapper; the real entry is /blog via blog.index.tsx
]);

/** Layout-only route files (they render <Outlet/> and own no metadata). */
const LAYOUT_FILES = new Set([
  "blog.tsx",
  "help.tsx",
  "parents-guide.tsx",
  "tools.tsx",
  "blog.classroom-management-strategies.tsx",
  "_authenticated.tsx",
]);

/** Placeholder metadata that must never ship. */
const BANNED_STRINGS = ["Lovable App", "Lovable Generated Project"];

/** Wrong hosts that must never appear inside a link or metadata URL. */
const BANNED_URL_HOSTS = ["localhost", "example.com", "classalign.studio", "classalign.app", "lovableproject.com"];

export function siteUrl() {
  const m = read("src/lib/site-meta.ts").match(/export const SITE_URL =\s*"([^"]+)"/);
  return m?.[1];
}

/** src/routes filename -> public URL path. Returns null when not derivable. */
export function routePathFromFile(rel) {
  if (rel.includes("[") || rel.includes("$")) return null;
  const noExt = rel.replace(/\.(tsx|ts)$/, "");
  const segments = noExt.split(/[./]/).filter(Boolean);
  if (segments[0] === "__root") return null;
  if (segments[0] === "_authenticated") segments.shift();
  if (segments[segments.length - 1] === "index") segments.pop();
  return "/" + segments.join("/");
}

function collectRouteFiles() {
  return readdirSync(ROUTES_DIR, { recursive: true })
    .filter((f) => typeof f === "string" && /\.tsx$/.test(f) && !f.includes("["))
    .sort();
}

/** Resolves a literal, an in-file const, or a `${SITE_URL}/x` template. */
function resolveExpr(expr, consts, site) {
  const e = expr.trim().replace(/,$/, "");
  const str = e.match(/^"([^"]*)"$/);
  if (str) return str[1];
  const tpl = e.match(/^`([^`]*)`$/);
  if (tpl) {
    const body = tpl[1];
    if (/\$\{(?!SITE_URL|BASE_URL|URL_SELF|URL)\w*[^}]*\}/.test(body)) return null; // dynamic
    return body.replace(/\$\{(SITE_URL|BASE_URL|URL_SELF|URL)\}/g, (_, n) =>
      n === "SITE_URL" ? site : (consts[n] ?? ""),
    );
  }
  if (/^\w+$/.test(e)) {
    if (e === "SITE_URL") return site;
    return consts[e] ?? null;
  }
  return null;
}

export function auditSeoUrls() {
  const errors = [];
  const site = siteUrl();
  if (!site || !/^https:\/\/[^/]+$/.test(site)) {
    errors.push(`SITE_URL must be an absolute https origin without a trailing slash (found: ${site}).`);
    return { errors, stats: {} };
  }

  const files = collectRouteFiles();
  const canonicalByUrl = new Map();
  let publicChecked = 0;
  const routePaths = new Set();

  for (const rel of files) {
    const file = join(ROUTES_DIR, rel);
    const src = read(file);
    const path = routePathFromFile(rel);
    if (path) routePaths.add(path);
    const isPrivate = rel.startsWith("_authenticated");

    for (const bad of BANNED_STRINGS) {
      if (src.includes(bad)) errors.push(`${file}: contains forbidden placeholder text "${bad}".`);
    }
    // Only URLs are checked for wrong hosts — form placeholders may say example.com.
    for (const m of src.matchAll(/(?:href|content|src|href:|content:)\s*=?\s*["'`](https?:\/\/[^"'`\s]+)/g)) {
      const host = m[1].replace(/^https?:\/\//, "").split("/")[0];
      if (BANNED_URL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
        errors.push(`${file}: link/metadata URL points at a wrong host (${m[1]}).`);
      }
    }

    if (rel === "__root.tsx") {
      if (/rel:\s*"canonical"/.test(src)) {
        errors.push("src/routes/__root.tsx must not declare a canonical link (it concatenates into every page).");
      }
      if (/property:\s*"og:image"/.test(src) || /name:\s*"twitter:image"/.test(src)) {
        errors.push("src/routes/__root.tsx must not declare og:image/twitter:image (it would override every leaf).");
      }
      continue;
    }

    const consts = {};
    for (const m of src.matchAll(/const\s+(\w+)\s*=\s*"([^"]+)"/g)) consts[m[1]] = m[2];
    for (const m of src.matchAll(/const\s+(\w+)\s*=\s*`([^`$]+)`/g)) consts[m[1]] = m[2];

    const canonicals = [...src.matchAll(/rel:\s*"canonical",\s*href:\s*([^}\n]+)/g)].map((m) => m[1]);
    const ogUrls = [...src.matchAll(/property:\s*"og:url",\s*content:\s*([^}\n]+)/g)].map((m) => m[1]);
    const blogHead = src.match(/blogPostHead\("([^"]+)"/);

    // og:image / twitter:image must be absolute when present.
    for (const m of src.matchAll(/(?:property:\s*"og:image"|name:\s*"twitter:image"),\s*content:\s*([^}\n]+)/g)) {
      const v = resolveExpr(m[1], consts, site);
      if (v && !/^https:\/\//.test(v)) errors.push(`${file}: og/twitter image must be an absolute https URL (found "${v}").`);
    }

    const isLayout = LAYOUT_FILES.has(rel);
    const isNoindex = /content:\s*"noindex/.test(src);

    if (isPrivate) {
      if (isLayout) continue;
      if (!/robots"/.test(src) || !/noindex/.test(src)) {
        errors.push(`${file}: private route must send a robots noindex meta tag.`);
      }
      continue;
    }

    if (canonicals.length > 1) errors.push(`${file}: declares ${canonicals.length} canonical links (max 1).`);

    const hasHead = /head:\s*(\(|\{)/.test(src);
    // Layout wrappers own no metadata; noindex utility screens need no canonical.
    if (isLayout || !hasHead || isNoindex) continue;

    publicChecked++;

    // Required text metadata.
    if (blogHead) {
      const declared = blogHead[1];
      if (path && declared !== path) {
        errors.push(`${file}: blogPostHead("${declared}") does not match the route path ${path}.`);
      }
      const url = `${site}${declared}`;
      const prev = canonicalByUrl.get(url);
      if (prev) errors.push(`Duplicate canonical ${url} in ${prev} and ${file}.`);
      canonicalByUrl.set(url, file);
      continue;
    }

    for (const [needle, label] of [
      ['name: "description"', "description"],
      ['property: "og:title"', "og:title"],
      ['property: "og:description"', "og:description"],
    ]) {
      if (!src.includes(needle)) errors.push(`${file}: missing ${label} meta tag.`);
    }
    if (!/\{\s*title:/.test(src)) errors.push(`${file}: missing title meta entry.`);

    if (canonicals.length === 0) {
      errors.push(`${file}: public route has no <link rel="canonical">.`);
      continue;
    }

    const canonical = resolveExpr(canonicals[0], consts, site);
    if (canonical === null) continue; // dynamic ($param) route — checked by its own tests
    if (!canonical.startsWith(`${site}/`)) {
      errors.push(`${file}: canonical "${canonical}" must be absolute and start with ${site}/.`);
      continue;
    }
    if (path) {
      const expected = path === "/" ? `${site}/` : `${site}${path}`;
      if (canonical !== expected) {
        errors.push(`${file}: canonical must self-reference ${expected} (found "${canonical}").`);
      }
    }
    const prev = canonicalByUrl.get(canonical);
    if (prev) errors.push(`Duplicate canonical ${canonical} in ${prev} and ${file}.`);
    canonicalByUrl.set(canonical, file);

    if (ogUrls.length) {
      const ogUrl = resolveExpr(ogUrls[0], consts, site);
      if (ogUrl && ogUrl !== canonical) {
        errors.push(`${file}: og:url ("${ogUrl}") must match the canonical ("${canonical}").`);
      }
    } else {
      errors.push(`${file}: missing og:url meta tag.`);
    }
  }

  // ---- sitemap -------------------------------------------------------------
  const sitemapSrc = read(join(ROUTES_DIR, "sitemap[.]xml.ts"));
  const base = sitemapSrc.match(/const BASE_URL =\s*"([^"]+)"/)?.[1];
  if (base !== site) errors.push(`sitemap BASE_URL ("${base}") must equal SITE_URL ("${site}").`);

  const block = sitemapSrc.match(/const STATIC_ROUTES: string\[\] = \[([\s\S]*?)\];/)?.[1] ?? "";
  const sitemapPaths = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  for (const p of sitemapPaths) {
    if (seen.has(p)) errors.push(`sitemap lists ${p} more than once.`);
    seen.add(p);
    if (!p.startsWith("/")) errors.push(`sitemap entry "${p}" must be a root-relative path.`);
    if (p !== "/" && p.endsWith("/")) errors.push(`sitemap entry "${p}" must not have a trailing slash.`);
    if (p !== "/" && !routePaths.has(p)) errors.push(`sitemap lists ${p} but no route file resolves to it.`);
    if (SITEMAP_EXCLUDED.has(p) && p !== "/blog") errors.push(`sitemap lists ${p}, which must stay out of the sitemap.`);
  }

  // Every public static route must be listed (or explicitly excluded).
  for (const rel of files) {
    if (rel.startsWith("_authenticated") || rel === "__root.tsx" || LAYOUT_FILES.has(rel)) continue;
    const p = routePathFromFile(rel);
    if (!p || SITEMAP_EXCLUDED.has(p)) continue;
    if (!seen.has(p)) errors.push(`${join(ROUTES_DIR, rel)} resolves to ${p} but is missing from the sitemap.`);
  }

  // Blog posts registry must line up with routes + sitemap.
  const blogSrc = read("src/lib/blog-posts.ts");
  for (const m of blogSrc.matchAll(/path:\s*"([^"]+)"/g)) {
    const p = m[1];
    if (!routePaths.has(p)) errors.push(`blog-posts.ts declares ${p} but no route file resolves to it.`);
    if (!seen.has(p)) errors.push(`blog-posts.ts declares ${p} but it is missing from the sitemap.`);
  }

  // ---- robots.txt ----------------------------------------------------------
  const robots = read("public/robots.txt");
  if (!/^User-agent: \*/m.test(robots)) errors.push("public/robots.txt is missing a `User-agent: *` block.");
  if (!/^Allow: \/$/m.test(robots)) errors.push("public/robots.txt must keep `Allow: /`.");
  if (/^Disallow: \/$/m.test(robots)) errors.push("public/robots.txt blocks the entire site (`Disallow: /`).");
  const sitemapDirective = robots.match(/^Sitemap:\s*(\S+)$/m)?.[1];
  if (sitemapDirective !== `${site}/sitemap.xml`) {
    errors.push(`public/robots.txt Sitemap directive must be ${site}/sitemap.xml (found: ${sitemapDirective}).`);
  }
  const disallows = [...robots.matchAll(/^Disallow:\s*(\S+)$/gm)].map((m) => m[1]).filter((d) => d !== "/");
  for (const p of sitemapPaths) {
    for (const d of disallows) {
      if (p === d || p.startsWith(d.endsWith("/") ? d : `${d}/`)) {
        errors.push(`sitemap lists ${p} but robots.txt disallows ${d}.`);
      }
    }
  }

  return {
    errors,
    stats: {
      routeFiles: files.length,
      publicChecked,
      canonicals: canonicalByUrl.size,
      sitemapPaths: sitemapPaths.length,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, stats } = auditSeoUrls();
  if (errors.length) {
    console.error(`\n✖ SEO URL audit failed (${errors.length} issue${errors.length > 1 ? "s" : ""}):\n`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error("");
    process.exit(1);
  }
  console.log(
    `✔ SEO URL audit passed — ${stats.publicChecked} public routes, ${stats.canonicals} unique canonicals, ${stats.sitemapPaths} sitemap paths.`,
  );
}
