# API audit

**Reviewed:** 2026-10-03. Route inventory is derived from `server/src/app.js` and `server/src/routes/`. This documents the checked-in contract; it is not a production endpoint probe.

## Shared behavior

- Prefix: `/api`, except `GET /` and the four explicitly listed health routes.
- API routes pass the global limiter (300 requests / 15 minutes per limiter key); root and health handlers are intentionally registered before it so probes remain available during application-level limiter pressure. Sensitive routes also have the per-route limits in the table. Limits are shared through Redis outside tests; security-sensitive limiter storage errors fail closed.
- CORS allows configured exact origins with credentials. Missing `Origin` is not treated as authentication; state-changing routes still require CSRF where noted.
- JSON request bodies are capped at 16 KB, except admin post routes at 256 KB. Malformed/oversized JSON receives a safe error.
- Zod validation errors are HTTP 400 with the common error envelope. Other common errors: 401 unauthenticated, 403 forbidden/CSRF/CORS, 404 resource not found, 409 duplicate, 413 body too large, 429 rate limited, 5xx generic production response.
- Error envelope: `{ "error": { "code": "...", "message": "...", "requestId": "...", "details": [...] } }`; `details` is omitted when absent. Production responses do not include stack traces.
- `G` means global limiter. `L`, `R`, `P`, `C`, and `A` mean login, refresh, password-reset, contact, and admin additional limiter, respectively. A dash means no additional per-route limiter.
- Mutating endpoints require the HMAC double-submit CSRF token and an allowed Origin when one is supplied. Safe methods do not require CSRF.

## Endpoint inventory

