#!/usr/bin/env node
/**
 * Runs Lighthouse CI against a production build of the app.
 *
 * 1. builds (unless --skip-build / LHCI_SKIP_BUILD=1)
 * 2. serves dist/ with the real workerd runtime via `wrangler dev`
 * 3. runs `lhci autorun` with the thresholds in lighthouserc.cjs
 * 4. writes a Markdown summary (lighthouse-summary.md) for the PR report
 *
 * Exits non-zero when any configured category threshold is missed.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const config = require("../lighthouserc.cjs");
const { summaryFromDisk } = await import("./lighthouse-summary.mjs");

const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build") || process.env.LHCI_SKIP_BUILD === "1";
const url = new URL(config.baseUrl);
const PORT = url.port || "4178";
const HOST = url.hostname;
const SUMMARY_FILE = process.env.LHCI_SUMMARY_FILE || "lighthouse-summary.md";

function run(command, commandArgs, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, commandArgs, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => resolvePromise(code ?? 1));
  });
}

async function waitForServer(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(config.baseUrl, { redirect: "manual" });
      if (res.status > 0) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function main() {
  rmSync(".lighthouseci", { recursive: true, force: true });
  mkdirSync(".lighthouseci", { recursive: true });

  if (!skipBuild) {
    console.log("→ building production bundle…");
    const code = await run("npx", ["--yes", "vite", "build"]);
    if (code !== 0) {
      console.error("::error::Production build failed; Lighthouse cannot run.");
      process.exit(code);
    }
  }

  console.log(`→ serving dist/ on ${config.baseUrl} (workerd)…`);
  const server = spawn(
    "npx",
    [
      "--yes",
      "wrangler",
      "dev",
      "--config",
      "dist/server/wrangler.json",
      "--port",
      String(PORT),
      "--ip",
      HOST,
      "--local",
    ],
    { stdio: ["ignore", "pipe", "pipe"], detached: true },
  );
  server.stdout?.on("data", (d) => process.stdout.write(`[server] ${d}`));
  server.stderr?.on("data", (d) => process.stderr.write(`[server] ${d}`));

  const stopServer = () => {
    try {
      if (server.pid) process.kill(-server.pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  };
  process.on("exit", stopServer);
  process.on("SIGINT", () => {
    stopServer();
    process.exit(130);
  });

  if (!(await waitForServer())) {
    console.error(`::error::Server never became reachable at ${config.baseUrl}.`);
    stopServer();
    process.exit(1);
  }

  console.log("→ running Lighthouse CI…");
  const lhciCode = await run("npx", ["--yes", "lhci", "autorun", "--config=lighthouserc.cjs"], {
    env: { ...process.env, LHCI_BASE_URL: config.baseUrl },
  });

  stopServer();

  const { markdown, rows, failures } = summaryFromDisk(config.thresholds);
  writeFileSync(SUMMARY_FILE, `${markdown}\n`);
  console.log(`\n${markdown}`);
  console.log(`→ summary written to ${SUMMARY_FILE} (${rows.length} page(s) audited)`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, { flag: "a" });
  }

  if (failures.length || lhciCode !== 0) {
    for (const f of failures) {
      console.error(
        `::error::Lighthouse ${f.category} ${Math.round(f.score * 100)} on ${f.path} is below the required ${Math.round(f.threshold * 100)}.`,
      );
    }
    process.exit(1);
  }
  process.exit(0);
}

await main();
