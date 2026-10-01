"use strict";
const redis = require("../config/redis");
const logger = require("../utils/logger");

const PREFIX = "cache:";

// Cache-aside. Cache failures are non-fatal (fall through to the source of truth).
// `cacheIf` stops attacker-chosen keys (random tags, huge page numbers, unknown slugs) from filling
// Redis: only successful, non-empty results are stored.
async function getOrSet(key, ttlSec, fetcher, cacheIf = () => true) {
  const k = PREFIX + key;
  try {
    const hit = await redis.get(k);
    if (hit) return JSON.parse(hit);
  } catch (err) {
    logger.warn({ err: err.message }, "cache_read_failed");
  }
  const value = await fetcher();
  if (cacheIf(value)) {
    try {
      await redis.set(k, JSON.stringify(value), "EX", ttlSec);
    } catch (err) {
      logger.warn({ err: err.message }, "cache_write_failed");
    }
  }
  return value;
}

// Called after every admin write. SCAN (not KEYS) so it never blocks Redis.
// If Redis is down the TTL still bounds how stale data can get.
async function invalidate(prefix) {
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${PREFIX}${prefix}*`,
        "COUNT",
        100,
      );
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (err) {
    logger.error({ err: err.message, prefix }, "cache_invalidate_failed");
  }
}

module.exports = { getOrSet, invalidate };
