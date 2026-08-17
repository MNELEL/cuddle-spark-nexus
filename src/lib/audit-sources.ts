// Shared `app_logs.source` values for admin audit trail entries.
export const AUDIT_SOURCE_INSTITUTIONS = "admin.institutions";
export const AUDIT_SOURCE_ROLES = "admin.roles";
export const AUDIT_SOURCE_TRIALS = "admin.trials";
/**
 * Teacher record changes: "teaching style & notes" edits and class↔teacher
 * assignment changes. Kept separate from `admin.roles` so the teachers screen
 * can show its own focused change history (who changed what, and when).
 */
export const AUDIT_SOURCE_TEACHERS = "admin.teachers";
/**
 * Sensitive student profiles. Writes and exports only — reads are NOT logged:
 * `getStudentProfile` runs on every student-sheet open, so logging views would
 * add a DB write per render and bury real changes under thousands of rows.
 */
export const AUDIT_SOURCE_STUDENT_PROFILES = "student_profiles.audit";
