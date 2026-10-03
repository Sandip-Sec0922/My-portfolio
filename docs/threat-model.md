# SOC Portfolio threat model

## Scope and status

This is a code-and-configuration self-assessment, not a penetration test or proof of a live deployment. The owner manually hosts the Express API and separately deploys the React SPA. The actual API host, proxy chain, Redis provider, and database connectivity must be verified by the operator. Docker Compose and Nginx are an optional reference stack, not proof of the production trust-boundary model.

**In scope:** browser/API behavior, authentication and admin functions, visitor contact data, GitHub/Turnstile/Resend integrations, frontend/API configuration, MongoDB and Redis-compatible storage, and CI configuration.

**Out of scope:** provider infrastructure controls, the security of GitHub/Cloudflare/Resend (or an explicitly configured SMTP relay), endpoint compromise on a visitor's device, and physical/social engineering.

## Assets and data

| Asset | Security requirement |
|---|---|
| JWT/CSRF secrets, MongoDB URI, Redis URL, Resend/SMTP and Turnstile secrets | Confidentiality; never enter frontend bundles or logs |
| Admin password and cookie sessions | Confidentiality, integrity, revocation |
| Contact name, email, subject, message, IP and user agent | Restricted access, retention limits, safe logging |
| Projects, posts, and published state | Admin-only integrity; public read access for published content |
| Security events | Admin-only detailed records; public endpoint exposes aggregates only |
| GitHub repository metadata | Public availability; GitHub token remains server-side |

## Trust boundaries and data flow

```text
Visitor browser
  └─ HTTPS ─> separately deployed SPA
                ├─ same-origin /api/* proxy ─> manually hosted Express API
                └─ same-origin /sitemap.xml proxy ─> API sitemap endpoint
                                                      ├─ Redis-compatible session/cache store
                                                      ├─ TLS ─> MongoDB (current database: test)
                                                      ├─ HTTPS ─> GitHub API
                                                      └─ HTTPS ─> Turnstile / Resend
```

The API trusts a configurable number of proxy hops. The configured value must be measured against the actual ingress chain; trusting too many hops can enable client IP spoofing. Browser requests must remain same-origin through the frontend proxy because auth cookies are strict same-site cookies. The configured API origin was confirmed by the owner; the rewrite alone does not prove live health or provider-side configuration.

## STRIDE review

| Threat | Controls in code/configuration | Residual status |
|---|---|---|
| Credential stuffing and account guessing | Argon2id, bounded passwords, IP rate limits, per-account/IP HMAC lockout, same failure response, eagerly initialized dummy hash | Partial: lockout can temporarily deny the single admin; no MFA |
| Forged or stolen admin sessions | HttpOnly/Secure/SameSite cookies, CSRF token and Origin checks, database-backed role and auth-version checks, single-use refresh rotation, reuse revocation, logout blacklist, 30-day absolute refresh-session age | Partial: Redis restart removes refresh state and user record availability is required for protected requests |
| CSRF and cross-origin mutations | Same-origin Vercel rewrite, strict Origin allowlist, double-submit token, SameSite=Strict | Must verify the deployed CORS origin and rewrite hostname |
| NoSQL injection and mass assignment | Mongo sanitization, strict query/schema validation, bounded enums, strict admin request schemas | Continue regression-testing each new endpoint |
| Stored/reflected XSS | Plain text is preserved, React escapes output, Markdown is rendered without raw HTML; external URLs reject embedded credentials | Third-party content and browser extensions remain outside scope |
| Contact spam and mail injection | Rate limit, strict schema, renamed honeypot with legacy compatibility, production-required fail-closed Turnstile, single-line subject validation | Verify both Turnstile keys and allowed hostnames in the deployed environments |
| Unauthorized admin content changes | Authentication, admin role, CSRF, request validation, rate limits, audit events for create/update/delete and password changes | Verify audit persistence and access restrictions after deployment |
| Redis data loss or memory pressure | Redis-backed state, TTL-bounded keys, explicit auth-state failure handling | Provider persistence, eviction, and network exposure have not been confirmed; restart may clear sessions/counters |
| MongoDB data exposure | TLS URI, dedicated least-privilege database account, no database port in frontend | Backend egress/IP allowlist and backups must be verified with the selected host; preserve the current `test` database unless migrated |
| API/data denial of service | Express request-size caps and Redis-backed rate limits | Edge filtering and connection limits depend on the actual host/proxy and have not been established |
| Secret or personal-data disclosure through errors/logs | Central error handler, no-store error responses, request IDs, structured logging/redaction, no request-body audit data | Provider log retention and access must be configured and reviewed |
| Dependency/workflow compromise | Lockfiles, `npm ci`, CI tests/lint/build, CodeQL, Trivy, secret scanning, restricted workflow permissions | Actions are tag-pinned rather than commit-SHA-pinned; review updates |
| GitHub token leakage or SSRF | Fixed GitHub API hostname, encoded account/repository names, token sent only server-side | GitHub availability/rate limits can affect freshness; cached stale data is used when possible |
| Admin impersonation/phishing | Unlinked admin route, noindex protection, and HTTPS | Accepted: use a password manager and add MFA when available |

## Risk register

| ID | Risk | Likelihood | Impact | Status / treatment |
|---|---|---:|---:|---|
| R1 | Admin account has no MFA | Medium | High | Open; add MFA before storing sensitive operational content |
| R2 | API cold-start or Redis restart/loss | Medium | Medium | Provider behavior is unknown; verify uptime and state durability for the selected host and Redis service |
| R3 | MongoDB broad IP allowlist due to backend egress constraints | Medium | High | Open deployment decision; prefer private networking/static egress and use least privilege if broad access is unavoidable |
| R4 | Proxy-hop misconfiguration obscures or spoofs client IPs | Medium | Medium | Open until measured and spoof-tested on the actual deployed chain |
| R5 | Credential previously pasted into a conversation | High | High | Rotate before production; do not reuse the exposed password |
| R6 | Provider deployment, environment values, or custom domain are not yet validated | Medium | High | Open until API URL, health checks, rewrite, CORS, and production secrets are verified |
| R7 | Third-party CI action tag is moved or compromised | Low | High | Partial; review pinned action versions and consider immutable commit pins |
| R8 | Large volumetric attack exceeds app/provider controls | Low | High | Accepted for current scale; use provider firewall/CDN protections and monitor abuse |

## Review cadence

Update this document when a route, data type, provider, trust boundary, or security control changes. Recheck the open deployment risks after every provider configuration change and at least once per year.
