"use strict";
const redis = require("../config/redis");
const logger = require("../utils/logger");

const PREFIX = "cache:";

// Cache-aside. Cache failures are non-fatal (fall through to the source of truth).
// `cacheIf` stops attacker-chosen keys (random tags, huge page numbers, unknown slugs) from filling
// Redis: only successful, non-empty results are stored.
const namespaceFor = (key) => key.split(":", 1)[0];

async function getOrSet(key, ttlSec, fetcher, cacheIf = () => true) {
  const namespace = namespaceFor(key);
  let version = "0";
  let versionAvailable = true;
  try {
    version = (await redis.get(`${PREFIX}version:${namespace}`)) || "0";
  } catch (err) {
    versionAvailable = false;
    logger.warn({ err: err.message }, "cache_version_read_failed");
  }
  const k = `${PREFIX}${namespace}:v${version}:${key.slice(namespace.length + 1)}`;
  if (versionAvailable) {
    try {
      const hit = await redis.get(k);
      if (hit) return JSON.parse(hit);
    } catch (err) {
      logger.warn({ err: err.message }, "cache_read_failed");
    }
  }
  const value = await fetcher();
  if (versionAvailable && cacheIf(value)) {
    try {
      await redis.set(k, JSON.stringify(value), "EX", ttlSec);
    } catch (err) {
      logger.warn({ err: err.message }, "cache_write_failed");
    }
  }
  return value;
}

// Incrementing the namespace version makes in-flight readers' writes unreachable after a mutation.
// Old versions expire naturally, avoiding a blocking key scan.
async function invalidate(prefix) {
  const namespace = namespaceFor(prefix);
  try {
    await redis.incr(`${PREFIX}version:${namespace}`);
  } catch (err) {
    logger.error({ err: err.message, namespace }, "cache_invalidate_failed");
  }
}

module.exports = { getOrSet, invalidate };
