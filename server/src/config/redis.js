"use strict";
const Redis = require("ioredis");
const config = require("./env");
const logger = require("../utils/logger");

// enableOfflineQueue:false -> commands fail immediately when Redis is down instead of
// piling up in memory. Security-critical callers (token blacklist, lockout) then fail CLOSED.
const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
  connectTimeout: 5000,
});
redis.on("error", (err) => logger.error({ err: err.message }, "redis_error"));

module.exports = redis;
