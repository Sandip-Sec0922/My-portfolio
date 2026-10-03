"use strict";
const crypto = require("crypto");
const redis = require("../config/redis");
const config = require("../config/env");

const MAX_FAILS = 5;
const WINDOW_SEC = 15 * 60;
const LOCK_SEC = 15 * 60;

const hash = (value) =>
  crypto
    .createHmac("sha256", config.csrfSecret)
    .update(value)
    .digest("hex")
    .slice(0, 24);
const accountId = (email) => hash(email.trim().toLowerCase());
const keysFor = (email, ip) => {
  const prefix = `login:${accountId(email)}:${hash(ip || "-")}`;
  return { failures: `${prefix}:fail`, lock: `${prefix}:lock` };
};

const isLocked = async (email, ip) =>
  (await redis.exists(keysFor(email, ip).lock)) === 1;

async function recordFailure(email, ip) {
  const keys = keysFor(email, ip);
  const results = await redis
    .multi()
    .set(keys.failures, "0", "EX", WINDOW_SEC, "NX")
    .incr(keys.failures)
    .exec();
  if (!Array.isArray(results))
    throw new Error("Login failure counter transaction did not execute");
  const failure = results.find(([err]) => err)?.[0];
  if (failure) throw failure;
  const n = results[1]?.[1];
  if (!Number.isInteger(n))
    throw new Error("Login failure counter returned an invalid value");
  if (n >= MAX_FAILS) {
    await redis.set(keys.lock, "1", "EX", LOCK_SEC);
    await redis.del(keys.failures);
    return true;
  }
  return false;
}

async function clear(email, ip) {
  const accountPrefix = `login:${accountId(email)}:`;
  if (ip) {
    const keys = keysFor(email, ip);
    await redis.del(keys.failures, keys.lock);
    return;
  }
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      `${accountPrefix}*`,
      "COUNT",
      100,
    );
    cursor = next;
    if (keys.length) await redis.del(...keys);
  } while (cursor !== "0");
}

module.exports = { accountId, isLocked, recordFailure, clear };
