"use strict";
const redis = require("../config/redis");
const logger = require("../utils/logger");

const PREFIX = "cache:";

// Cache-aside. Cache failures are non-fatal (fall through to the source of truth).
// `cacheIf` stops attacker-chosen keys (random tags, huge page numbers, unknown slugs) from filling
// Redis: only successful, non-empty results are stored.
const namespaceFor = (key) => key.split(":", 1)[0];

async function versionedKey(key) {
  const namespace = namespaceFor(key);
  try {
    const version = (await redis.get(`${PREFIX}version:${namespace}`)) || "0";
    return `${PREFIX}${namespace}:v${version}:${key.slice(namespace.length + 1)}`;
  } catch (err) {
    logger.warn({ err: err.message }, "cache_version_read_failed");
    return null;
  }
}

async function get(key) {
  const k = await versionedKey(key);
  if (!k) return null;
  return read(k);
}

async function read(k) {
  try {
    const hit = await redis.get(k);
    return hit ? JSON.parse(hit) : null;
  } catch (err) {
    logger.warn({ err: err.message }, "cache_read_failed");
    return null;
  }
}

async function write(k, value, ttlSec) {
  try {
    await redis.set(k, JSON.stringify(value), "EX", ttlSec);
    return true;
  } catch (err) {
    logger.warn({ err: err.message }, "cache_write_failed");
    return false;
  }
}

async function set(key, value, ttlSec) {
  const k = await versionedKey(key);
  if (!k) return false;
  return write(k, value, ttlSec);
}

async function getOrSet(key, ttlSec, fetcher, cacheIf = () => true) {
  const k = await versionedKey(key);
  if (k) {
    const hit = await read(k);
    if (hit !== null) return hit;
  }

  const value = await fetcher();
  if (k && cacheIf(value)) await write(k, value, ttlSec);
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

module.exports = { get, set, getOrSet, invalidate };
