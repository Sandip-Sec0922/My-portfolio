# Project guide: architecture, development, and cloud operations

This guide describes the current React/Vite and Express application and its target production architecture: Vercel for the SPA, Render for the API and Redis-compatible Key Value, and MongoDB Atlas for persistent application data. For findings and residual risks, see [codereview.md](./codereview.md), [the security checklist](./docs/security-checklist.md), and [the threat model](./docs/threat-model.md).

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
render.yaml        Render API and private Key Value Blueprint
client/vercel.json Vercel SPA/API/sitemap routing and browser security headers
docs/              Security checklist and threat model
```

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
| Cloud service wiring | `render.yaml` and `client/vercel.json` |

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
| Frontend | Vite dev server, typically `http://localhost:5173` | Vercel project rooted at `client/` |
| API | Node on `PORT` (default 10000; Compose sets 5000 locally) | Single Render web service using `server/Dockerfile` |
| MongoDB | Local MongoDB or test double | Atlas least-privilege database user |
| Redis | Local Redis-compatible service | External Upstash-compatible Redis URL in `REDIS_URL` |
| Secrets | Ignored local `.env` | Render secret environment variables |
| Public API path | Vite proxy `/api` | Vercel same-origin rewrite `/api/*` |

Use `.env.example` as a variable-name reference only. Replace all `change_me...` placeholders. Generate three distinct signing secrets of at least 32 characters. There is no bootstrap CLI or public admin-registration route; configure SMTP for the admin's email-based password recovery. Do not print, commit, email, or paste secrets into tickets or chat.

The database URI must use the least-privilege application account and identify the intended database. URL-encode URI-reserved password characters. Rotate credentials that have been exposed, and only configure replacement credentials through ignored local files or provider secret stores.

`TRUST_PROXY_HOPS` must match the deployed proxy chain. The API uses a conservative default of one hop and the Blueprint sets one; measure the client IP observed in Render logs and perform a spoof check before changing the value. An overly large value can let a client forge forwarding headers; an overly small value can collapse many visitors onto a proxy address.

## 4. Development and checks

1. Start local MongoDB and Redis-compatible services. The root Docker Compose file can be used for local testing; it is not the production deployment guide.
2. Configure ignored local environment variables and use `TRUST_PROXY_HOPS=0` when calling the API directly.
3. In `server/`, run `npm ci`, `npm test`, `npm run lint`, and `npm run dev`.
4. In `client/`, run `npm ci`, `npm run build`, and `npm run dev`.
5. Before a release, test public and admin routes, login/logout/refresh, contact validation and abuse controls, both themes, keyboard/focus behavior, reduced motion, mobile breakpoints, and browser console errors.

Use the smallest relevant test suite during iteration, then run the full API tests/lint and client production build. Configuration changes should also be checked against the provider's current Blueprint/project schema.

## 5. Cloud deployment

### Vercel

- Create a Vercel project from the repository with **Root Directory** `client` and the Vite framework preset.
- `client/vercel.json` defines `npm ci`, `npm run build`, `dist`, the SPA fallback, headers, and same-origin rewrites.
- The API and sitemap rewrites target `my-portfolio-tlnr.onrender.com`. The canonical frontend origin is `https://www.sandipkepchhaki.com.np`; production CORS also allows the existing Vercel frontend aliases.
- Set the public `VITE_TURNSTILE_SITE_KEY` only when enabling Turnstile. Never put a secret in the frontend environment.

### Render

- Create a Blueprint from `render.yaml`; it provisions one API web service only. Configure Atlas and external Redis through `MONGO_URI` and `REDIS_URL`. The Render readiness check is `/api/health`.
- Set all `sync: false` values in Render. Required values include `MONGO_URI`, `REDIS_URL`, and the three signing secrets. `CORS_ORIGINS` includes the exact custom-domain and existing Vercel origins; `PUBLIC_SITE_URL` uses the custom domain.
- The Blueprint uses free plans: Render may sleep the API after inactivity, and free Key Value is ephemeral. Redis restart/eviction clears active sessions and rate-limit counters. Choose paid plans if continuous uptime or persistent Redis state is required.
- After creating and changing the bootstrap admin password, remove the bootstrap email/password environment variables.
- Confirm `/api/health` returns 200 only when MongoDB and Redis can be pinged.

### MongoDB Atlas

- Create a database user limited to `readWrite` on the application database; never put an Atlas administrator account in `MONGO_URI`.
- Atlas must permit outbound connections from Render. Prefer private networking or static-egress IP allowlisting where available. A broad IP allowlist increases exposure and must be balanced against Render's outbound-IP plan.
- Verify database connectivity only after the URI and Atlas network access have been configured. No live connection is implied by a successful frontend build or local test.

### Same-origin and proxy validation

The browser must continue to call the Vercel origin. The rewrite keeps strict cookies same-site; direct browser requests to `onrender.com` are not an equivalent setup. Set `CORS_ORIGINS` to the exact Vercel/custom-domain origins. Then inspect Render logs for the API's view of the client address and test that a forged `X-Forwarded-For` is not accepted before adjusting proxy hops.

## 6. Release and operations

- Deploy only after server tests/lint and the client build pass.
- Confirm the API hostname, API rewrite, sitemap rewrite, custom-domain CORS origin, Turnstile pair, and health endpoints after deployment.
- Keep MongoDB backups in a protected location and test restoration. The selected Atlas plan's backup capabilities vary; do not assume free-tier backups.
- Review Render/Vercel deploy logs and security events after release. Avoid exporting contact records or IP-bearing event data to public logs.
- Rotate the bootstrap account password and provider credentials after compromise or disclosure. Changing JWT/CSRF secrets signs out sessions; Redis restarts may also invalidate them.
- Update [the threat model](./docs/threat-model.md) when trust boundaries, providers, data types, or integrations change.

## 7. Deferred controls and limitations

- Admin MFA is not implemented.
- Free Render plans are not an always-on production SLA; API cold starts affect the first request after inactivity.
- API rate limits remain active, but Nginx-only scanner filters and connection limits do not carry over to Vercel/Render.
- The sitemap lists published blog posts dynamically, but the client-rendered SPA is not fully server-rendered for search engines.
