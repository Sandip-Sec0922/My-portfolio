"use strict";
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redis = require("../config/redis");
const config = require("../config/env");
const logger = require("../utils/logger");
const { logSecurity } = require("../services/securityEventService");
const AppError = require("../utils/AppError");

// Shared Redis state keeps limits consistent across processes. Sensitive limiters fail closed.
function make(name, options) {
  return rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    store: config.isTest
      ? undefined
      : new RedisStore({
          sendCommand: async (...args) => {
            try {
              return await redis.call(...args);
            } catch (err) {
              logger.error(
                { limiter: name, err: err.message },
                "rate_limit_store_failed",
              );
              throw new AppError(
                503,
                "RATE_LIMIT_UNAVAILABLE",
                "Request protection is temporarily unavailable",
              );
            }
          },
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
  // Public reads remain available during a Redis outage. Sensitive endpoint limiters below fail closed.
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
  passwordResetRequestLimiter: make("password-reset-request", {
    windowMs: 60 * 60 * 1000,
    limit: 5,
  }),
  passwordResetConfirmLimiter: make("password-reset-confirm", {
    windowMs: 15 * 60 * 1000,
    limit: 10,
  }),
  contactLimiter: make("contact", { windowMs: 60 * 60 * 1000, limit: 5 }),
  adminLimiter: make("admin", { windowMs: 15 * 60 * 1000, limit: 200 }),
};
