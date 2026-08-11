/**
 * Lighthouse CI configuration — Mobile profile.
 *
 * Same public pages as the desktop run, but emulating a mid-range Android
 * phone with slow-4G network throttling and 4x CPU slowdown, so scores reflect
 * how the system actually behaves for teachers on a phone.
 */
module.exports = require("./lighthouse-profiles.cjs").buildConfig("mobile");
