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
                    ├── Render Key Value: cache, rate limits, login lockout, sessions
                    └── GitHub / optional Turnstile and SMTP
```

The browser calls `/api/*` on the Vercel origin. This preserves the app's same-site, `SameSite=Strict` authentication-cookie behavior; do not change the client to call the Render hostname directly. The API's health endpoints are `/api/health` (liveness) and `/api/health/ready` (MongoDB and Redis readiness).

## Local development

Requirements: Node.js 22 or newer, npm, MongoDB, and Redis or a compatible local service. Docker Compose is available for local testing, but is not the production deployment workflow.

1. Copy `.env.example` to `.env`; replace every `change_me...` value with unique generated secrets. Keep `.env` ignored and never paste credentials into source files or documentation.
2. Configure local `MONGO_URI`, `REDIS_URL`, `CORS_ORIGINS=http://localhost:5173`, and three distinct secrets (each at least 32 characters). Set `TRUST_PROXY_HOPS=0` when running the API directly without a reverse proxy.
3. Start MongoDB and Redis locally. For the full application in local Compose, use `docker compose up --build` with the root `.env`; that stack serves the site through its local Nginx container rather than through the Vite dev server.
4. Start the API in `server/` with `npm ci` and `npm run dev`, then start the frontend in `client/` with `npm ci` and `npm run dev`.
5. Open `http://localhost:5173`. Vite proxies `/api` to the API on port 5000.

The root Compose file models the local full stack and binds the Nginx HTTP port to 80. It is not a recommended public deployment configuration.

## Deploying to Vercel, Render, and Atlas

### Vercel frontend

1. Import the repository as a Vercel project and set **Root Directory** to `client`; use the Vite preset.
2. `client/vercel.json` contains the install/build settings, SPA fallback, security headers, API rewrite, and dynamic sitemap rewrite.
3. The rewrite currently targets `https://soc-portfolio-api.onrender.com`. After creating the Render service, verify its actual public hostname and update both external destinations in `client/vercel.json` if Render assigned a different host.
4. Set `VITE_TURNSTILE_SITE_KEY` in Vercel only if Turnstile is enabled. `VITE_*` values are public and must never contain secrets.

### Render API and Key Value

1. Create a Render Blueprint from `render.yaml`. It declares the API, private Key Value service, same-region placement, Redis connection, and readiness endpoint.
2. Set the variables marked `sync: false` in Render:
   - `MONGO_URI`: Atlas connection string for the least-privilege application user and the `soc_portfolio` database.
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `CSRF_SECRET`: three different random values, at least 32 characters each.
   - `CORS_ORIGINS`: exact Vercel origin(s), comma-separated, without trailing slashes.
   - `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD`: initial admin credentials. After creating the account and changing its password, remove these variables from Render.
   - Optional integrations: `TURNSTILE_SECRET`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, and `NOTIFY_EMAIL`. Turnstile is enforced whenever its server secret is configured, so configure its site key in Vercel at the same time.
3. Keep the API and Key Value in the same Render region. The Blueprint uses the free plans; the API may sleep when idle and Key Value is ephemeral. Restarts can clear Redis-backed sessions and counters. Upgrade plans if continuous availability or persistent Redis state is required.
4. `TRUST_PROXY_HOPS` defaults to `1`; verify the actual client IP in Render logs and test that a forged `X-Forwarded-For` value is not trusted before increasing it. Do not increase the value speculatively.

### MongoDB Atlas

- Use a dedicated database user with `readWrite` access only to the application database; do not use an Atlas administrator credential.
- Atlas requires network access from Render. Prefer a private connection or static Render egress IP allowlisting when available. If a broad Atlas IP access list is necessary, understand the increased exposure and rely on TLS, a strong unique password, and the least-privilege database role.
- URL-encode special characters in MongoDB credentials. Never commit the URI or print it in diagnostics.
- A live connection is not established by these files alone; confirm `/api/health/ready` after configuring the service.

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
- The free Render API can cold-start after inactivity; free Key Value has no durable persistence.
- Vercel/Render replace the Nginx-only scanner blocking and connection limits from the old local stack; API rate limits remain active.
- Sitemap and blog pages do not make this client-rendered SPA fully server-rendered for search engines.
