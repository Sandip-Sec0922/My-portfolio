"use strict";
const Message = require("../models/Message");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const logger = require("../utils/logger");
const turnstile = require("../services/turnstileService");
const mail = require("../services/mailService");
const { logSecurity } = require("../services/securityEventService");

exports.create = asyncHandler(async (req, res) => {
  const { companyWebsite, website, turnstileToken, ...data } = req.body;

  // Honeypot: bots fill every field. Return a fake success so they can't tell they were detected.
  if (companyWebsite || website) {
    logSecurity("honeypot_triggered", req);
    return res.status(201).json({ ok: true });
  }

  if (!(await turnstile.verify(turnstileToken, req.ip))) {
    logSecurity("captcha_failed", req);
    throw new AppError(
      400,
      "CAPTCHA_FAILED",
      "Verification failed. Please try again.",
    );
  }

  const msg = await Message.create({
    ...data,
    ip: req.ip,
    userAgent: String(req.get("user-agent") || "").slice(0, 200),
  });
  mail
    .notifyNewMessage(msg)
    .catch((err) => logger.warn({ err: err.message }, "notify_email_failed")); // never block the visitor on SMTP
  res.status(201).json({ ok: true });
});
