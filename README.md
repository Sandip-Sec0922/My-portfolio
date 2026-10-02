# SOC Security Portfolio

A cybersecurity/SOC learning portfolio built with React, Vite, Tailwind CSS, Framer Motion, Express, MongoDB, and Redis-compatible storage. The application keeps its existing routes, admin dashboard, GitHub/blog integrations, contact protections, and security-event views.

Production target: **Vercel (React SPA) + Render (Express API and Key Value) + MongoDB Atlas**. Docker files remain available for local use and the API image; Docker Compose/Nginx/VPS is not the production deployment path described here.

## Features

- Public portfolio routes: Home, Projects, Lab, Roadmap, Blog, Security, and Contact.
- Admin routes for project/post management, contact messages, security events, and password changes.
- Server-side GitHub data retrieval and cache, Markdown blog content, and contact-message persistence.
- HttpOnly authentication cookies, CSRF checks, rate limiting, login lockout, Turnstile integration, and a contact honeypot.
- Responsive light/dark theme, keyboard navigation, reduced-motion support, and animated route transitions.

## Architecture

```text
Browser
  └── Vercel: static React/Vite application
        └── same-origin /api/* and /sitemap.xml rewrite
              └── Render: Express API (server/Dockerfile)
                    ├── MongoDB Atlas: users, content, messages, security events
                    ├── external Redis-compatible service: sessions, rate limits, lockout, caches
                    └── GitHub / optional Turnstile and SMTP
```

The browser calls `/api/*` on the Vercel origin. This preserves the app's same-site, `SameSite=Strict` authentication-cookie behavior; do not change the client to call the Render hostname directly. `GET /api/health` checks MongoDB and Redis connectivity and is the Render health check; `/api/health/live` reports process liveness.

## Local development

Requirements: Node.js 22 or newer, npm, MongoDB, and Redis or a compatible local service. Docker Compose is available for local testing, but is not the production deployment workflow.

1. Copy `.env.example` to `.env`; replace every `change_me...` value with unique generated secrets. Keep `.env` ignored and never paste credentials into source files or documentation.
2. Configure local `MONGO_URI`, `REDIS_URL`, `CORS_ORIGINS=http://localhost:5173`, and three distinct secrets (each at least 32 characters). Set `TRUST_PROXY_HOPS=0` when running the API directly without a reverse proxy.
3. Start MongoDB and Redis locally. For the full application in local Compose, use `docker compose up --build` with the root `.env`; that stack serves the site through its local Nginx container rather than through the Vite dev server.
4. Start the API in `server/` with `npm ci`, set `$env:PORT = '5000'` in PowerShell (Compose sets 5000 automatically), then run `npm run dev`; start the frontend in `client/` with `npm ci` and `npm run dev`.
5. Open `http://localhost:5173`. Vite proxies `/api` to the API on port 5000.

The root Compose file models the local full stack and binds the Nginx HTTP port to 80. It is not a recommended public deployment configuration.

## Deploy to Render

1. Create a Render account, connect this GitHub repository, and create a **Blueprint** from `render.yaml`. A Blueprint is preferable because the single Docker web service is declared and repeatable; it does not provision a local MongoDB, Nginx, API replicas, or a Render Redis sidecar.
2. In the Blueprint service's Environment settings, set:
   - `MONGO_URI`: `<Atlas connection string for a least-privilege application user>`
   - `REDIS_URL`: `<Upstash Redis TLS URL, beginning rediss://>`
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`: three distinct generated random strings, each at least 32 characters
   - `CORS_ORIGINS` is a comma-separated allowlist of exact HTTPS origins (host only, no path or trailing slash); the Blueprint includes the stable Vercel alias and the original deployment hostname. `PUBLIC_SITE_URL` is set to the stable Vercel alias. Update these when you attach a custom domain.
   - Optional: `TURNSTILE_SECRET`; when enabled, also set the matching public `VITE_TURNSTILE_SITE_KEY` in Vercel and redeploy the frontend. The public site key does not belong in Render.
   - Configure Resend (`RESEND_API_KEY`, `RESEND_FROM`) for admin password recovery. Resend requires a domain you own and have verified; use a sender address on that domain. Set `NOTIFY_EMAIL` to the inbox that should receive contact-form alerts. Contact messages are stored in MongoDB independently of email delivery. Render's free web services block SMTP ports 25, 465, and 587, so SMTP will not work there.
3. Deploy the Blueprint and wait for the service health check to pass. Render supplies `PORT`; the API defaults to `10000` if run outside Render.
4. Verify a domain you own in Resend, then configure `RESEND_API_KEY` and `RESEND_FROM` (for example, `Portfolio <no-reply@mail.yourdomain.com>`) in Render. Email is sent to the address on the admin account. The Resend API uses HTTPS; do not use Gmail SMTP on Render's free plan because outbound SMTP ports are blocked.
5. Test the public service: `curl.exe -i https://<render-service-host>/api/health` should return HTTP 200 with `{"status":"ready","dependencies":{"mongo":true,"redis":true}}`. Copy the final `https://<render-service-host>` URL from the Render service's dashboard for the Vercel rewrite destination.

