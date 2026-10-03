# Code review and remediation record

**Scope:** the existing React/Vite/Tailwind/Framer Motion application, Express API, authentication, contact flow, integrations, deployment configuration, CI, and supplied documentation.

**Architecture:** separately deployed frontend and owner-managed/manual Express API. The live API host, proxy chain, and Redis provider are not established by this repository. Docker Compose/Nginx is an optional reference stack, not evidence of production infrastructure.

## Verified fixes

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| F-01 | Critical | Rate-limit Redis stores are constructed before Redis is ready | **Stale finding.** Current Redis client enables the offline queue and the server waits for Redis before listening. |
| F-02 | High | Mongo health could pass before initialization/auth setup completed | Mongo Compose health check now authenticates as the configured root user before reporting healthy. |
| F-03 | High | Placeholder signing/bootstrap secrets passed environment validation | API now rejects `change_me...` signing and bootstrap-password values without printing them. |
| F-04 | High | Admin bootstrap could race model unique-index creation | Mongo startup awaits initialization of registered model indexes before bootstrap. |
| F-05 | High | Wrong current password caused a pointless refresh and UI logout | The client refreshes/expires sessions only for `UNAUTHENTICATED`; `INVALID_CREDENTIALS` remains an action error. |
| F-06 | High | Proxy trust was hard-coded and not configurable | `TRUST_PROXY_HOPS` is configurable. The production hop count still requires measurement and a spoof test. |
| F-07 | Medium | HTML stripping mutated legitimate plain text | Plain-text schemas preserve input and reject unsupported controls; rendering remains escaped by React/Markdown. The unused `xss` dependency was removed. |
| F-08 | Medium | Turnstile token/widget was reused after form submit | Contact submission clears the token and remounts the widget after success or failure. |
| F-09 | Medium | `website` honeypot could be autofilled | Frontend uses the less-autofill-prone `companyWebsite`; the API temporarily accepts the old key for already-open forms. |
| F-10 | Medium | Error response could inherit a public cache header | Central error handling sets `Cache-Control: no-store`. |
| F-11 | Medium | Admin writes/password changes lacked an audit trail | Successful project/post/message mutations and password changes emit attributable security events. |
| F-12 | Medium | Refresh rotation could continue indefinitely | Refresh tokens retain their original authentication time and expire at a 30-day absolute session limit. |
| F-13 | Medium | Concurrent cache misses could stampede GitHub | GitHub refresh uses a Redis lock, an in-process single-flight promise, and stale-data fallback. |
| F-14 | Medium | Local Nginx HSTS/port behavior was presented as production evidence | **Out of production scope.** Cloud deployment uses provider-managed TLS; local Compose behavior is documented as local only. |
| F-15 | Medium | Redis command-renaming syntax was flagged | **Stale finding.** Current Compose Redis configuration does not use `rename-command`. |
| F-16 | Low | Login failure counter TTL was set separately from `INCR` | Counter initialization and increment now run in one Redis transaction. |
| F-17 | Low | First unknown-user login paid an extra Argon2 hash | Dummy hash is initialized during startup rather than on the first unknown-email request. |
| F-18 | Low | Route changes did not move keyboard/screen-reader focus | Route changes now focus the main landmark and continue respecting reduced motion. |
| F-19 | Low | `/auth/me` omitted the admin email | Authenticated user response now includes email and role. |
| F-20 | Low | Terminal animation did not provide reliable screen-reader text | Animated terminal is hidden from assistive technology and followed by a static text equivalent. |
| F-21 | Low | Nginx Compose startup waits for all local API replicas | **Local topology behavior, not used by the selected cloud deployment.** No production Nginx service is configured. |
| F-22 | Low | HTTPS URL validation allowed embedded credentials | HTTPS URLs now reject username/password components. |
| F-23 | Low | Static sitemap omitted published blog posts | Sitemap is generated from current public routes and published posts by the API and routed through Vercel. |
| CI-01 | High | Trivy referenced the wrong-case Nginx Dockerfile path | Workflow path now matches `Nginx/Dockerfile`. |
| CI-02 | Medium | Competing ESLint config files caused server lint startup errors | Duplicate CommonJS config was removed; the ESM flat config is authoritative. |

## Additional review notes

- `/api/health` checks live MongoDB and Redis connectivity; `/api/health/live` reports process liveness.
- Atlas contact-message persistence is present, but a live connection must be confirmed after deployment configuration.
- `client/vercel.json` targets the owner-confirmed API origin `https://my-portfolio-tlnr.onrender.com`. Health, proxy-hop count, CORS, and database connectivity still require live verification.
- Production Turnstile is mandatory in code, but its production site/secret key pair and allowed hostnames require operator configuration.
- The current MongoDB database selection is `test`; preserve it unless a migration is explicitly planned and verified.
- Rotate any credential exposed outside its secret store. Never repeat it in logs, docs, or commits.
- The actual API host, Atlas network access, frontend project root, production rewrite, proxy-hop count, CORS origins, and production secrets have not been live-validated by this code review.

## Residual risks

1. Admin MFA is not implemented.
2. API availability and Redis durability/restart behavior depend on the manually selected providers and remain unverified.
3. MongoDB may need a broad IP allowlist when backend egress is not static; private networking/static egress is preferred.
4. Proxy hops and client-IP spoof resistance must be verified against the actual deployed chain.
5. CI actions are version-tag pinned rather than immutable commit-SHA pinned.
6. The client-rendered SPA is not fully server-rendered for search engines.
7. `npm audit --omit=dev` reports two moderate React Router advisories; the available automatic fix requires a major-version upgrade, so the dependency was not changed without migration review.

See [the security checklist](./docs/security-checklist.md) for deployment verification and [the threat model](./docs/threat-model.md) for risk ownership.
