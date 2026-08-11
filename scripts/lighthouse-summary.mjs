#!/usr/bin/env node
/**
 * Turns Lighthouse CI output into a Markdown table for the PR comment /
 * job summary. Reads `.lighthouseci/manifest.json` (written by `lhci collect`)
 * and `.lighthouseci/assertion-results.json` (written by `lhci assert` when
 * something fails).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const LHCI_DIR = process.env.LHCI_DIR || ".lighthouseci";
const CATEGORY_KEYS = ["performance", "accessibility", "best-practices", "seo"];
const CATEGORY_LABELS = {
  performance: "Performance",
  accessibility: "Accessibility",
  "best-practices": "Best Practices",
  seo: "SEO",
};

/** Emoji verdict for a score against its threshold. */
export function verdict(score, threshold) {
  if (score === null || score === undefined) return "❔";
  if (score + 1e-9 >= threshold) return "✅";
  return score >= threshold - 0.1 ? "⚠️" : "❌";
}

export function pct(score) {
  return score === null || score === undefined ? "—" : `${Math.round(score * 100)}`;
}

/** Collapses multiple runs per URL into the median run Lighthouse marked. */
export function pickRuns(manifest) {
  const byUrl = new Map();
  for (const entry of manifest) {
    const url = entry.url;
    const current = byUrl.get(url);
    if (!current || entry.isRepresentativeRun) byUrl.set(url, entry);
  }
  return [...byUrl.values()];
}

export function buildSummary({ manifest, assertions = [], thresholds, label = "" }) {
  const runs = pickRuns(manifest);
  const rows = runs.map((run) => {
    const path = new URL(run.url).pathname || "/";
    const scores = Object.fromEntries(
      CATEGORY_KEYS.map((key) => [key, run.summary?.[key] ?? null]),
    );
    return { path, url: run.url, scores };
  });
  rows.sort((a, b) => a.path.localeCompare(b.path));

  const failures = rows.flatMap((row) =>
    CATEGORY_KEYS.filter(
      (key) => row.scores[key] !== null && row.scores[key] + 1e-9 < thresholds[key],
    ).map((key) => ({ path: row.path, category: key, score: row.scores[key], threshold: thresholds[key] })),
  );

  const header = `| Page | ${CATEGORY_KEYS.map((k) => CATEGORY_LABELS[k]).join(" | ")} |`;
  const divider = `| --- | ${CATEGORY_KEYS.map(() => "---").join(" | ")} |`;
  const body = rows
    .map(
      (row) =>
        `| \`${row.path}\` | ` +
        CATEGORY_KEYS.map(
          (key) => `${verdict(row.scores[key], thresholds[key])} ${pct(row.scores[key])}`,
        ).join(" | ") +
        " |",
    )
    .join("\n");

  const thresholdLine = CATEGORY_KEYS.map(
    (key) => `${CATEGORY_LABELS[key]} ≥ ${Math.round(thresholds[key] * 100)}`,
  ).join(" · ");

  const lines = [
    `## 🔎 Lighthouse${label ? ` — ${label}` : ""}`,
    "",
    `Thresholds: ${thresholdLine}. Scores are the median of the configured runs against a production build served by workerd.`,
    "",
    header,
    divider,
    body,
    "",
  ];

  if (failures.length) {
    lines.push(`### ❌ ${failures.length} threshold failure(s)`, "");
    for (const f of failures) {
      lines.push(
        `- \`${f.path}\` — ${CATEGORY_LABELS[f.category]} ${pct(f.score)} < ${Math.round(f.threshold * 100)}`,
      );
    }
    lines.push("");
  } else {
    lines.push("All audited pages meet every threshold.", "");
  }

  const otherAssertions = assertions.filter((a) => !String(a.auditId).startsWith("categories:"));
  if (otherAssertions.length) {
    lines.push(`<details><summary>${otherAssertions.length} other failed assertion(s)</summary>`, "");
    for (const a of otherAssertions.slice(0, 30)) {
      lines.push(`- \`${a.auditId}\` (${a.url ?? "?"}): expected ${a.operator} ${a.expected}, got ${a.actual}`);
    }
    lines.push("", "</details>", "");
  }

  return { markdown: lines.join("\n"), rows, failures };
}

function readJson(file, dir = LHCI_DIR) {
  const path = resolve(dir, file);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function summaryFromDisk(thresholds, { dir = LHCI_DIR, label = "" } = {}) {
  const manifest = readJson("manifest.json", dir);
  if (!manifest || !manifest.length) {
    return {
      markdown: `## 🔎 Lighthouse${label ? ` — ${label}` : ""}\n\nNo Lighthouse results were produced — the collection step failed before any page was audited.\n`,
      rows: [],
      failures: [],
    };
  }
  const assertions = readJson("assertion-results.json", dir) ?? [];
  return buildSummary({ manifest, assertions, thresholds, label });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const configFile = process.env.LHCI_CONFIG || "../lighthouserc.cjs";
  const cfg = await import(configFile).then((m) => m.default ?? m);
  const { markdown, failures } = summaryFromDisk(cfg.thresholds, {
    dir: process.env.LHCI_DIR || cfg.lhciDir,
    label: cfg.label,
  });
  process.stdout.write(`${markdown}\n`);
  if (failures.length) process.exitCode = 1;
}
