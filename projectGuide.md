# Project guide: architecture, development, and cloud operations

This guide describes the current React/Vite and Express application. The frontend and API are deployed separately; the owner manually hosts the API. The live API host, proxy chain, and Redis provider are not established by this repository. For findings and residual risks, see [codereview.md](./codereview.md), [the security checklist](./docs/security-checklist.md), and [the threat model](./docs/threat-model.md).

## 1. Design principles

1. Preserve existing routes, API contracts, admin behavior, and integrations when changing shared systems.
2. Keep secrets in environment/secret stores only. `VITE_*` configuration is public in the built frontend.
3. Validate untrusted input at API boundaries, keep normal text intact, and encode it at the output context.
4. Protect mutations with authentication, authorization, CSRF checks, input validation, and rate limits.
5. Give external dependencies explicit failure behavior. Do not silently report a successful write if persistence fails.
6. Add focused tests for security behavior and regression cases; update operational and threat-model documentation with the code.
7. Keep the portfolio factual: do not invent employment, certifications, clients, statistics, or achievements.

## 2. Architecture and ownership

```text
client/   React 18 + Vite + Tailwind + Framer Motion + React Router
server/   Express API, Mongoose models, Redis-compatible services, Jest tests
client/vercel.json Vercel SPA/API/sitemap routing and browser security headers
docs/              Security checklist and threat model
```

`docker-compose.yml` and Nginx describe an optional reference stack for local/self-managed use; they do not establish the production topology.

| Concern | Source of truth |
|---|---|
| Public routes and shared navigation | `client/src/App.jsx` |
| Static profile, skills, lab, and roadmap data | `client/src/data/` |
| API calls and cookie/CSRF/refresh behavior | `client/src/api/client.js` |
| Admin UI and session presentation | `client/src/admin/` |
| API routing and access control | `server/src/routes/` |
| Request validation | `server/src/validators/schemas.js` |
| HTTP request/response behavior | `server/src/controllers/` |
| Token, cache, contact, GitHub, and event logic | `server/src/services/` |
| Persistent schemas, indexes, and retention | `server/src/models/` |
| Environment validation and infrastructure clients | `server/src/config/` |
| Frontend rewrites and browser security headers | `client/vercel.json` |

### Backend boundaries

- Routes should compose middleware and controllers; public routes must be intentional.
- Admin routes inherit authentication, admin role checks, CSRF protection, and rate limits.
- Use strict Zod schemas with bounded values. Preserve legitimate text rather than stripping HTML; React and the Markdown renderer handle browser output safely.
- Cache keys must derive from validated, bounded inputs. Invalidate affected keys after successful writes.
- Admin mutations and password changes must produce attributable audit events without recording credentials or request bodies.
- Security-sensitive Redis failures must be explicit. Cache failures can be best-effort only where the source of truth remains available.

### Frontend boundaries

- Call the API through `client/src/api/client.js`; it applies the shared CSRF and single-flight refresh behavior.
- Admin routes are lazy-loaded and still require server-side authentication.
- Keep keyboard focus visible, route focus sensible, and animations compatible with `prefers-reduced-motion`.
- The animated terminal has a static accessible text equivalent.
- Render Markdown without raw HTML. Do not add untrusted `dangerouslySetInnerHTML`.
- Preserve the existing design system and do not add dependencies for effects that CSS or current libraries can provide.

## 3. Environments and secrets

| Setting | Local development | Production |
|---|---|---|
| Frontend | Vite dev server, typically `http://localhost:5173` | Separately deployed SPA (Vercel config is provided) |
| API | Node on `PORT` (default 10000; Compose sets 5000 locally) | Owner-managed/manual host using `server/Dockerfile` or equivalent |
| MongoDB | Local MongoDB or test double | Existing MongoDB deployment; preserve the `test` database unless migrated |
| Redis | Local Redis-compatible service | Owner-selected Redis-compatible service in `REDIS_URL` |
| Secrets | Ignored local `.env` | Secret environment variables on the API host |
| Public API path | Vite proxy `/api` | Same-origin frontend proxy `/api/*` to the manually hosted API |

Use `.env.example` as a variable-name reference only. Replace all `change_me...` placeholders. Generate three distinct signing secrets of at least 32 characters. There is no bootstrap CLI or public admin-registration route; configure Resend for the admin's email-based password recovery and contact notifications. Do not print, commit, email, or paste secrets into tickets or chat.

