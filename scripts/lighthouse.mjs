#!/usr/bin/env node
/**
 * Runs Lighthouse CI against a production build of the app, in two profiles:
 * desktop and throttled mobile (slow 4G + 4x CPU).
 *
 * 1. builds once (unless --skip-build / LHCI_SKIP_BUILD=1)
 * 2. serves dist/ with the real workerd runtime via `wrangler dev`
 * 3. runs `lhci autorun` per profile with its own config + thresholds
 * 4. writes a Markdown summary per profile plus a combined one for the PR
 *
 * Usage: node scripts/lighthouse.mjs [--skip-build] [--profile desktop|mobile|both]
 * Exits non-zero when any configured category threshold is missed.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildConfig } = require("../lighthouse-profiles.cjs");
const { summaryFromDisk } = await import("./lighthouse-summary.mjs");

const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build") || process.env.LHCI_SKIP_BUILD === "1";
const profileArg =
  (args.includes("--profile") ? args[args.indexOf("--profile") + 1] : undefined) ||
  process.env.LHCI_PROFILE ||
  "both";
const profileIds = profileArg === "both" ? ["desktop", "mobile"] : [profileArg];
const CONFIG_FILES = { desktop: "lighthouserc.cjs", mobile: "lighthouserc.mobile.cjs" };
const COMBINED_FILE = process.env.LHCI_SUMMARY_FILE || "lighthouse-summary.md";

function run(command, commandArgs, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => resolvePromise(code ?? 1));
  });
}

async function waitForServer(baseUrl, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

function startServer(baseUrl) {
  const url = new URL(baseUrl);
  const server = spawn(
    "npx",
    [
      "--yes",
      "wrangler",
      "dev",
      "--config",
      "dist/server/wrangler.json",
      "--port",
      String(url.port || "4178"),
      "--ip",
      url.hostname,
      "--local",
    ],
    { stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  server.stdout?.on("data", (d) => process.stdout.write(`[server] ${d}`));
  server.stderr?.on("data", (d) => process.stderr.write(`[server] ${d}`));
  return server;
}

async function auditProfile(profileId) {
  const config = buildConfig(profileId);
  rmSync(config.lhciDir, { recursive: true, force: true });
  mkdirSync(config.lhciDir, { recursive: true });

  console.log(`\n=== Lighthouse ${config.label} profile ===`);
  console.log(`→ serving dist/ on ${config.baseUrl} (workerd)…`);
  const server = startServer(config.baseUrl);
  const stopServer = () => {
    try {
      if (server.pid) process.kill(-server.pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  };
  process.on("exit", stopServer);

  if (!(await waitForServer(config.baseUrl))) {
    console.error(`::error::Server never became reachable at ${config.baseUrl}.`);
    stopServer();
    return { config, markdown: `## 🔎 Lighthouse — ${config.label}\n\nServer never started.\n`, failures: [{ path: "-", category: "server", score: 0, threshold: 1 }], code: 1 };
  }

  console.log(`→ running Lighthouse CI (${config.label})…`);
  const code = await run("npx", ["--yes", "lhci", "autorun", `--config=${CONFIG_FILES[profileId]}`], {
    env: { ...process.env, LHCI_BASE_URL: config.baseUrl, LHCI_DIR: config.lhciDir },
  });
  stopServer();

  const { markdown, rows, failures } = summaryFromDisk(config.thresholds, {
    dir: config.lhciDir,
    label: config.label,
  });
  writeFileSync(config.summaryFile, `${markdown}\n`);
  console.log(`\n${markdown}`);
  console.log(`→ ${config.label} summary written to ${config.summaryFile} (${rows.length} page(s) audited)`);
  return { config, markdown, failures, code };
}

async function main() {
  if (!skipBuild) {
    console.log("→ building production bundle…");
    const code = await run("npx", ["--yes", "vite", "build"]);
    if (code !== 0) {
      console.error("::error::Production build failed; Lighthouse cannot run.");
      process.exit(code);
    }
  }

  const results = [];
  for (const profileId of profileIds) {
    results.push(await auditProfile(profileId));
  }

  const combined = results.map((r) => r.markdown).join("\n---\n\n");
  writeFileSync(COMBINED_FILE, `${combined}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${combined}\n`, { flag: "a" });
  }

  const failed = results.some((r) => r.failures.length || r.code !== 0);
  for (const r of results) {
    for (const f of r.failures) {
      console.error(
        `::error::Lighthouse ${r.config.label} ${f.category} ${Math.round(f.score * 100)} on ${f.path} is below the required ${Math.round(f.threshold * 100)}.`,
      );
    }
  }
  process.exit(failed ? 1 : 0);
}

await main();
