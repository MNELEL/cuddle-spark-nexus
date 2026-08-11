/**
 * Lighthouse CI configuration.
 *
 * Audits the key public pages of "הכיתה שלי" against explicit category
 * thresholds. Authenticated routes are intentionally excluded: Lighthouse runs
 * with no session, so they would only ever measure the login redirect.
 *
 * The server is started separately by `scripts/lighthouse.mjs` (a real
 * workerd/wrangler run of the production build) so scores reflect the
 * deployed SSR output, not the dev server.
 */
const BASE_URL = process.env.LHCI_BASE_URL || "http://127.0.0.1:4178";

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

// Minimum category scores (0-1). Raise these as the site improves — never
// lower one to make a red build pass without agreeing on the regression.
const CATEGORY_THRESHOLDS = {
  performance: 0.7,
  accessibility: 0.9,
  "best-practices": 0.9,
  seo: 1.0,
};

module.exports = {
  ci: {
    collect: {
      url: PATHS.map((p) => `${BASE_URL}${p}`),
      numberOfRuns: 2,
      settings: {
        preset: "desktop",
        // Hebrew RTL site: keep the locale explicit so audits such as
        // `html-has-lang` and `valid-lang` are evaluated as intended.
        locale: "en-US",
        chromeFlags: "--no-sandbox --disable-dev-shm-usage --headless=new",
        skipAudits: [
          // Needs a real HTTPS origin; the local worker serves plain http.
          "is-on-https",
          "redirects-http",
          "uses-http2",
          "canonical",
        ],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: CATEGORY_THRESHOLDS.performance }],
        "categories:accessibility": ["error", { minScore: CATEGORY_THRESHOLDS.accessibility }],
        "categories:best-practices": ["error", { minScore: CATEGORY_THRESHOLDS["best-practices"] }],
        "categories:seo": ["error", { minScore: CATEGORY_THRESHOLDS.seo }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci/reports",
      reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%",
    },
  },
  // Exported for the summary generator and the test suite.
  paths: PATHS,
  thresholds: CATEGORY_THRESHOLDS,
  baseUrl: BASE_URL,
};
