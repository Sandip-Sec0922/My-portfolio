"use strict";
const mongoose = require("mongoose");
const redis = require("../config/redis");
const config = require("../config/env");
const logger = require("../utils/logger");

// Liveness only reports whether this process can serve requests.
exports.live = (req, res) =>
  res.json({ status: "ok", instance: config.instanceId });

// Readiness must verify actual database connectivity, not just client connection state.
exports.ready = async (req, res) => {
  const checks = await Promise.allSettled([
    (async () => {
      if (mongoose.connection.readyState !== 1 || !mongoose.connection.db)
        return false;
      const result = await mongoose.connection.db.admin().ping({ maxTimeMS: 2000 });
      return result.ok === 1;
    })(),
    (async () => redis.status === "ready" && (await redis.ping()) === "PONG")(),
  ]);
  const mongo = checks[0].status === "fulfilled" && checks[0].value;
  const redisReady = checks[1].status === "fulfilled" && checks[1].value;

  checks.forEach((check, index) => {
    if (check.status === "rejected") {
      logger.warn(
        { dependency: index === 0 ? "mongo" : "redis", err: check.reason.message },
        "health_dependency_check_failed",
      );
    }
  });

  const ready = mongo && redisReady;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "degraded",
    dependencies: { mongo: Boolean(mongo), redis: Boolean(redisReady) },
  });
};
