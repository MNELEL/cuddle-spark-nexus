# CI guard: recipient filtering never breaks

## Goal
Every pull request must actually run the notification recipient-filtering tests. Today CI runs the whole suite, but if the database credentials are missing the DB-backed tests silently skip and the run still goes green — so a broken filter could slip through unnoticed.

## What to build

### 1. Dedicated CI job `notifications-guard`
New job in `.github/workflows/ci.yml`, running on every push and pull request alongside the existing `build` job:

- Checkout, set up Bun, `bun install --frozen-lockfile`.
- Fail fast with a clear error if `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` is missing, so the guard can never pass by skipping.
- Run only the notification suites, in a reporter mode that reports counts:
  - `src/test/notifications-flow.test.ts` (end-to-end recipient filtering, including the mismatched-recipient case and the institution-admin isolation case)
  - `src/test/rls-class-notifications.test.ts` (row-level policy coverage for the same table)
- Assert the run was not skipped: parse the JSON test report and fail when the number of passed tests is zero or any test is reported as skipped.
- Upload the JSON report as an artifact so a failure can be inspected from the PR.

### 2. Focused test script
Add `test:notifications` to `package.json` so the same command runs locally and in CI:

```
vitest run src/test/notifications-flow.test.ts src/test/rls-class-notifications.test.ts
```

### 3. Documentation
Short note in `MERGE_MEMORY.md` (section 12.4): the guard job exists, what it runs, and that it fails rather than skips when credentials are absent.

## Decisions already made
- Scope is `notifications-flow` (plus the matching RLS suite). No new MCP notification tool and no MCP-layer tests in this change.
- Missing credentials cause the run to fail, not to skip with a warning.

## Technical notes
- The DB-backed suites use `describe.skipIf(!hasTestEnv)` from `src/test/helpers.ts`; the credential precheck plus the zero-passed/any-skipped assertion is what converts a silent skip into a red build.
- `vitest.config.ts` already sets `fileParallelism: false` and 30s timeouts, so running two suites together is safe against the shared test fixtures.
- The existing `build` job keeps running the full suite; the guard job is an extra, faster signal specific to recipient filtering.
