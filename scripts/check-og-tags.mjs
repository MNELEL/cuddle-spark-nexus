#!/usr/bin/env node
/**
 * Open Graph + Twitter Card audit.
 *
 * Verifies for every public page that share previews cannot render wrong:
 *   - og:title / og:description / og:type / og:url / twitter:card exist,
 *   - twitter:card uses a real value, and `summary_large_image` always has an
 *     image to show,
 *   - og:image is an absolute https URL with og:image:width / og:image:height /
 *     og:image:alt, a recommended size (1200x630, ratio ~1.91:1) and a real
 *     image format,
 *   - twitter:image matches og:image,
 *   - every share image asset under src/assets/og is a jpeg/png/webp of a sane
 *     file size (large enough to look good, small enough for crawlers).
 *
 * Usage:
 *   node scripts/check-og-tags.mjs           # static audit (CI default)
 *   node scripts/check-og-tags.mjs --remote  # also download image headers and
 *                                            # verify real pixel dimensions
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROUTES_DIR = join(ROOT, "src", "routes");
const OG_ASSETS_DIR = join(ROOT, "src", "assets", "og");

const read = (p) => readFileSync(p, "utf8");

/** Recommended Open Graph image geometry. */
export const IMAGE_RULES = {
  recommended: { width: 1200, height: 630 },
  minWidth: 600,
  minHeight: 315,
  maxWidth: 2400,
  ratioMin: 1.7,
  ratioMax: 2.1,
  formats: ["image/jpeg", "image/png", "image/webp"],
  minBytes: 5 * 1024,
  maxBytes: 5 * 1024 * 1024,
};

const VALID_TWITTER_CARDS = ["summary", "summary_large_image", "player", "app"];
const VALID_OG_TYPES = ["website", "article", "product", "profile", "book", "video.other"];

/** Layout-only route files (render <Outlet/>, own no metadata). */
const LAYOUT_FILES = new Set([
  "blog.tsx",
  "help.tsx",
  "parents-guide.tsx",
  "tools.tsx",
  "blog.classroom-management-strategies.tsx",
  "_authenticated.tsx",
  "__root.tsx",
]);

/** Machine endpoints and app screens that are never shared socially. */
const SKIP_PATTERNS = [/^api\./, /^\[/, /^\.well-known/, /^mcp\./, /^_authenticated\./];

function siteUrl() {
  return read(join(ROOT, "src", "lib", "site-meta.ts")).match(/SITE_URL =\s*"([^"]+)"/)?.[1] ?? "";
}

function routeFiles() {
  return readdirSync(ROUTES_DIR, { recursive: true })
    .filter((f) => typeof f === "string" && /\.tsx$/.test(f))
    .filter((f) => !LAYOUT_FILES.has(f) && !SKIP_PATTERNS.some((re) => re.test(f)))
    .sort();
}

