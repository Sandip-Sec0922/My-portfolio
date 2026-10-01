"use strict";
const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { clearAuthCookies } = require("../utils/cookies");
const { issueToken } = require("../middleware/csrf");
const passwords = require("../services/passwordService");
const tokens = require("../services/tokenService");
const lockout = require("../services/lockoutService");
const { logSecurity } = require("../services/securityEventService");

const publicUser = (u) => ({ email: u.email, role: u.role });

exports.csrf = (req, res) => res.json({ csrfToken: issueToken(res) });

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Lock check comes BEFORE the user lookup and applies to any email, existing or not.
  if (await lockout.isLocked(email)) {
    logSecurity("account_locked", req, {
      username: email,
      phase: "attempt_while_locked",
    });
    throw new AppError(
      429,
      "ACCOUNT_LOCKED",
      "Too many failed attempts. Try again later.",
    );
  }

  const user = await User.findOne({ email }).select("+passwordHash");
  const valid = await passwords.verify(
    user ? user.passwordHash : await passwords.dummyHash(),
    password,
  );

  if (!user || !valid) {
    const locked = await lockout.recordFailure(email);
    logSecurity("failed_login", req, { username: email });
    if (locked)
      logSecurity("account_locked", req, {
        username: email,
        phase: "threshold_reached",
      });
    // Same status + message for "no such user" and "wrong password" (no account enumeration).
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  await lockout.clear(email);
  await tokens.issueSession(res, user);
  User.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: new Date() } },
  ).catch(() => {});
  logSecurity("login_success", req, { username: email });
  res.json({ user: publicUser(user) });
});

exports.refresh = asyncHandler(async (req, res) => {
  const token = req.cookies && req.cookies.refresh_token;
  if (!token)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required");

  let userId;
  try {
    userId = await tokens.consumeRefresh(token);
  } catch (err) {
    if (err.code === "REFRESH_REUSE")
      logSecurity("refresh_reuse_detected", req);
    clearAuthCookies(res);
    throw err;
  }

  const user = await User.findById(userId);
  if (!user) {
    clearAuthCookies(res);
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
  }
  await tokens.issueSession(res, user);
  res.json({ user: publicUser(user) });
});

exports.logout = asyncHandler(async (req, res) => {
  const access = req.cookies && req.cookies.access_token;
  const refresh = req.cookies && req.cookies.refresh_token;
  clearAuthCookies(res);

  if (access) {
    let claims = null;
    try {
      claims = tokens.verifyAccess(access, { ignoreExpiration: true });
    } catch {
      /* forged or garbage token: nothing to revoke */
    }
    if (claims) await tokens.blacklistAccess(claims); // Redis errors propagate on purpose (no silent "logged out")
  }
  if (refresh) await tokens.revokeRefresh(refresh);

  logSecurity("logout", req);
  res.status(204).end();
});

exports.me = (req, res) =>
  res.json({ user: { id: req.user.id, role: req.user.role } });

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select("+passwordHash");
  if (!user || !(await passwords.verify(user.passwordHash, currentPassword))) {
    logSecurity("failed_login", req, { phase: "change_password" });
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Current password is incorrect",
    );
  }
  user.passwordHash = await passwords.hash(newPassword);
  await user.save();
  // Password change kills every existing session, including this one.
  await tokens.revokeAllForUser(String(user._id));
  await tokens.blacklistAccess(req.user);
  clearAuthCookies(res);
  res.status(204).end();
});
