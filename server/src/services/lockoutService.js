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
  const results = await redis
    .multi()
    .set(`login:fail:${h}`, "0", "EX", WINDOW_SEC, "NX")
    .incr(`login:fail:${h}`)
    .exec();
  if (!Array.isArray(results))
    throw new Error("Login failure counter transaction did not execute");
  const failure = results.find(([err]) => err)?.[0];
  if (failure) throw failure;
  const n = results[1]?.[1];
  if (!Number.isInteger(n))
    throw new Error("Login failure counter returned an invalid value");
  if (n >= MAX_FAILS) {
    await redis.set(`login:lock:${h}`, "1", "EX", LOCK_SEC);
    await redis.del(`login:fail:${h}`);
    return true;
  }
  return false;
}

const clear = (email) => redis.del(`login:fail:${id(email)}`);

module.exports = { isLocked, recordFailure, clear };
