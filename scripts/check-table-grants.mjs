#!/usr/bin/env node
/**
 * Grant / RLS audit for the `public` schema.
 *
 * Three ways a table can be quietly wrong:
 *   1. it has a GRANT to `anon` (readable without signing in) and is not on
 *      the explicit allowlist below,
 *   2. RLS is disabled entirely,
 *   3. RLS is enabled but the table has no policy at all (silently locked).
 *
 * Needs a direct Postgres connection (SUPABASE_DB_URL, or the PG* env vars).
 * Exits 0 with a notice when neither is present, so local machines and forked
 * PRs without secrets don't fail the build.
 */
import { execFileSync } from "node:child_process";

/** Tables that intentionally expose data to anonymous visitors. Keep empty unless proven. */
const ANON_ALLOWLIST = new Set(["checklist_leads", "partner_leads"]);

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl && !process.env.PGHOST) {
  console.log("• skipped: no SUPABASE_DB_URL / PGHOST — grant audit needs a direct DB connection");
  process.exit(0);
}

function q(sql) {
  const args = ["-At", "-F", "\t", "-c", sql];
  if (dbUrl) args.unshift(dbUrl);
  const out = execFileSync("psql", args, { encoding: "utf8" });
  return out.split("\n").filter(Boolean).map((l) => l.split("\t"));
}

// Read the ACL straight off pg_class: information_schema.role_table_grants only
// shows grants the *connected* role may see, so a restricted auditing role would
// report a clean sheet even when anon grants exist.
const anonGrants = q(`
  SELECT c.relname, string_agg(DISTINCT a.privilege_type, ',' ORDER BY a.privilege_type)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN LATERAL aclexplode(c.relacl) a
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND a.grantee = 'anon'::regrole::oid
  GROUP BY c.relname ORDER BY c.relname`);

const noRls = q(`
  SELECT c.relname FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  ORDER BY 1`);

const noPolicies = q(`
  SELECT c.relname FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname)
  ORDER BY 1`);

const errors = [];
for (const [table, privs] of anonGrants) {
  if (!ANON_ALLOWLIST.has(table)) errors.push(`anon has ${privs} on public.${table} (not allowlisted)`);
}
for (const [table] of noRls) errors.push(`RLS is disabled on public.${table}`);
for (const [table] of noPolicies) errors.push(`public.${table} has RLS but no policy at all — silently locked`);

if (errors.length > 0) {
  console.error(`✗ ${errors.length} grant/RLS problem(s):\n`);
  for (const e of errors) console.error(`  ${e}`);
  console.error(
    "\nFix: revoke the anon GRANT (or add the table to ANON_ALLOWLIST when public access is intended),\n" +
      "enable RLS, and add explicit policies in a migration.",
  );
  process.exit(1);
}

console.log(
  `✓ grant/RLS audit: no anon grants, RLS enabled with policies on every public table ` +
    `(${anonGrants.length} anon-granted, ${noRls.length} without RLS, ${noPolicies.length} policyless)`,
);
