# SOC Security Portfolio

A cybersecurity/SOC learning portfolio built with React, Vite, Tailwind CSS, Framer Motion, Express, MongoDB, and Redis-compatible storage. The application keeps its existing routes, admin dashboard, GitHub/blog integrations, contact protections, and security-event views.

The frontend and backend are deployed separately. The owner manually manages the Express API, and the frontend's same-origin rewrites target the owner-confirmed API origin `https://my-portfolio-tlnr.onrender.com`. This configuration does not prove live health, proxy-hop count, or Redis provider settings. Docker Compose/Nginx describes an optional self-hosted reference stack, not proof of the live topology.

## Features

- Public portfolio routes: Home, Projects, Lab, Roadmap, Blog, Security, and Contact.
- Admin routes for project/post management, contact messages, security events, and password changes.
- Server-side GitHub data retrieval and cache, Markdown blog content, and contact-message persistence.
- HttpOnly authentication cookies, CSRF checks, rate limiting, login lockout, Turnstile integration, and a contact honeypot.
- Responsive light/dark theme, keyboard navigation, reduced-motion support, and animated route transitions.

## Architecture

```text
Browser
  └── separately deployed React/Vite application
        └── same-origin /api/* and /sitemap.xml proxy (configured by owner)
              └── manually hosted Express API
                    ├── MongoDB: users, content, messages, security events
                    ├── Redis-compatible service: sessions, rate limits, lockout, caches
                    └── GitHub / Turnstile / Resend integrations
```

Keep browser API traffic on the frontend origin so `SameSite=Strict` authentication cookies work. The Vercel configuration proxies `/api/*` and `/sitemap.xml` to the owner-confirmed API origin. `GET /api/health` checks MongoDB and Redis connectivity; `/api/health/live` reports process liveness. Measure the proxy hop count against the deployed chain; do not infer it from Docker or provider defaults.

## Local development

Requirements: Node.js 22 or newer, npm, MongoDB, and Redis or a compatible local service. Docker Compose is available for local testing, but is not the production deployment workflow.

1. Copy `.env.example` to `.env`; replace every `change_me...` value with unique generated secrets. Keep `.env` ignored and never paste credentials into source files or documentation.
2. Configure local `MONGO_URI`, `REDIS_URL`, `CORS_ORIGINS=http://localhost:5173`, and three distinct secrets (each at least 32 characters). Set `TRUST_PROXY_HOPS=0` when running the API directly without a reverse proxy.
3. Start MongoDB and Redis locally. For the full application in local Compose, use `docker compose up --build` with the root `.env`; that stack serves the site through its local Nginx container rather than through the Vite dev server.
4. Start the API in `server/` with `npm ci`, set `$env:PORT = '5000'` in PowerShell (Compose sets 5000 automatically), then run `npm run dev`; start the frontend in `client/` with `npm ci` and `npm run dev`.
5. Open `http://localhost:5173`. Vite proxies `/api` to the API on port 5000.

The root Compose file models the local full stack and binds the Nginx HTTP port to 80. It is not a recommended public deployment configuration.

## Deploy the manually hosted API

Build and run `server/Dockerfile` on the backend host you administer, or use another deployment method that preserves the existing Express process and API paths. Do not infer a production topology from `docker-compose.yml`; that file is an optional local/reference stack.

Configure the backend's environment securely:

- `MONGO_URI`: Atlas connection string for the existing application database and a least-privilege user. Keep it pointed at the current database (`test`) unless you separately plan and execute a data migration.
- `REDIS_URL`: a private/TLS Redis-compatible service reachable by the API.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `CSRF_SECRET`: distinct random secrets of at least 32 characters.
- `TRUST_PROXY_HOPS`: set to the measured number of trusted proxy hops. Direct connections use `0`; do not trust client-supplied forwarding headers.
- `CORS_ORIGINS`: exact HTTPS frontend origins, comma-separated without paths or trailing slashes. CORS is not authentication or CSRF protection.
- `TURNSTILE_SECRET`: required in production; configure the matching public `VITE_TURNSTILE_SITE_KEY` for the frontend build and allow the deployed hostname in that widget.
- `RESEND_API_KEY` and verified `RESEND_FROM`: used for admin password reset and contact notifications. `NOTIFY_EMAIL` defaults to `sarunmgr77@gmail.com` and can be overridden. Contact messages are saved before notification email is attempted.
- `PORT`: set to the port exposed by your service manager or container. `/api/health` returns ready only when MongoDB and Redis respond.

