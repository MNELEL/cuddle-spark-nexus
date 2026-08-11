/**
 * Lighthouse CI configuration — Desktop profile.
 *
 * Audits the key public pages of "הכיתה שלי" against explicit category
 * thresholds. Authenticated routes are intentionally excluded: Lighthouse runs
 * with no session, so they would only ever measure the login redirect.
 *
 * The mobile counterpart lives in `lighthouserc.mobile.cjs`; both are derived
 * from `lighthouse-profiles.cjs`. The server is started separately by
 * `scripts/lighthouse.mjs` (a real workerd/wrangler run of the production
 * build) so scores reflect the deployed SSR output, not the dev server.
 */
module.exports = require("./lighthouse-profiles.cjs").buildConfig("desktop");
