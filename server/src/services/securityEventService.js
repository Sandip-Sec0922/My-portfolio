"use strict";
const crypto = require("crypto");
const logger = require("../utils/logger");
const redis = require("../config/redis");
const SecurityEvent = require("../models/SecurityEvent");

function context(req) {
  if (!req) return {};
  return {
    request_id: req.id,
    ip: req.ip,
    method: req.method,
    path: String(req.originalUrl || "")
      .split("?")[0]
      .slice(0, 200),
    user_agent: String((req.get && req.get("user-agent")) || "").slice(0, 200),
  };
}

// Keep only small primitives from `details`; never store bodies or objects.
const clean = (d) =>
  Object.fromEntries(
    Object.entries(d)
      .filter(([, v]) => ["string", "number", "boolean"].includes(typeof v))
      .map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 200) : v]),
  );

async function persist(type, ctx, details) {
  // 1) Daily counters in Redis -> public "Security Posture" page (aggregates only, no IPs).
  const day = new Date().toISOString().slice(0, 10);
  const key = `sec:count:${type}:${day}`;
  const results = await redis
    .multi()
    .incr(key)
    .expire(key, 8 * 86400)
    .exec();
  if (!Array.isArray(results))
    throw new Error("Security event counter transaction did not execute");
  const failure = results.find(([err]) => err)?.[0];
  if (failure) throw failure;

  // 2) Detailed record in Mongo -> admin dashboard. De-duplicated to 1 per IP+type per minute so a
  // flood of blocked requests can't become a database-write DoS. Counters above still count every hit.
  const ipHash = crypto
    .createHash("sha256")
    .update(ctx.ip || "-")
    .digest("hex")
    .slice(0, 16);
  const first = await redis.set(
    `sec:dedupe:${type}:${ipHash}`,
    "1",
    "EX",
    60,
    "NX",
  );
  if (first === "OK") {
    await SecurityEvent.create({
      type,
      ip: ctx.ip,
      method: ctx.method,
      path: ctx.path,
      userAgent: ctx.user_agent,
      requestId: ctx.request_id,
      details: clean(details),
    });
  }
}

// Emits one SIEM-friendly JSON line to stdout (event_type=security) and records counters.
// Fire-and-forget: security telemetry must never break or slow the request it describes.
function logSecurity(type, req, details = {}) {
  const ctx = context(req);
  const level = type === "login_success" || type === "logout" ? "info" : "warn";
  logger[level](
    { event_type: "security", event: type, ...ctx, ...clean(details) },
    `security:${type}`,
  );
  persist(type, ctx, details).catch((err) =>
    logger.error({ err: err.message }, "security_event_persist_failed"),
  );
}

module.exports = { logSecurity };