The API must be reachable through the frontend's same-origin `/api/*` proxy so the host-only `SameSite=Strict` cookies remain attached. Configure a matching `/sitemap.xml` proxy to `/api/sitemap.xml`.

## Admin portal access

The admin portal is part of the frontend; it is not a separate backend page or subdomain. Open:

```text
https://<your-active-vercel-domain>/admin/login
```

After login, `/admin` redirects to `/admin/projects`. The browser presents the login form there; enter the existing admin account email and password. The admin account is stored in MongoDB (`User` collection) and persists across API restarts.

Authentication is not Basic Auth or a server-side Express session. The API issues short-lived JWT access and refresh tokens in `HttpOnly`, `SameSite=Strict` cookies; refresh sessions and revocations are tracked in Redis. State-changing requests also require the CSRF token/cookie pair managed by the frontend API client. The frontend handles this flow automatically after credentials are submitted.

Frontend routes:

| Browser path | Behavior |
|---|---|
| `/admin` | Redirects to `/admin/projects` when authenticated; otherwise the guard sends the user to `/admin/login`. |
| `/admin/login` | Admin sign-in form. |
| `/admin/projects` | Manage projects. |
| `/admin/posts` | Manage blog posts. |
| `/admin/messages` | View, mark read, and delete contact messages. |
| `/admin/security` | View the security event log. |
| `/admin/account` | Change the admin password. |
| `/admin/reset-password` | Request an email code and reset the admin password when signed out. |

Protected API routes, all mounted under `/api/admin` and requiring an authenticated admin role, are:

| Method and path | Purpose |
|---|---|
| `GET /api/admin/projects`, `POST /api/admin/projects` | List/create projects. |
| `PUT /api/admin/projects/:id`, `DELETE /api/admin/projects/:id` | Update/delete a project. |
| `GET /api/admin/posts`, `POST /api/admin/posts` | List/create posts. |
| `GET /api/admin/posts/:id`, `PUT /api/admin/posts/:id`, `DELETE /api/admin/posts/:id` | Read/update/delete a post. |
| `GET /api/admin/messages` | List contact messages. |
| `PATCH /api/admin/messages/:id/read`, `DELETE /api/admin/messages/:id` | Mark a message read/delete it. |
| `GET /api/admin/security-events` | Read paginated security events. |

Related authentication API routes are `GET /api/auth/csrf`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `POST /api/auth/logout-all`, `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/password-reset/request`, and `POST /api/auth/password-reset/complete`. The signed-out reset sends a six-digit code to the email stored on the admin account. Codes are valid for 10 minutes, are single-use, and allow at most five attempts; requests and verification are rate-limited. The login and admin UI routes are implemented in `client/src/admin/AdminApp.jsx`; the top-level SPA route is in `client/src/App.jsx`. API authentication routes/controllers are in `server/src/routes/auth.js` and `server/src/controllers/authController.js`; reset logic is in `server/src/services/adminPasswordResetService.js`; the protected admin API routes are in `server/src/routes/admin.js`.

There is no public registration or first-run admin creation endpoint. Keep Resend configured so the existing admin can recover access from `/admin/reset-password`. A successful reset revokes refresh sessions and clears login lockout state.

### Admin portal verification

