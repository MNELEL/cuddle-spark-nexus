/**
 * Shared Lighthouse CI profile definitions.
 *
 * The same public pages are audited twice: once with the desktop preset and
 * once with a throttled mobile profile (slow 4G + 4x CPU slowdown, Moto G
 * class screen) so real-world phone usage is covered, not just a fast laptop.
 * Mobile thresholds are lower on purpose — throttled runs are slower by
 * design — but SEO/accessibility expectations stay identical.
 */
const PATHS = [
  "/",
  "/login",
  "/tools",
  "/tools/exam-generator",
  "/blog",
  "/blog/classroom-management-strategies",
  "/help",
  "/partners/schools",
  "/privacy",
  "/content-policy",
];

// Audits that need a real HTTPS origin; the local worker serves plain http.
const SKIP_AUDITS = ["is-on-https", "redirects-http", "uses-http2", "canonical"];

const PROFILES = {
  desktop: {
    id: "desktop",
    label: "Desktop",
    port: "4178",
    lhciDir: ".lighthouseci/desktop",
    summaryFile: "lighthouse-summary.md",
    thresholds: {
      performance: 0.7,
      accessibility: 0.9,
      "best-practices": 0.9,
      seo: 1.0,
    },
    settings: {
      preset: "desktop",
      formFactor: "desktop",
      screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
      throttlingMethod: "simulate",
      throttling: {
        rttMs: 40,
        throughputKbps: 10 * 1024,
        cpuSlowdownMultiplier: 1,
        requestLatencyMs: 40 * 3.75,
        downloadThroughputKbps: 10 * 1024 * 0.9,
        uploadThroughputKbps: 10 * 1024 * 0.9,
      },
    },
  },
  mobile: {
    id: "mobile",
    label: "Mobile",
    port: "4179",
    lhciDir: ".lighthouseci/mobile",
    summaryFile: "lighthouse-summary-mobile.md",
    // Throttled mobile is inherently slower; performance bar is lower, but
    // accessibility / best practices / SEO must hold up on phones too.
    thresholds: {
      performance: 0.5,
      accessibility: 0.9,
      "best-practices": 0.9,
      seo: 1.0,
    },
    settings: {
      formFactor: "mobile",
      screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 2.625, disabled: false },
      emulatedUserAgent:
        "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      throttlingMethod: "simulate",
      // Lighthouse's standard "slow 4G" mobile throttling.
      throttling: {
        rttMs: 150,
        throughputKbps: 1.6 * 1024,
        requestLatencyMs: 150 * 3.75,
        downloadThroughputKbps: 1.6 * 1024 * 0.9,
        uploadThroughputKbps: 750 * 0.9,
        cpuSlowdownMultiplier: 4,
      },
    },
  },
};

/** Builds a full lhci config object for one profile. */
function buildConfig(profileId) {
  const profile = PROFILES[profileId];
  if (!profile) throw new Error(`Unknown Lighthouse profile: ${profileId}`);
  const baseUrl =
    process.env[`LHCI_BASE_URL_${profileId.toUpperCase()}`] ||
    process.env.LHCI_BASE_URL ||
    `http://127.0.0.1:${profile.port}`;

  return {
    profile: profileId,
    label: profile.label,
    paths: PATHS,
    thresholds: profile.thresholds,
    baseUrl,
    lhciDir: profile.lhciDir,
    summaryFile: profile.summaryFile,
    ci: {
      collect: {
        url: PATHS.map((p) => `${baseUrl}${p}`),
        numberOfRuns: 2,
        settings: {
          // Hebrew RTL site: keep the locale explicit so audits such as
          // `html-has-lang` and `valid-lang` are evaluated as intended.
          locale: "en-US",
          chromeFlags: "--no-sandbox --disable-dev-shm-usage --headless=new",
          skipAudits: SKIP_AUDITS,
          ...profile.settings,
        },
      },
      assert: {
        assertions: Object.fromEntries(
          Object.entries(profile.thresholds).map(([category, minScore]) => [
            `categories:${category}`,
            ["error", { minScore }],
          ]),
        ),
      },
      upload: {
        target: "filesystem",
        outputDir: `${profile.lhciDir}/reports`,
        reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%",
      },
    },
  };
}

module.exports = { PATHS, PROFILES, SKIP_AUDITS, buildConfig };
