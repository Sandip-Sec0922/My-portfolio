"use strict";
const mongoose = require("mongoose");
const redis = require("../config/redis");
const config = require("../config/env");

// Liveness: no dependencies on purpose. If Mongo blips, Docker must not kill all three replicas at once.
exports.live = (req, res) =>
  res.json({ status: "ok", instance: config.instanceId });

// Readiness: checks dependencies, for debugging and orchestrators.
exports.ready = (req, res) => {
  const ok = mongoose.connection.readyState === 1 && redis.status === "ready";
  res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "degraded" });
};
