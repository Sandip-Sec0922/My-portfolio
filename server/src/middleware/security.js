"use strict";
const helmet = require("helmet");
const cors = require("cors");
const config = require("../config/env");
const AppError = require("../utils/AppError");
const { logSecurity } = require("../services/securityEventService");

// WHY such a tight CSP: this process only returns JSON, never HTML, so it can forbid everything.
// (The SPA's CSP is set by Nginx in Phase 3 where the HTML is served.)
const helmetMw = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true }, // 2 years, forces HTTPS
  frameguard: { action: "deny" }, // clickjacking
  referrerPolicy: { policy: "no-referrer" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
});

// helmet has no Permissions-Policy support: deny powerful browser features this site never uses.
const permissionsPolicy = (req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );
  next();
};

// WHY default no-store: authenticated responses must never land in a shared cache.
// Public cached endpoints opt in explicitly with their own Cache-Control.
const noStore = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};

// Strict allowlist. Requests without an Origin (same-origin, curl) pass: CORS is a browser control,
// not authentication. Auth + CSRF still apply to them.
const corsMw = cors((req, cb) => {
  const origin = req.get("origin");
  if (origin && !config.corsOrigins.includes(origin)) {
    logSecurity("cors_blocked", req, { origin: origin.slice(0, 200) });
    return cb(new AppError(403, "CORS_BLOCKED", "Origin not allowed"));
  }
  cb(null, {
    origin: true, // safe to reflect: we just verified it is in the allowlist
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    maxAge: 600,
  });
});

module.exports = { helmetMw, permissionsPolicy, noStore, corsMw };
