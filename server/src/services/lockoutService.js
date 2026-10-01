"use strict";
const crypto = require("crypto");
const redis = require("../config/redis");

const MAX_FAILS = 5;
const WINDOW_SEC = 15 * 60;
const LOCK_SEC = 15 * 60;

// Keyed by a hash of the email: bounded key length, and works identically for emails that don't exist
// (so lockout behaviour can't be used to enumerate accounts).
const id = (email) =>
  crypto.createHash("sha256").update(email).digest("hex").slice(0, 32);

const isLocked = async (email) =>
  (await redis.exists(`login:lock:${id(email)}`)) === 1;

async function recordFailure(email) {
  const h = id(email);
  const n = await redis.incr(`login:fail:${h}`);
  if (n === 1) await redis.expire(`login:fail:${h}`, WINDOW_SEC);
  if (n >= MAX_FAILS) {
    await redis.set(`login:lock:${h}`, "1", "EX", LOCK_SEC);
    await redis.del(`login:fail:${h}`);
    return true;
  }
  return false;
}

const clear = (email) => redis.del(`login:fail:${id(email)}`);

module.exports = { isLocked, recordFailure, clear };
