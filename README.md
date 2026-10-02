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
   - `CORS_ORIGINS` and `PUBLIC_SITE_URL` are set by the Blueprint to `https://my-portfolio-m3bc-i25ems9w5-sandip-80b8.vercel.app` for now. When you receive the custom domain, update both to that canonical HTTPS origin.
   - Optional: `TURNSTILE_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL`
3. Deploy the Blueprint and wait for the service health check to pass. Render supplies `PORT`; the API defaults to `10000` if run outside Render. Do not set the admin bootstrap variables on the running service.
4. Create the first admin once from a trusted machine that can reach Atlas. In PowerShell, from the repository root, set the variables only for the current shell, run the CLI, and remove them:
   ```powershell
   Set-Location server
   $env:MONGO_URI = '<Atlas connection string>'
   $env:ADMIN_BOOTSTRAP_EMAIL = '<admin email>'
   $env:ADMIN_BOOTSTRAP_PASSWORD = '<unique password, at least 14 characters>'
   npm ci
   npm run admin:bootstrap
   Remove-Item Env:MONGO_URI, Env:ADMIN_BOOTSTRAP_EMAIL, Env:ADMIN_BOOTSTRAP_PASSWORD
   ```
   The CLI creates the admin only if none exists; reruns exit successfully without changing an existing admin. It never logs the password. Never save these bootstrap variables in Render or commit them.
5. Test the public service: `curl.exe -i https://<render-service-host>/api/health` should return HTTP 200 with `{"status":"ready","dependencies":{"mongo":true,"redis":true}}`. Copy the final `https://<render-service-host>` URL from the Render service's dashboard for the Vercel rewrite destination.

Upstash is used as an external Redis-compatible service because Render's free web service runs one container and the backend requires Redis for authentication sessions, rate limiting, lockout, revocation, and caching. Configure its TLS connection URL as `REDIS_URL`; never run Redis as a sidecar or put its credentials in the image.

## Deploying to Vercel and Atlas

### Vercel frontend

1. Import the repository as a Vercel project and set **Root Directory** to `client`; use the Vite preset.
2. `client/vercel.json` contains the install/build settings, SPA fallback, security headers, API rewrite, and dynamic sitemap rewrite.
3. The API and sitemap rewrites target the live API at `https://my-portfolio-tlnr.onrender.com`.
4. Set `VITE_TURNSTILE_SITE_KEY` in Vercel only if Turnstile is enabled. `VITE_*` values are public and must never contain secrets.

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
