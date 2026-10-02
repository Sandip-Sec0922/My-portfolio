"use strict";
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const config = require("../config/env");
const redis = require("../config/redis");
const AppError = require("../utils/AppError");
const { setAuthCookies } = require("../utils/cookies");

const { accessSecret, refreshSecret, issuer, accessTtl, refreshTtlSec } =
  config.jwt;
const ALGS = ["HS256"]; // allowlist on verify; never trust the token's own "alg" header
const MAX_SESSION_AGE_SEC = 30 * 24 * 60 * 60;

async function execChecked(transaction) {
  const results = await transaction.exec();
  if (!Array.isArray(results))
    throw new Error("Redis transaction did not execute");
  const failure = results.find(([err]) => err)?.[0];
  if (failure) throw failure;
  return results;
}

const signAccess = (user) =>
  jwt.sign({ role: user.role }, accessSecret, {
    algorithm: "HS256",
    subject: String(user._id),
    expiresIn: accessTtl,
    jwtid: randomUUID(),
    issuer,
    audience: "admin",
  });

const verifyAccess = (token, extra = {}) =>
  jwt.verify(token, accessSecret, {
    algorithms: ALGS,
    issuer,
    audience: "admin",
    ...extra,
  });

// Refresh tokens are tracked server-side (Redis allowlist) so they are single-use and revocable.
async function signRefresh(user, authTime) {
  const jti = randomUUID();
  const uid = String(user._id);
  const token = jwt.sign({ authTime }, refreshSecret, {
    algorithm: "HS256",
    subject: uid,
    expiresIn: refreshTtlSec,
    jwtid: jti,
    issuer,
    audience: "refresh",
  });
  try {
    await execChecked(
      redis
        .multi()
        .set(`rt:${jti}`, uid, "EX", refreshTtlSec)
        .sadd(`user_rt:${uid}`, jti)
        .expire(`user_rt:${uid}`, refreshTtlSec),
    );
  } catch (err) {
    const cleanup = await Promise.allSettled([
      redis.del(`rt:${jti}`),
      redis.srem(`user_rt:${uid}`, jti),
    ]);
    const cleanupErrors = cleanup
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason);
    if (cleanupErrors.length)
      throw new AggregateError(
        [err, ...cleanupErrors],
        "Refresh session write and cleanup failed",
      );
    throw err;
  }
  return token;
}

async function revokeAllForUser(uid) {
  const jtis = await redis.smembers(`user_rt:${uid}`);
  const tx = redis.multi();
  jtis.forEach((j) => tx.del(`rt:${j}`));
  tx.del(`user_rt:${uid}`);
  await execChecked(tx);
}

// ROTATION + REUSE DETECTION: each refresh token works exactly once. GET+DEL in one MULTI is atomic,
// so two parallel requests can't both succeed. A token that is validly signed but no longer in Redis
// was already used (stolen?), so we revoke the user's entire session family.
async function consumeRefresh(token) {
  let claims;
  try {
    claims = jwt.verify(token, refreshSecret, {
      algorithms: ALGS,
      issuer,
      audience: "refresh",
    });
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "Session expired");
  }
  const results = await execChecked(
    redis.multi().get(`rt:${claims.jti}`).del(`rt:${claims.jti}`),
  );
  const owner = results[0][1];
  await redis.srem(`user_rt:${claims.sub}`, claims.jti);
  if (owner !== claims.sub) {
    await revokeAllForUser(claims.sub);
    throw new AppError(401, "REFRESH_REUSE", "Session expired");
  }
  const authTime = Number.isInteger(claims.authTime) ? claims.authTime : claims.iat;
  if (Math.floor(Date.now() / 1000) - authTime >= MAX_SESSION_AGE_SEC) {
    await revokeAllForUser(claims.sub);
    throw new AppError(401, "UNAUTHENTICATED", "Authentication required");
  }
  return { userId: claims.sub, authTime };
}

async function revokeRefresh(token) {
  let c;
  try {
    c = jwt.verify(token, refreshSecret, {
      algorithms: ALGS,
      issuer,
      audience: "refresh",
    });
  } catch {
    return;
  }
  await execChecked(
    redis.multi().del(`rt:${c.jti}`).srem(`user_rt:${c.sub}`, c.jti),
  );
}

// Logout blacklist. TTL = remaining token lifetime, so the key disappears exactly when the token would expire anyway.
async function blacklistAccess(claims) {
  const ttl = claims.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) await redis.set(`bl:${claims.jti}`, "1", "EX", ttl);
}
const isBlacklisted = async (jti) => (await redis.exists(`bl:${jti}`)) === 1;

async function issueSession(res, user, authTime = Math.floor(Date.now() / 1000)) {
  const [access, refresh] = await Promise.all([
    signAccess(user),
    signRefresh(user, authTime),
  ]);
  setAuthCookies(res, access, refresh);
}

module.exports = {
  verifyAccess,
  consumeRefresh,
  revokeRefresh,
  revokeAllForUser,
  blacklistAccess,
  isBlacklisted,
  issueSession,
};