| Method | Route | Authentication required | Authorization | Validation | Rate limit | CSRF | Response / errors | Tests |
|---|---|---|---|---|---|---|---|---|
| GET | `/` | No | Public liveness | None | Probe bypass | No | 200 `{status:"ok"}` | `server/tests/app.test.js` (GET/HEAD) |
| HEAD | `/` | No | Public liveness | None | Probe bypass | No | 200 with no response body (Express GET fallback) | `server/tests/app.test.js` |
| GET | `/api/health` | No | Public readiness | None | Probe bypass | No | 200 ready or 503 degraded with Mongo/Redis booleans | `healthController.test.js` |
| GET | `/api/health/live` | No | Public liveness | None | Probe bypass | No | 200 `{status:"ok"}` | No explicit route test |
| GET | `/api/health/ready` | No | Public readiness | None | Probe bypass | No | 200 ready or 503 degraded | `healthController.test.js` |
| GET | `/api/sitemap.xml` | No | Public published sitemap | None | G | No | 200 XML; safe server errors | `sitemap.test.js` |
| GET | `/api/projects` | No | Public projects | Strict optional category enum | G | No | 200 `{items}`; 400 validation; safe 5xx | Schema covered; no route integration test |
| GET | `/api/posts` | No | Published posts only | Strict tag/category/search/page (page 1–1000) | G | No | 200 `{items,total,page,pages}`; 400 validation | Schema covered; no route integration test |
| GET | `/api/posts/:slug` | No | Published post only | Strict slug parameter | G | No | 200 post; 400 invalid slug; 404 unpublished/missing | Schema covered; no route integration test |
| GET | `/api/github` | No | Public GitHub metadata | Query ignored; no query schema | G | No | 200 sanitized repositories/languages; 502 if unavailable without stale copy | `githubService.test.js` covers token/upstream handling, not route/cache matrix |
| GET | `/api/security/posture` | No | Public aggregate counts only | Query ignored; no query schema | G | No | 200 seven-day aggregate; safe 5xx | No dedicated route test |
| POST | `/api/contact` | No | Public contact submission | Strict contact schema; Turnstile/honeypot processing | G + C (5/hour) | Yes | 201 `{ok:true}`; 400 validation/CAPTCHA; 403 CSRF; 429; safe 5xx | `contact.test.js`, validator and rate-limit tests |
| GET | `/api/auth/csrf` | No | Public token bootstrap | None | G | No | 200 `{csrfToken}` and HttpOnly CSRF cookie | Auth/CSRF integration tests |
| POST | `/api/auth/login` | No | Admin account login | Strict email/password schema | G + L (5/15 minutes; failed attempts count) | Yes | 200 `{user}`; 400 validation; 401 generic invalid credentials; 429 lockout/limit; 503 dependency/rate-limit failure | `auth.test.js`, `rateLimit.test.js` |
| POST | `/api/auth/password-reset/request` | No | Admin reset request | Strict email schema | G + P (5/hour) | Yes | 202 `{ok,message}` without revealing account existence; validation/CSRF/rate errors | Auth reset/service and rate-limit tests |
| POST | `/api/auth/password-reset/complete` | No | Admin reset completion | Strict email, six-digit OTP, password schema | G + P (10/15 minutes) | Yes | 204; 400 validation; safe reset errors; 429 | Auth and `adminPasswordResetService.test.js` |
| POST | `/api/auth/refresh` | Refresh cookie | Valid single-use session for current admin | Cookie/token validated by service | G + R (30/15 minutes) | Yes | 200 `{user}` and rotated cookies; 401 expired/reused; 503 Redis failure | `auth.test.js` tests rotation, reuse, and concurrent token consumption; `tokenService.test.js` |
| POST | `/api/auth/logout` | No (best-effort token revocation) | Revokes presented access/refresh tokens | Cookie/token verification | G | Yes | 204 and cookie-clearing headers; safe 5xx if revocation storage fails | `auth.test.js` tests replay and matching access-cookie Path |
| GET | `/api/auth/me` | Access cookie | Any valid admin | JWT, revocation, authVersion, database user | G | No | 200 `{user:{id,email,role}}`; 401/503 | `auth.test.js` |
| POST | `/api/auth/logout-all` | Access cookie | Admin | Auth middleware + CSRF | G | Yes | 204; increments authVersion and revokes sessions | `auth.test.js` |
| POST | `/api/auth/change-password` | Access cookie | Admin | Strict current/new password schema | G | Yes | 204; 400 validation; 401 wrong current password; safe dependency errors | `auth.test.js` |
| GET | `/api/admin/projects` | Access cookie | Admin role | None | G + A (200/15 minutes) | No | 200 `{items}`; 401/403; safe 5xx | Admin authorization covered; project route integration missing |
| POST | `/api/admin/projects` | Access cookie | Admin role | Strict project schema | G + A | Yes | 201 project; 400 validation; 409 duplicate; safe 5xx | Validator covered; no route integration test |
| PUT | `/api/admin/projects/:id` | Access cookie | Admin role | ObjectId + strict partial project schema | G + A | Yes | 200 project; 400 validation/id; 404 missing; 409 duplicate | Validator covered; no route integration test |
| DELETE | `/api/admin/projects/:id` | Access cookie | Admin role | ObjectId | G + A | Yes | 204; 400 invalid id; 404 missing | No route integration test |
| GET | `/api/admin/posts` | Access cookie | Admin role | None | G + A | No | 200 `{items}` metadata, without content | No route integration test |
| GET | `/api/admin/posts/:id` | Access cookie | Admin role | ObjectId | G + A | No | 200 post; 400 invalid id; 404 missing | No route integration test |
| POST | `/api/admin/posts` | Access cookie | Admin role | Strict post schema | G + A | Yes | 201 post; 400 validation; 409 duplicate | Validator covered; no route integration test |
| PUT | `/api/admin/posts/:id` | Access cookie | Admin role | ObjectId + strict partial post schema | G + A | Yes | 200 post; 400 validation/id; 404 missing; 409 duplicate | Validator covered; no route integration test |
| DELETE | `/api/admin/posts/:id` | Access cookie | Admin role | ObjectId | G + A | Yes | 204; 400 invalid id; 404 missing | No route integration test |
| GET | `/api/admin/messages` | Access cookie | Admin role | Strict page/unread query | G + A | No | 200 `{items,total,page,pages}`, 20/page | Admin auth and general rate-limit tests; no message listing integration test |
| PATCH | `/api/admin/messages/:id/read` | Access cookie | Admin role | ObjectId | G + A | Yes | 200 updated message; 400 invalid id; 404 missing | No route integration test |
| DELETE | `/api/admin/messages/:id` | Access cookie | Admin role | ObjectId | G + A | Yes | 204; 400 invalid id; 404 missing | No route integration test |
| GET | `/api/admin/security-events` | Access cookie | Admin role | Strict page/type query | G + A | No | 200 `{items,total,page,pages}`, 50/page; detailed records are private | Admin auth covered; no query/response integration test |

## Contract notes / follow-up

- All routes are mounted under `/api` except root liveness. `HEAD /` is automatically served by Express using the GET handler; it has a regression test.
- Admin route middleware is applied to the entire admin router before endpoint handlers, so a missing/invalid admin session is never bypassed by frontend route state.
- Public project/post results may be empty when the database has no published content; that is a data state, not an API failure.
- The API is not fully contract-tested: project/post CRUD, security posture, and most admin content/message routes need integration tests before significant handler/schema changes (Finding E-5).
- Logout cookie clearing now uses the same access-cookie path as issuance; see the resolved E-1 record in `ENGINEERING-AUDIT.md`.
