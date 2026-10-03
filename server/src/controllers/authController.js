"use strict";
const User = require("../models/User");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const { clearAuthCookies } = require("../utils/cookies");
const { issueToken } = require("../middleware/csrf");
const passwords = require("../services/passwordService");
const tokens = require("../services/tokenService");
const lockout = require("../services/lockoutService");
const { dummyHash } = passwords;
const { logSecurity } = require("../services/securityEventService");

const publicUser = (u) => ({ email: u.email, role: u.role });

exports.csrf = (req, res) => res.json({ csrfToken: issueToken(res) });

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Lock check comes BEFORE the user lookup and applies to any email, existing or not.
  const accountId = lockout.accountId(email);
  if (await lockout.isLocked(email, req.ip)) {
    logSecurity("account_locked", req, {
      accountId,
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
    user ? user.passwordHash : await dummyHash(),
    password,
  );

  if (!user || !valid) {
    const locked = await lockout.recordFailure(email, req.ip);
    logSecurity("failed_login", req, { accountId });
    if (locked)
      logSecurity("account_locked", req, {
        accountId,
        phase: "threshold_reached",
      });
    // Same status + message for "no such user" and "wrong password" (no account enumeration).
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  await lockout.clear(email, req.ip);
  await tokens.issueSession(res, user);
  User.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: new Date() } },
  ).catch(() => {});
  logSecurity("login_success", req, { accountId });
  res.json({ user: publicUser(user) });
});

exports.refresh = asyncHandler(async (req, res) => {
  const token = req.cookies && req.cookies.refresh_token;
  if (!token)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required");

  let userId;
  let authTime;
  let authVersion;
  try {
    ({ userId, authTime, authVersion } = await tokens.consumeRefresh(token));
  } catch (err) {
    if (err.code === "REFRESH_REUSE")
      logSecurity("refresh_reuse_detected", req);
    clearAuthCookies(res);
    throw err;
  }

  const user = await User.findById(userId);
  if (!user || (user.authVersion ?? 0) !== authVersion) {
    clearAuthCookies(res);
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
  }
  await tokens.issueSession(res, user, authTime);
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

exports.logoutAll = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $inc: { authVersion: 1 } },
    { new: true },
  ).select("authVersion");
  if (!user)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required");

  clearAuthCookies(res);
  await tokens.revokeAllForUser(req.user.id);
  logSecurity("logout_all", req, { actorId: req.user.id });
  res.status(204).end();
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select("email role");
  if (!user)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
  res.json({
    user: { id: String(user._id), email: user.email, role: user.role },
  });
});

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
  const passwordHash = await passwords.hash(newPassword);
  const updated = await User.findByIdAndUpdate(
    user._id,
    { $set: { passwordHash }, $inc: { authVersion: 1 } },
    { new: true },
  );
  if (!updated)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
  clearAuthCookies(res);
  // The version increment invalidates old access tokens before Redis revocation runs.
  await tokens.revokeAllForUser(String(updated._id));
  logSecurity("password_changed", req, { actorId: String(updated._id) });
  res.status(204).end();
});
