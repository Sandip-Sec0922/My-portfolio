"use strict";
const Redis = require("ioredis");
const config = require("./env");
const logger = require("../utils/logger");

const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 2,
  // rate-limit-redis registers its Lua scripts while the process is loading, before
  // server.js can await the initial Redis connection.
  enableOfflineQueue: true,
  connectTimeout: 5000,
});
redis.on("error", (err) => logger.error({ err: err.message }, "redis_error"));

module.exports = redis;
