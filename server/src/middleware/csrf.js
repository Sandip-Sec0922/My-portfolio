"use strict";
const crypto = require("crypto");
const config = require("../config/env");
const AppError = require("../utils/AppError");
const { cookieBase } = require("../utils/cookies");
const { logSecurity } = require("../services/securityEventService");

// Signed double-submit token. Layers: (1) SameSite=Strict cookies, (2) Origin allowlist,
// (3) token in a header that a cross-site form/image cannot set, (4) HMAC so an attacker who can
// plant a cookie (e.g. from a sibling subdomain) still can't forge a valid pair.
const COOKIE = "csrf_token";
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const sign = (raw) =>
  crypto.createHmac("sha256", config.csrfSecret).update(raw).digest("hex");

const safeEqual = (a, b) => {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

function issueToken(res) {
  const raw = crypto.randomBytes(32).toString("hex");
  const token = `${raw}.${sign(raw)}`;
  // httpOnly: the SPA gets the token from the JSON body, so JS never needs to read the cookie.
  res.cookie(COOKIE, token, {
    ...cookieBase(),
    path: "/api",
    maxAge: 2 * 60 * 60 * 1000,
  });
  return token;
}

function csrfProtect(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const reject = (reason) => {
    logSecurity("csrf_failure", req, { reason });
    return next(new AppError(403, "CSRF_FAILED", "Invalid CSRF token"));
  };

  const origin = req.get("origin");
  if (origin && !config.corsOrigins.includes(origin))
    return reject("origin_mismatch");

  const header = req.get("x-csrf-token");
  const cookie = req.cookies && req.cookies[COOKIE];
  if (!header || !cookie || !safeEqual(header, cookie))
    return reject("missing_or_mismatch");

  const [raw, sig] = String(cookie).split(".");
  if (!raw || !sig || !safeEqual(sig, sign(raw)))
    return reject("bad_signature");
  next();
}

module.exports = { issueToken, csrfProtect };
