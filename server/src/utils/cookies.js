"use strict";
const config = require("../config/env");

// WHY each flag: httpOnly -> JS (and therefore XSS) cannot read tokens; secure -> never sent over HTTP;
// sameSite=strict -> browser will not attach them to cross-site requests (first CSRF layer).
// Leave COOKIE_DOMAIN unset: host-only cookies are not shared with sibling subdomains.
const cookieBase = () => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: "strict",
  domain: config.cookieDomain || undefined,
});

function setAuthCookies(res, access, refresh) {
  res.cookie("access_token", access, {
    ...cookieBase(),
    path: "/api",
    maxAge: 15 * 60 * 1000,
  });
  // WHY path=/api/auth: the long-lived refresh token is only ever sent to the endpoints that need it.
  res.cookie("refresh_token", refresh, {
    ...cookieBase(),
    path: "/api/auth",
    maxAge: config.jwt.refreshTtlSec * 1000,
  });
}

function clearAuthCookies(res) {
  res.clearCookie("access_token", { ...cookieBase(), path: "/api" });
  res.clearCookie("refresh_token", { ...cookieBase(), path: "/api/auth" });
}

module.exports = { cookieBase, setAuthCookies, clearAuthCookies };