The database URI must use the least-privilege application account and identify the intended database. URL-encode URI-reserved password characters. Rotate credentials that have been exposed, and only configure replacement credentials through ignored local files or provider secret stores.

`TRUST_PROXY_HOPS` must match the actual deployed proxy chain. Measure the client IP observed by the API and perform a spoof check before setting it. An overly large value can let a client forge forwarding headers; an overly small value can collapse many visitors onto a proxy address.

## 4. Development and checks

1. Start local MongoDB and Redis-compatible services. The root Docker Compose file can be used for local testing; it is not the production deployment guide.
2. Configure ignored local environment variables and use `TRUST_PROXY_HOPS=0` when calling the API directly.
3. In `server/`, run `npm ci`, `npm test`, `npm run lint`, and `npm run dev`.
4. In `client/`, run `npm ci`, `npm test`, `npx playwright install chromium`, `npm run test:e2e`, and `npm run dev`. A production build also requires a public test key locally or the real public Turnstile site key in the deployment environment.
5. Before a release, test public and admin routes, login/logout/refresh, contact validation and abuse controls, both themes, keyboard/focus behavior, reduced motion, mobile breakpoints, and browser console errors.

Use the smallest relevant test suite during iteration, then run the full API tests/lint and client production build. Configuration changes should also be checked against the provider's current Blueprint/project schema.

## 5. Cloud deployment

### Frontend and API

- Configure the frontend host to serve the SPA and proxy `/api/*` plus `/sitemap.xml` to the actual manually hosted API. The checked-in Vercel rewrites target the owner-confirmed origin `https://my-portfolio-tlnr.onrender.com`; recheck them if the backend host changes.
- Keep browser API calls same-origin; the rewrite preserves the strict-cookie behavior. Set backend `CORS_ORIGINS` to the exact frontend origins.
- Set the public `VITE_TURNSTILE_SITE_KEY` for production builds and the matching `TURNSTILE_SECRET` on the API host. Configure all live frontend hostnames in the widget.
- Configure `MONGO_URI`, `REDIS_URL`, `CORS_ORIGINS`, `TRUST_PROXY_HOPS`, `PORT`, and three distinct signing secrets (32+ characters) on the API host. Production startup requires Turnstile configuration.
- Configure `RESEND_API_KEY` and a verified `RESEND_FROM`; contact notifications default to `sarunmgr77@gmail.com`. MongoDB persistence is independent of email delivery.
- Confirm `/api/health` returns ready only when MongoDB and Redis can be pinged; `/api/health/live` reports process liveness.
- Configure and remove any bootstrap credentials according to the API's environment validation. Do not assume a public registration flow exists.

### MongoDB Atlas

- Create a database user limited to `readWrite` on the application database; never put an Atlas administrator account in `MONGO_URI`.
- Atlas must permit connections from the manually hosted API. Prefer private networking or static-egress IP allowlisting where available. A broad IP allowlist increases exposure.
- Verify database connectivity only after the URI and Atlas network access have been configured. No live connection is implied by a successful frontend build or local test.

### Same-origin and proxy validation

The browser must continue to call the frontend origin. The rewrite keeps strict cookies same-site; direct browser requests to a separate API origin are not equivalent. Set `CORS_ORIGINS` to the exact frontend/custom-domain origins. Inspect API logs for the client address and test that forged `X-Forwarded-For` values are not accepted before adjusting proxy hops.

## 6. Release and operations

- Deploy only after server tests/lint and the client build pass.
- Confirm the API hostname, API rewrite, sitemap rewrite, custom-domain CORS origin, Turnstile pair, and health endpoints after deployment.
- Keep MongoDB backups in a protected location and test restoration. The selected Atlas plan's backup capabilities vary; do not assume free-tier backups.
- Review frontend and API deployment logs and security events after release. Avoid exporting contact records or IP-bearing event data to public logs.
- Rotate the bootstrap account password and provider credentials after compromise or disclosure. Changing JWT/CSRF secrets signs out sessions; Redis restarts may also invalidate them.
- Update [the threat model](./docs/threat-model.md) when trust boundaries, providers, data types, or integrations change.

## 7. Deferred controls and limitations

- Admin MFA is not implemented.
- Availability, cold starts, and Redis persistence depend on the selected providers and must be checked directly.
- API rate limits remain active; Nginx-only scanner filters and connection limits apply only if that reference stack is deployed.
- The sitemap lists published blog posts dynamically, but the client-rendered SPA is not fully server-rendered for search engines.
