# Dependency migration record

**Reviewed:** 2026-10-03. This is a staged migration record, not approval to upgrade every dependency or evidence that a production deployment has been rebuilt.

## Current baseline

The exact versions below come from the committed lockfiles; manifests may allow a range, while `npm ci` installs the lockfile version.

| Area | Locked version(s) | Notes |
|---|---|---|
| Node.js | API engine `>=22`; CI uses Node 24 | Keep CI/runtime support aligned and test the actual hosting runtime. |
| React / React DOM | 18.3.1 | No React major upgrade is proposed in this stage. |
| React Router DOM | 7.18.4 | Upgraded from 6.30.6 in this worktree to remediate the two moderate router advisories; routing, E2E, build, and production audit passed. |
| Vite | 6.4.3 | Current CI runs the production build; confirm supported Node/runtime range before a major update. |
| Framer Motion | 11.18.2 | Used for transitions and reduced-motion-aware components. |
| Tailwind CSS | 3.4.19 manifest range | Existing utility-based styling; a major styling migration is not justified by the audit alone. |
| Express | 4.22.3 | API uses Express 4 middleware/router semantics. |
| Mongoose | 8.24.4 | MongoDB ODM; model indexes and lifecycle are tied to current query patterns. |
| ioredis | 5.11.1 | Required for sessions, rate limits, cache, and security counters. |
| jsonwebtoken | 9.0.3 | Access/refresh verification explicitly allowlists HS256 and issuer/audience. |
| Zod | 3.25.76 | Request schemas are shared by validation middleware and controllers. |
| Three.js / React Three Fiber | Not installed | Do not add until a static/CSS topology is assessed and its performance/accessibility value is clear. |

## Existing validation pipeline

CI runs server `npm ci`, ESLint, Jest, and `npm audit --omit=dev --audit-level=high`; client CI runs `npm ci`, Node unit tests, Playwright Chromium E2E, Vite production build, and the same high-severity production dependency threshold. The client has no lint/typecheck script, and neither package exposes a TypeScript build/typecheck script.

For each future dependency update, use the repository's actual scripts and run:

1. Review the changelog, peer requirements, Node support, and advisory fix version.
2. Update one direct dependency family at a time; regenerate only the relevant lockfile using npm.
3. Run the affected unit/integration tests and lint where available.
4. Run the client build and E2E for frontend/router changes; run the full server suite for API/security/runtime dependencies.
5. Run production dependency audit and inspect whether remaining findings are reachable, fixed, or explicitly documented.
6. Review `git diff --check`, the lockfile delta, and the final route/API behavior before merging.

## Migration decisions

### React Router advisory

Before the Router migration, `npm audit --omit=dev --audit-level=moderate` reported:

- `GHSA-wrjc-x8rr-h8h6`: backslash-based open redirect in `<Link>` / `useNavigate`.
- `GHSA-337j-9hxr-rhxg`: constructor injection in React Router SSR hydration error deserialization.

The lockfile now resolves `react-router-dom` 7.18.4. The SSR hydration advisory is not directly exercised by this client-rendered SPA, but the navigation advisory warranted the major-version upgrade. The migration passed client unit tests, all 6 Playwright tests, and the Vite production build; the production dependency audit now reports 0 vulnerabilities. Keep these checks as the regression baseline.

### Tailwind development dependency tree

The full client audit (including development dependencies) still reports 5 high findings, including `GHSA-vfj7-8cjw-p6xm` in `braces` through Tailwind CSS 3.4.19's `chokidar`/`fast-glob`/`micromatch` dependency tree. `npm audit --omit=dev --audit-level=moderate` is clean, so these findings are not in the production runtime bundle. npm's automatic recommendation requires Tailwind CSS 4, a major styling/configuration migration. Keep this as a separate change; evaluate a safe compatible transitive update first, otherwise test Tailwind 4 independently across CSS compilation and visual regressions. Do not treat the production-only clean audit as a clean full dependency tree.

### Other upgrades

No broad React, Vite, Tailwind, Express, Mongoose, or Redis upgrade is proposed by this audit. Continue routine compatible patch/minor updates through lockfile review and CI. Consider major versions only to address a specific security/adoption need or after establishing a measured benefit.

### 3D dependencies

Three.js and React Three Fiber are not currently dependencies. The visual brief prioritizes content, accessibility, performance, and SEO above 3D; avoid introducing WebGL bundle/runtime cost until a lightweight static/CSS security topology has been validated. If 3D is later approved, load it lazily, respect reduced motion, detect unsupported devices, and retain a useful no-WebGL fallback.

## Verification record

- Prior repository validation recorded: server Jest/ESLint, client unit tests, Playwright E2E, and production build passed.
- After Router v7 migration: client production audit reports 0 vulnerabilities at the moderate threshold. The full client audit still reports the Tailwind-related dev-only findings above. The server production dependency audit previously reported no vulnerabilities.
- These are point-in-time results. Re-run audit commands before an upgrade or release; package advisories can change without code changes.
