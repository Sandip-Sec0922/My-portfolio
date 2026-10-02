"use strict";
const PUBLIC_EVENT_TYPES = [
  "failed_login",
  "account_locked",
  "rate_limit_hit",
  "validation_failure",
  "cors_blocked",
  "nosql_injection_blocked",
  "honeypot_triggered",
  "csrf_failure",
  "auth_denied",
  "captcha_failed",
];
const INTERNAL_EVENT_TYPES = [
  "refresh_reuse_detected",
  "login_success",
  "logout",
  "admin_create",
  "admin_update",
  "admin_delete",
  "password_changed",
];

module.exports = {
  PROJECT_CATEGORIES: [
    "detection",
    "automation",
    "web-security",
    "networking",
    "forensics",
    "other",
  ],
  POST_CATEGORIES: [
    "ctf",
    "log-analysis",
    "tool-guide",
    "incident-report",
    "other",
  ],
  PUBLIC_EVENT_TYPES,
  ALL_EVENT_TYPES: [...PUBLIC_EVENT_TYPES, ...INTERNAL_EVENT_TYPES],
};
