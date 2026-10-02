"use strict";
const asyncHandler = require("../utils/asyncHandler");
const { logSecurity } = require("../services/securityEventService");
const reset = require("../services/adminPasswordResetService");

exports.request = asyncHandler(async (req, res) => {
  const message = await reset.requestCode(req.body.email);
  res.status(202).json({ ok: true, message });
});

exports.complete = asyncHandler(async (req, res) => {
  const user = await reset.resetPassword(req.body);
  logSecurity("password_reset", req, { actorId: String(user._id) });
  res.status(204).end();
});
