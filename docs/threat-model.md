# SOC Portfolio threat model

## Scope and status

This is a code-and-configuration self-assessment, not a penetration test or proof of a live deployment. The production target is a Vercel-hosted React SPA, a Render Express API and Redis-compatible Key Value service, and MongoDB Atlas. Docker Compose and Nginx are local-development assets, not part of the production trust-boundary model here.

**In scope:** browser/API behavior, authentication and admin functions, visitor contact data, GitHub/Turnstile/SMTP integrations, Vercel and Render configuration, Atlas and Key Value access, and CI configuration.

**Out of scope:** provider infrastructure controls, the security of GitHub/Cloudflare/SMTP themselves, endpoint compromise on a visitor's device, and physical/social engineering.

## Assets and data

| Asset | Security requirement |
|---|---|
| JWT/CSRF secrets, Atlas URI, Redis URL, SMTP and Turnstile secrets | Confidentiality; never enter frontend bundles or logs |
| Admin password and cookie sessions | Confidentiality, integrity, revocation |
| Contact name, email, subject, message, IP and user agent | Restricted access, retention limits, safe logging |
| Projects, posts, and published state | Admin-only integrity; public read access for published content |
| Security events | Admin-only detailed records; public endpoint exposes aggregates only |
| GitHub repository metadata | Public availability; GitHub token remains server-side |

## Trust boundaries and data flow

```text
Visitor browser
  └─ HTTPS ─> Vercel SPA
                ├─ same-origin /api/* rewrite ─> Render Express API
                └─ same-origin /sitemap.xml rewrite ─> Render sitemap endpoint
                                                 ├─ private/same-region Redis-compatible Key Value
                                                 ├─ TLS ─> MongoDB Atlas
                                                 ├─ HTTPS ─> GitHub API
                                                 └─ optional HTTPS ─> Turnstile / SMTP
```

The API trusts a configurable number of proxy hops. The configured value must be measured against the actual Vercel/Render ingress chain; trusting too many hops can enable client IP spoofing. Browser requests must remain same-origin through Vercel because auth cookies are strict same-site cookies.

## STRIDE review

| Threat | Controls in code/configuration | Residual status |
|---|---|---|
| Credential stuffing and account guessing | Argon2id, bounded passwords, IP rate limits, per-email lockout, same failure response, eagerly initialized dummy hash | Partial: lockout can temporarily deny the single admin; no MFA |
| Forged or stolen admin sessions | HttpOnly/Secure/SameSite cookies, CSRF token and Origin checks, role enforcement, single-use refresh rotation, reuse revocation, logout blacklist, 30-day absolute refresh-session age | Partial: Redis restart removes session/revocation state; protect provider access |
| CSRF and cross-origin mutations | Same-origin Vercel rewrite, strict Origin allowlist, double-submit token, SameSite=Strict | Must verify the deployed CORS origin and rewrite hostname |
| NoSQL injection and mass assignment | Mongo sanitization, strict query/schema validation, bounded enums, strict admin request schemas | Continue regression-testing each new endpoint |
| Stored/reflected XSS | Plain text is preserved, React escapes output, Markdown is rendered without raw HTML; external URLs reject embedded credentials | Third-party content and browser extensions remain outside scope |
| Contact spam and mail injection | Rate limit, strict schema, renamed honeypot with legacy compatibility, optional fail-closed Turnstile, single-line subject validation | Turnstile is optional; enable both the Vercel site key and Render secret to require it |
| Unauthorized admin content changes | Authentication, admin role, CSRF, request validation, rate limits, audit events for create/update/delete and password changes | Verify audit persistence and access restrictions after deployment |
| Redis data loss or memory pressure | Private same-region service, `noeviction`, TTL-bounded keys, explicit auth-state failure handling | Free Key Value is ephemeral; restart clears sessions/counters |
| Atlas data exposure | TLS URI, dedicated least-privilege database account, no database port in frontend | Render free egress may require a broad Atlas IP allowlist; prefer private networking/static egress |
| API/data denial of service | Express request-size caps and Redis-backed rate limits, provider-managed edge controls | No Nginx scanner filters or connection limits in the cloud target |
| Secret or personal-data disclosure through errors/logs | Central error handler, no-store error responses, request IDs, structured logging/redaction, no request-body audit data | Provider log retention and access must be configured and reviewed |
| Dependency/workflow compromise | Lockfiles, `npm ci`, CI tests/lint/build, CodeQL, Trivy, secret scanning, restricted workflow permissions | Actions are tag-pinned rather than commit-SHA-pinned; review updates |
| GitHub token leakage or SSRF | Fixed GitHub API hostname, encoded account/repository names, token sent only server-side | GitHub availability/rate limits can affect freshness; cached stale data is used when possible |
| Admin impersonation/phishing | Unlinked admin route and HTTPS | Accepted: use a password manager and add MFA when available |

## Risk register

| ID | Risk | Likelihood | Impact | Status / treatment |
|---|---|---:|---:|---|
| R1 | Admin account has no MFA | Medium | High | Open; add MFA before storing sensitive operational content |
| R2 | Free Render API cold-start or Key Value restart | High | Medium | Accepted for a portfolio only; cold start affects availability and Redis loss signs users out |
| R3 | Atlas broad IP allowlist because Render egress is not static | Medium | High | Open deployment decision; prefer private networking/static egress and use least privilege if broad access is unavoidable |
| R4 | Proxy-hop misconfiguration obscures or spoofs client IPs | Medium | Medium | Open until measured and spoof-tested on the deployed Vercel/Render chain |
| R5 | Credential previously pasted into a conversation | High | High | Rotate before production; do not reuse the exposed password |
| R6 | Provider deployment, environment values, or custom domain are not yet validated | Medium | High | Open until service URLs, health checks, rewrite, CORS, and production secrets are verified |
| R7 | Third-party CI action tag is moved or compromised | Low | High | Partial; review pinned action versions and consider immutable commit pins |
| R8 | Large volumetric attack exceeds app/provider controls | Low | High | Accepted for current scale; use provider firewall/CDN protections and monitor abuse |

## Review cadence

Update this document when a route, data type, provider, trust boundary, or security control changes. Recheck the open deployment risks after every provider configuration change and at least once per year.