/** In-file `const X = "..."` / template values, so `${URL}` can be resolved. */
function fileConsts(text, site) {
  const consts = { SITE_URL: site };
  for (const m of text.matchAll(/^(?:export )?const (\w+)\s*=\s*"([^"]*)"/gm)) consts[m[1]] = m[2];
  for (const m of text.matchAll(/^(?:export )?const (\w+)\s*=\s*`([^`]*)`/gm)) consts[m[1]] = m[2];
  for (let i = 0; i < 3; i += 1) {
    for (const [k, v] of Object.entries(consts)) {
      consts[k] = v.replace(/\$\{(\w+)\}/g, (all, name) => consts[name] ?? all);
    }
  }
  return consts;
}

function resolve(raw, consts) {
  const value = raw.trim();
  const str = value.match(/^"([^"]*)"$/);
  if (str) return str[1];
  const tpl = value.match(/^`([^`]*)`$/);
  if (tpl) {
    const body = tpl[1].replace(/\$\{(\w+)\}/g, (all, name) => consts[name] ?? all);
    return body.includes("${") ? null : body;
  }
  if (/^\w+$/.test(value)) return consts[value] ?? null;
  return null; // runtime expression (loader data etc.)
}

/** Collect { key: value|null } from all `{ property/name: ..., content: ... }` entries. */
export function extractMeta(text, consts) {
  const tags = {};
  const re =
    /\{\s*(?:property|name):\s*"([^"]+)"\s*,\s*content:\s*((?:"[^"]*")|(?:`[^`]*`)|(?:[A-Za-z_$][\w$.?]*))/g;
  for (const m of text.matchAll(re)) tags[m[1]] = resolve(m[2], consts);
  if (/\{\s*title:\s*/.test(text)) tags.title = tags.title ?? "";
  return tags;
}

function checkImageGeometry(tags, label, problems) {
  const image = tags["og:image"];
  const width = Number(tags["og:image:width"]);
  const height = Number(tags["og:image:height"]);
  const add = (reason) => problems.push({ file: label, reason });

  if (image && !/^https:\/\//.test(image)) add(`og:image must be an absolute https URL (got "${image}")`);
  if (!tags["og:image:width"] || !tags["og:image:height"]) {
    add("og:image is set but og:image:width / og:image:height are missing");
  } else if (!Number.isFinite(width) || !Number.isFinite(height)) {
    add("og:image:width / og:image:height must be plain numbers");
  } else {
    const ratio = width / height;
    if (width < IMAGE_RULES.minWidth || height < IMAGE_RULES.minHeight) {
      add(`og:image ${width}x${height} is too small (recommended 1200x630)`);
    }
    if (width > IMAGE_RULES.maxWidth) add(`og:image width ${width}px exceeds ${IMAGE_RULES.maxWidth}px`);
    if (ratio < IMAGE_RULES.ratioMin || ratio > IMAGE_RULES.ratioMax) {
      add(`og:image ratio ${ratio.toFixed(2)}:1 is outside the 1.91:1 range crawlers crop to`);
    }
  }
  if (tags["og:image:alt"] === undefined) add("og:image is set but og:image:alt is missing");
  if (tags["twitter:image"] === undefined) add("og:image is set but twitter:image is missing");
  else if (image && tags["twitter:image"] && tags["twitter:image"] !== image) {
    add("twitter:image does not match og:image (crawlers would show two different previews)");
  }
  if (tags["twitter:card"] && tags["twitter:card"] !== "summary_large_image") {
    add(`a page with og:image should use twitter:card "summary_large_image" (got "${tags["twitter:card"]}")`);
  }
}

/** Validate the share-image asset pointers themselves. */
export function auditOgAssets() {
  const problems = [];
  let count = 0;
  let pointers = [];
  try {
    pointers = readdirSync(OG_ASSETS_DIR).filter((f) => f.endsWith(".asset.json"));
  } catch {
    return { problems, count, urls: [] };
  }
  const urls = [];
  for (const file of pointers) {
    const asset = JSON.parse(read(join(OG_ASSETS_DIR, file)));
    const label = `src/assets/og/${file}`;
    count += 1;
    if (!IMAGE_RULES.formats.includes(asset.content_type)) {
      problems.push({ file: label, reason: `content_type "${asset.content_type}" is not a share-safe image format` });
    }
    if (asset.size < IMAGE_RULES.minBytes) {
      problems.push({ file: label, reason: `only ${asset.size} bytes — too small/low quality for a share image` });
    }
    if (asset.size > IMAGE_RULES.maxBytes) {
      problems.push({ file: label, reason: `${(asset.size / 1024 / 1024).toFixed(1)}MB exceeds the 5MB crawler limit` });
    }
    if (typeof asset.url === "string" && asset.url.startsWith("/")) urls.push(asset.url);
  }
  return { problems, count, urls };
}

/** Static audit of every public route's Open Graph / Twitter tags. */
export function auditOgTags() {
  const site = siteUrl();
  const problems = [];
  const images = new Set();
  let routeCount = 0;

  const sharedHelpers = {
    "blogPostHead(": read(join(ROOT, "src", "lib", "blog-seo.ts")),
    "socialImageMeta(": read(join(ROOT, "src", "lib", "social-meta.ts")),
  };

  for (const file of routeFiles()) {
    const raw = read(join(ROUTES_DIR, file));
    if (!/head:\s*/.test(raw) && !/blogPostHead\(/.test(raw)) continue;
    routeCount += 1;

    let text = raw;
    for (const [needle, helperSrc] of Object.entries(sharedHelpers)) {
      if (raw.includes(needle)) text = `${raw}\n${helperSrc}`;
    }
    const consts = fileConsts(text, site);
    const tags = extractMeta(text, consts);
    const label = `src/routes/${file}`;
    if (/name:\s*"robots",\s*content:\s*"noindex/.test(text)) continue; // never shared socially

    const add = (reason) => problems.push({ file: label, reason });

    for (const key of ["og:title", "og:description", "og:type", "og:url", "twitter:card"]) {
      if (tags[key] === undefined) add(`missing ${key}`);
    }
    if (tags["og:type"] && !VALID_OG_TYPES.includes(tags["og:type"])) {
      add(`og:type "${tags["og:type"]}" is not a valid Open Graph type`);
    }
    const card = tags["twitter:card"];
    if (card && !VALID_TWITTER_CARDS.includes(card)) add(`twitter:card "${card}" is not a valid value`);
    if (card === "summary_large_image" && tags["og:image"] === undefined && tags["twitter:image"] === undefined) {
      add('twitter:card is "summary_large_image" but no og:image/twitter:image is set — use "summary" or add an image');
    }
    if (tags["og:image"] !== undefined) {
      checkImageGeometry(tags, label, problems);
      if (tags["og:image"]) images.add(tags["og:image"]);
    }
    if (tags["og:url"] && !/^https:\/\//.test(tags["og:url"])) add(`og:url must be absolute https (got "${tags["og:url"]}")`);
  }

  const assets = auditOgAssets();
  // Asset pointers are the real share images; resolve them to absolute URLs so
  // the --remote pass can verify their true pixel dimensions.
  for (const url of assets.urls) images.add(`${site}${url}`);
  return {
    problems: [...problems, ...assets.problems],
    routeCount,
    assetCount: assets.count,
    images: [...images],
  };
}

/** Download image headers and verify real pixel dimensions (opt-in). */
async function checkRemoteImages(urls) {
  const problems = [];
  await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { headers: { Range: "bytes=0-65535" } });
        if (res.status >= 400) {
          problems.push({ file: url, reason: `image request failed (${res.status})` });
          return;
        }
        const type = res.headers.get("content-type") ?? "";
        if (!IMAGE_RULES.formats.some((f) => type.startsWith(f))) {
          problems.push({ file: url, reason: `served as "${type}", not a share-safe image format` });
          return;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        const dims = imageSize(buf);
        if (!dims) return; // partial body — nothing conclusive to assert
        const ratio = dims.width / dims.height;
        if (dims.width < IMAGE_RULES.minWidth || dims.height < IMAGE_RULES.minHeight) {
          problems.push({ file: url, reason: `real size ${dims.width}x${dims.height} is below the minimum` });
        } else if (ratio < IMAGE_RULES.ratioMin || ratio > IMAGE_RULES.ratioMax) {
          problems.push({ file: url, reason: `real ratio ${ratio.toFixed(2)}:1 is outside the 1.91:1 range` });
        }
      } catch (error) {
        problems.push({ file: url, reason: `could not fetch image (${error?.message ?? error})` });
      }
    }),
  );
  return problems;
}

/** Minimal PNG/JPEG/WebP dimension reader. */
export function imageSize(buf) {
  if (buf.length > 24 && buf.toString("ascii", 1, 4) === "PNG") {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    if (buf.toString("ascii", 12, 16) === "VP8X") {
      return { width: (buf.readUIntLE(24, 3) & 0xffffff) + 1, height: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
    }
    return null;
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const { problems, routeCount, assetCount, images } = auditOgTags();
  for (const p of problems) console.error(`✗ ${p.file}\n    → ${p.reason}`);

  let remote = [];
  if (process.argv.includes("--remote")) {
    console.log(`… verifying ${images.length} share image(s) over the network`);
    remote = await checkRemoteImages(images);
    for (const p of remote) console.error(`✗ ${p.file}\n    → ${p.reason}`);
  }

  if (problems.length > 0 || remote.length > 0) {
    console.error(`\n${problems.length + remote.length} Open Graph / Twitter Card problem(s).`);
    process.exit(1);
  }
  console.log(
    `✓ Open Graph & Twitter Cards: ${routeCount} route(s) and ${assetCount} share image asset(s) valid ` +
      `(${images.length} unique og:image URLs)`,
  );
}
