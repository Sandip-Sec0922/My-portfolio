"use strict";
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redis = require("../config/redis");
const config = require("../config/env");
const { logSecurity } = require("../services/securityEventService");

// WHY a Redis store: with 3 API replicas an in-memory counter lets an attacker get 3x the budget.
// Shared state makes the limit global. Tests use the in-memory store and skip limiting.
function make(name, options) {
  return rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    store: config.isTest
      ? undefined
      : new RedisStore({
          sendCommand: (...args) => redis.call(...args),
          prefix: `rl:${name}:`,
        }),
    skip: () => config.isTest,
    handler: (req, res, next, opts) => {
      logSecurity("rate_limit_hit", req, { limiter: name });
      res
        .status(opts.statusCode)
        .json({
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests, please try again later.",
            requestId: req.id,
          },
        });
    },
    ...options,
  });
}

module.exports = {
  // Fails OPEN if Redis is down so the public site stays up (Nginx still rate-limits upstream).
  globalLimiter: make("global", {
    windowMs: 15 * 60 * 1000,
    limit: 300,
    passOnStoreError: true,
  }),
  // Fails CLOSED (default): if we can't count login attempts, we don't accept them.
  // skipSuccessfulRequests -> only failures burn the budget.
  loginLimiter: make("login", {
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
  }),
  refreshLimiter: make("refresh", { windowMs: 15 * 60 * 1000, limit: 30 }),
  contactLimiter: make("contact", { windowMs: 60 * 60 * 1000, limit: 5 }),
  adminLimiter: make("admin", { windowMs: 15 * 60 * 1000, limit: 200 }),
};
