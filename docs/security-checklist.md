# Production security and release checklist

Use this checklist before and after deploying the separately hosted frontend and manually operated API. A checked code item means the control exists in the repository; it does not mean a live provider setting has been tested.

## 1. Repository and CI

- [ ] Confirm no `.env`, database URI, signing key, bootstrap password, or provider token is staged or committed.
- [ ] Rotate any credential that was pasted into chat, an issue, a screenshot, or source control.
- [ ] Run server tests and lint, then the client production build.
- [ ] Confirm CI passes the server, client, CodeQL, Trivy, and secret-scanning workflows.
- [ ] Review dependency and workflow updates; CI actions are tag-pinned, not immutable commit-pinned.
- [ ] Confirm current public facts, resume, favicon, OpenGraph image, and contact details are accurate.

## 2. Vercel frontend

- [ ] Set the Vercel project root to `client/` and use the Vite preset.
- [ ] Verify the `/api/:path*` rewrite targets the actual manually hosted API origin.
- [ ] Verify `/sitemap.xml` reaches the API sitemap endpoint, which includes published blog posts.
- [ ] Set the public `VITE_TURNSTILE_SITE_KEY` for production; never put secrets in `VITE_*`.
- [ ] Test the deployed security headers, SPA fallback, all public routes, and custom-domain HTTPS.
- [ ] Confirm backend `CORS_ORIGINS` exactly matches the production frontend/custom-domain origins.

## 3. Manually hosted API and external services

- [ ] Configure the API service on the host actually administered; Docker Compose/Nginx files are reference topology only.
- [ ] Set `MONGO_URI`, `REDIS_URL`, `CORS_ORIGINS`, and three distinct signing secrets (32+ characters).
- [ ] Set `TRUST_PROXY_HOPS` from the measured ingress chain, not an assumed provider default.
- [ ] Set production `TURNSTILE_SECRET` and matching frontend site key; verify the site's hostname in the Turnstile widget.
- [ ] Configure the Resend HTTPS API key and verified sender for admin password reset and contact notifications.
- [ ] Verify reset OTP email delivery, expiry, single use, and rate limits.
- [ ] Confirm `/api/health` returns 200 only when MongoDB and Redis are reachable; `/api/health/live` is process liveness only.
- [ ] Check logs for `api_listening`, MongoDB connection, Redis errors, and failed environment validation; never log secret values.
- [ ] Measure the client IP observed by the API and spoof-test a supplied `X-Forwarded-For` before increasing `TRUST_PROXY_HOPS`.
- [ ] Verify the selected host and Redis provider's restart, persistence, network access, and availability behavior.

## 4. MongoDB Atlas

- [ ] Use a dedicated application database user with `readWrite` on the application database only.
- [ ] Rotate any Atlas password exposed outside a secret store and store its replacement only on the backend host and in ignored local configuration.
- [ ] URL-encode special characters in the MongoDB URI password.
- [ ] Restrict network access with private networking or static backend egress IPs where available. If a broad allowlist is unavoidable, document the residual risk.
- [ ] Confirm the application connects and creates required indexes before enabling traffic.
- [ ] Configure backups appropriate to the selected Atlas plan and test a restore without exposing visitor data.

## 5. Runtime behavior

- [ ] Test login, wrong-password behavior, lockout, logout/replay, token refresh/reuse, absolute session expiry, and password change.
- [ ] Verify admin authorization, CSRF rejection, audit events for content/message/password mutations, and security-event access.
- [ ] Test contact success, invalid fields, legacy/new honeypot behavior, rate limits, and Turnstile failure/success.
- [ ] Confirm contact messages are persisted once, email notification failures do not lose the accepted message, and errors are visible in protected logs.
- [ ] Verify public cache headers on success and `no-store` on error responses.
- [ ] Confirm the Security page exposes aggregate counts only, not IPs, emails, paths, or event details.

## 6. User experience and accessibility

- [ ] Visit Home, Projects, Lab, Roadmap, Blog list/detail, Security, Contact, and admin routes.
- [ ] Verify dark/light mode, mobile/tablet/desktop layouts, navigation active state, command palette, and card interactions.
- [ ] Navigate by keyboard; confirm visible focus, route-change focus, modal focus behavior, and accessible form labels/errors.
- [ ] Enable `prefers-reduced-motion`; confirm transitions and terminal typing do not interfere with use.
- [ ] Check browser console/network errors and validate the dynamic sitemap XML.
- [ ] Use an accessibility scanner and manual screen-reader review; do not treat a successful build as an accessibility audit.

## 7. Incident response

1. Disable affected credentials or provider integrations.
2. Change the admin password and rotate JWT/CSRF, MongoDB, Redis, GitHub, Turnstile, Resend, or SMTP secrets as applicable.
3. Revoke sessions by clearing Redis-backed refresh state or rotating signing secrets.
4. Review access-controlled backend logs and the admin security-event view; do not export contact data to public channels.
5. Restore MongoDB data only from a verified protected backup.
6. Record the incident, update [the threat model](./threat-model.md), and rerun the release checklist.