Upstash is used as an external Redis-compatible service because Render's free web service runs one container and the backend requires Redis for authentication sessions, rate limiting, lockout, revocation, and caching. Configure its TLS connection URL as `REDIS_URL`; never run Redis as a sidecar or put its credentials in the image.

## Admin portal access

The admin portal is part of the Vercel frontend; it is not a separate Render page or subdomain. Open:

```text
https://<your-active-vercel-domain>/admin/login
```

After login, `/admin` redirects to `/admin/projects`. The browser presents the login form there; enter the existing admin account email and password. The admin account is stored in MongoDB Atlas (`User` collection) and persists across Render restarts.

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

Related authentication API routes are `GET /api/auth/csrf`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/password-reset/request`, and `POST /api/auth/password-reset/complete`. The signed-out reset sends a six-digit code to the email stored on the admin account. Codes are valid for 10 minutes, are single-use, and allow at most five attempts; requests and verification are rate-limited. The login and admin UI routes are implemented in `client/src/admin/AdminApp.jsx`; the top-level SPA route is in `client/src/App.jsx`. API authentication routes/controllers are in `server/src/routes/auth.js` and `server/src/controllers/authController.js`; reset logic is in `server/src/services/adminPasswordResetService.js`; the protected admin API routes are in `server/src/routes/admin.js`.

There is no public registration or first-run admin creation endpoint. Keep Resend configured so the existing admin can recover access from `/admin/reset-password`. A successful reset revokes refresh sessions and clears login lockout state.

### Admin portal verification

1. Confirm the Render API is healthy at `https://<render-host>/api/health` and returns `"status":"ready"` with both dependencies true.
2. Ensure Render has `RESEND_API_KEY` and a verified `RESEND_FROM` sender; request a reset code from `/admin/reset-password` and check the existing admin account's mailbox (and spam folder). If no admin user exists in Atlas, the privacy-preserving response is the same but no code is sent; there is deliberately no public account-creation endpoint.
3. Submit the current six-digit code and a new 14–128-character password. Sign in at `/admin/login` and confirm navigation to `/admin/projects`.
4. Visit `/admin/posts`, `/admin/messages`, `/admin/security`, and `/admin/account`. Confirm the views load. Use **Sign out**, then revisit `/admin`; it should redirect to the login page.
5. If reset email or login fails, check browser network/console details, Render logs, Resend sender/domain verification, exact production `CORS_ORIGINS`, and MongoDB/Redis health.

## Deploying to Vercel and Atlas

### Vercel frontend

1. Import the repository as a Vercel project and set **Root Directory** to `client`; use the Vite preset.
2. `client/vercel.json` contains the install/build settings, SPA fallback, security headers, API rewrite, and dynamic sitemap rewrite.
3. The API and sitemap rewrites target the live API at `https://my-portfolio-tlnr.onrender.com`.
4. Set `VITE_TURNSTILE_SITE_KEY` in Vercel only if Turnstile is enabled; set the corresponding `TURNSTILE_SECRET` in Render. Configure both values or leave both unset. `VITE_*` values are public and must never contain secrets.
5. The production `CORS_ORIGINS` value on Render must contain the exact Vercel site origins that serve the frontend (for example, `https://my-portfolio-m3bc-pink.vercel.app`), comma-separated without paths or trailing slashes. Save the Render environment change and redeploy the API.

### MongoDB Atlas

- Use a dedicated database user with `readWrite` access only to the application database; do not use an Atlas administrator credential.
- Atlas requires network access from Render. Prefer a private connection or static Render egress IP allowlisting when available. If a broad Atlas IP access list is necessary, understand the increased exposure and rely on TLS, a strong unique password, and the least-privilege database role.
- URL-encode special characters in MongoDB credentials. Never commit the URI or print it in diagnostics.
- A live connection is not established by these files alone; confirm `/api/health` after configuring the service.

## Validation

```powershell
Set-Location server
npm ci
npm test
npm run lint

Set-Location ..\client
npm ci
npm run build
```

The CI workflows run server tests/lint, the client production build, and repository/security scans. Before release, manually verify each public/admin route, both themes, mobile layouts, keyboard/focus behavior, reduced motion, contact success/error/abuse paths, browser console, and the deployed API readiness endpoint.

## Security and operations

- Review [the code review](./codereview.md), [the security checklist](./docs/security-checklist.md), and [the threat model](./docs/threat-model.md).
- Contact data and security events are stored in MongoDB with model-defined retention. Configure Atlas backups appropriate to the selected plan and test recovery; never store backups in the repository.
- Rotate the previously exposed Atlas database password before production use. Configure the replacement only in the Render secret store and local ignored `.env` as needed; do not paste it into chat or docs.
- The dynamic sitemap at `/sitemap.xml` includes public static routes and currently published blog posts.
- The public Security page shows aggregated event counts only; it does not expose IP addresses or usernames.

## Known operational limits

- The admin account does not have MFA yet.
- The free Render API can cold-start after inactivity; free Upstash plans have command/data limits and may be ephemeral or subject to provider-specific eviction.
- Vercel/Render replace the Nginx-only scanner blocking and connection limits from the old local stack; API rate limits remain active.
- Sitemap and blog pages do not make this client-rendered SPA fully server-rendered for search engines.