1. Confirm the manually hosted API is healthy at `<api-origin>/api/health` and returns `"status":"ready"` with both dependencies true.
2. Ensure the backend host has `RESEND_API_KEY` and a verified `RESEND_FROM` sender; request a reset code from `/admin/reset-password` and check the existing admin account's mailbox (and spam folder). If no admin user exists in MongoDB, the privacy-preserving response is the same but no code is sent; there is deliberately no public account-creation endpoint.
3. Submit the current six-digit code and a new 14–128-character password. Sign in at `/admin/login` and confirm navigation to `/admin/projects`.
4. Visit `/admin/posts`, `/admin/messages`, `/admin/security`, and `/admin/account`. Confirm the views load. Use **Sign out**, then revisit `/admin`; it should redirect to the login page.
5. If reset email or login fails, check browser network/console details, API host logs, Resend sender/domain verification, exact production `CORS_ORIGINS`, and MongoDB/Redis health.

## Frontend proxy and managed data

### Vercel frontend

1. Import the repository as a Vercel project and set **Root Directory** to `client`; use the Vite preset.
2. `client/vercel.json` contains the install/build settings, SPA fallback, security headers, API rewrite, and dynamic sitemap rewrite.
3. The checked-in `/api/*` and `/sitemap.xml` rewrites target the owner-confirmed API origin `https://my-portfolio-tlnr.onrender.com`. Keep them same-origin from the browser; do not point browser code directly to a separate API origin. Recheck the target if the backend host changes.
4. Set the public `VITE_TURNSTILE_SITE_KEY` in the frontend deployment environment for production builds. Set the matching `TURNSTILE_SECRET` only on the backend host. Add every served hostname to that widget's Cloudflare allowlist. `VITE_*` values are public and must never contain secrets.
5. Set backend `CORS_ORIGINS` to the exact frontend HTTPS origins, including `https://www.sandipkepchhaki.com.np` if it serves the site, comma-separated without paths or trailing slashes.

### MongoDB Atlas

- Use a dedicated database user with `readWrite` access only to the application database; do not use an Atlas administrator credential.
- Atlas must permit connections from the backend host. Prefer private networking or static egress IP allowlisting. If a broad Atlas IP access list is necessary, understand the increased exposure and rely on TLS, a strong unique password, and the least-privilege database role.
- URL-encode special characters in MongoDB credentials. Never commit the URI or print it in diagnostics.
- The active production MongoDB URI has no database path, so MongoDB selects its default `test` database. Keep that URI unchanged to preserve the current admin account, content, and messages; changing its database name does not move existing data.
- A live connection is not established by these files alone; confirm `/api/health` after configuring the service.

## Validation

```powershell
Set-Location server
npm ci
npm test
npm run lint

Set-Location ..\client
npm ci
npm test
npx playwright install chromium
npm run test:e2e
$env:VITE_TURNSTILE_SITE_KEY = '1x00000000000000000000AA'
npm run build
```

The public test site key is only for local production-build validation. Replace it with the matching Cloudflare site key in the frontend production environment; never ship a test key. CI runs server tests/lint, client unit and Playwright E2E tests, the client production build, and repository/security scans. Before release, manually verify each public/admin route, both themes, mobile layouts, keyboard/focus behavior, reduced motion, contact success/error/abuse paths, browser console, and the deployed API readiness endpoint.

## Security and operations

- Review [the code review](./codereview.md), [the security checklist](./docs/security-checklist.md), and [the threat model](./docs/threat-model.md).
- Contact data and security events are stored in MongoDB with model-defined retention. Configure Atlas backups appropriate to the selected plan and test recovery; never store backups in the repository.
- Rotate any Atlas credential that may have been exposed outside its secret store. Configure replacements only on the backend host and in ignored local `.env`; do not paste credentials into chat or docs.
- The dynamic sitemap at `/sitemap.xml` includes public static routes and currently published blog posts.
- The public Security page shows aggregated event counts only; it does not expose IP addresses or usernames.

## Known operational limits

- The admin account does not have MFA yet.
- Uptime, cold starts, persistence, and network exposure depend on the manually selected backend and Redis providers; review those provider settings directly.
- Docker/Nginx restrictions apply only when that reference stack is actually deployed. Do not assume they protect a separately hosted production API.
- Sitemap and blog pages do not make this client-rendered SPA fully server-rendered for search engines.
