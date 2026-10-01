"use strict";
const AppError = require("../utils/AppError");
const tokens = require("../services/tokenService");
const { logSecurity } = require("../services/securityEventService");

async function authenticate(req, res, next) {
  try {
    const token = req.cookies && req.cookies.access_token;
    if (!token) {
      logSecurity("auth_denied", req, { reason: "no_token" });
      throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
    }
    let claims;
    try {
      claims = tokens.verifyAccess(token); // pins HS256 + issuer + audience (blocks alg-confusion / token swapping)
    } catch {
      logSecurity("auth_denied", req, { reason: "invalid_token" });
      throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
    }
    let revoked;
    try {
      revoked = await tokens.isBlacklisted(claims.jti);
    } catch {
      // WHY fail closed: if we can't prove the token wasn't logged out, we don't trust it.
      throw new AppError(
        503,
        "AUTH_UNAVAILABLE",
        "Service temporarily unavailable",
      );
    }
    if (revoked) {
      logSecurity("auth_denied", req, { reason: "revoked_token" });
      throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
    }
    req.user = {
      id: claims.sub,
      role: claims.role,
      jti: claims.jti,
      exp: claims.exp,
    };
    next();
  } catch (err) {
    next(err);
  }
}

// RBAC. "Public" = no token; "admin" = valid token with the admin role.
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) return next();
    logSecurity("auth_denied", req, { reason: "forbidden_role" });
    next(new AppError(403, "FORBIDDEN", "Forbidden"));
  };

module.exports = { authenticate, requireRole };
