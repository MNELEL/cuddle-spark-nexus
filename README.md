# הכיתה שלי — מערכת ניהול כיתה (TanStack Start)

## TanStack package versions (compatibility)

This project runs on TanStack Start v1. The `@tanstack/*` packages are tightly
coupled — bumping one without aligning the others typically breaks the build
(missing exports from `@tanstack/router-core`, route-tree type mismatches, or
SSR boot errors). Keep them in lockstep with the pinned baselines below.

| Package | Version (from `package.json`) | Notes |
| --- | --- | --- |
| `@tanstack/react-start` | `^1.168.32` | Server runtime + `createServerFn`. Baseline for the rest. |
| `@tanstack/react-router` | `^1.170.18` | Must be ≥ the router version shipped inside `react-start`. |
| `@tanstack/router-plugin` | `^1.167.28` | Vite plugin that regenerates `src/routeTree.gen.ts`. |
| `@tanstack/react-router-devtools` | `^1.167.0` | Dev-only; must match `react-router` majors. |
| `@tanstack/react-query` | `^5.83.0` | Independent of the router stack; safe to bump on its own. |

### Rules for upgrades

1. **Always upgrade `@tanstack/react-start` first**, then align
   `@tanstack/react-router`, `@tanstack/router-plugin`, and
   `@tanstack/react-router-devtools` to versions compatible with it.
2. **Never mix majors** across `react-start`, `react-router`, and
   `router-plugin`.
3. After upgrading, run a full build. If it fails with
   `"<symbol>" is not exported by "@tanstack/router-core"`, the router
   packages are out of sync — bump them to match `react-start`.
4. `@tanstack/react-query` can be upgraded independently.
5. Do not install `react-router-dom` or any alternative router — this
   project is fixed to `@tanstack/react-router`.

### Known-good baseline

The versions in the table above are the current known-good baseline verified
against Lovable Cloud (Cloudflare Worker SSR runtime) with `nodejs_compat`.

### Automated updates (Dependabot)

Dependency PRs are proposed by Dependabot (`.github/dependabot.yml`) under
rules that mirror this document:

- The entire router stack (`react-start`, `react-router`, `router-plugin`,
  `router-core`, `react-router-devtools`, `start-*`, `server-*`) is bumped
  in **one grouped PR** so versions can never drift apart.
- `@tanstack/react-query` gets its own PR (independent per rule 4).
- Major bumps of any router-stack package are **ignored** — do them by hand
  per the upgrade rules above.
- Every PR runs the CI workflow (`.github/workflows/ci.yml`):
  `bun run check:tanstack` → `tsgo --noEmit` → `bun run build`. A PR that
  breaks the compatibility rules fails CI and cannot be merged.