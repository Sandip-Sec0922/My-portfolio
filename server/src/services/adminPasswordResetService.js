"use strict";
const crypto = require("crypto");
const User = require("../models/User");
const redis = require("../config/redis");
const config = require("../config/env");
const passwords = require("./passwordService");
const tokens = require("./tokenService");
const lockout = require("./lockoutService");
const mail = require("./mailService");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");

const OTP_TTL_SEC = 10 * 60;
const REQUEST_COOLDOWN_SEC = 60;
const MAX_OTP_ATTEMPTS = 5;
const GENERIC_REQUEST_MESSAGE =
  "If an admin account matches that email, a password reset code will be sent.";
const OTP_SCRIPT = `
local otp = redis.call("GET", KEYS[1])
if not otp then return 0 end
local attempts = redis.call("INCR", KEYS[2])
if attempts == 1 then redis.call("EXPIRE", KEYS[2], ARGV[2]) end
if otp == ARGV[1] then
  redis.call("DEL", KEYS[1], KEYS[2])
  return 1
end
if attempts >= tonumber(ARGV[3]) then
  redis.call("DEL", KEYS[1], KEYS[2])
end
return 0
`;

const normalizeEmail = (email) => email.trim().toLowerCase();
const emailId = (email) =>
  crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
const otpDigest = (email, otp) =>
  crypto
    .createHmac("sha256", config.csrfSecret)
    .update(`${normalizeEmail(email)}:${otp}`)
    .digest("hex");
const keysFor = (email) => {
  const id = emailId(email);
  return {
    otp: `admin:password-reset:otp:${id}`,
    attempts: `admin:password-reset:attempts:${id}`,
    cooldown: `admin:password-reset:cooldown:${id}`,
  };
};
const findUser = (email) =>
  User.findOne({
    $expr: {
      $eq: [{ $toLower: "$email" }, normalizeEmail(email)],
    },
  });

async function requestCode(email) {
  if (!mail.canSendPasswordReset())
    throw new AppError(
      503,
      "RESET_UNAVAILABLE",
      "Password reset is temporarily unavailable. Please contact the site owner.",
    );

  const keys = keysFor(email);
  const acquired = await redis.set(
    keys.cooldown,
    "1",
    "EX",
    REQUEST_COOLDOWN_SEC,
    "NX",
  );
  if (acquired !== "OK") return GENERIC_REQUEST_MESSAGE;

  const user = await findUser(email);
  if (!user || user.role !== "admin") return GENERIC_REQUEST_MESSAGE;

  const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  try {
    const results = await redis
      .multi()
      .set(keys.otp, otpDigest(email, otp), "EX", OTP_TTL_SEC)
      .del(keys.attempts)
      .exec();
    if (!Array.isArray(results) || results.some(([err]) => err))
      throw new Error("Could not persist password reset code");
    await mail.sendAdminPasswordResetOtp(user.email, otp);
  } catch (error) {
    const cleanup = await Promise.allSettled([
      redis.del(keys.otp, keys.attempts, keys.cooldown),
    ]);
    if (cleanup[0].status === "rejected")
      logger.error(
        { err: cleanup[0].reason.message },
        "admin_password_reset_cleanup_failed",
      );
    logger.error(
      {
        err: error.message,
        code: error.code,
        command: error.command,
        responseCode: error.responseCode,
      },
      "admin_password_reset_delivery_failed",
    );
    throw new AppError(
      503,
      "RESET_UNAVAILABLE",
      "Password reset email could not be sent. Please try again later.",
    );
  }

  return GENERIC_REQUEST_MESSAGE;
}

async function resetPassword({ email, otp, newPassword }) {
  const user = await findUser(email);
  if (!user || user.role !== "admin")
    throw new AppError(400, "INVALID_RESET_CODE", "Invalid or expired reset code");

  const keys = keysFor(email);
  const consumed = await redis.eval(
    OTP_SCRIPT,
    2,
    keys.otp,
    keys.attempts,
    otpDigest(email, otp),
    OTP_TTL_SEC,
    MAX_OTP_ATTEMPTS,
  );
  if (consumed !== 1)
    throw new AppError(400, "INVALID_RESET_CODE", "Invalid or expired reset code");

  user.passwordHash = await passwords.hash(newPassword);
  await user.save();
  await Promise.all([
    tokens.revokeAllForUser(String(user._id)),
    lockout.clear(user.email),
  ]);

  return user;
}

module.exports = { requestCode, resetPassword };
