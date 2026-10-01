"use strict";
const config = require("../config/env");
const redis = require("../config/redis");
const asyncHandler = require("../utils/asyncHandler");
const cache = require("../services/cacheService");
const SecurityEvent = require("../models/SecurityEvent");
const { PUBLIC_EVENT_TYPES } = require("../utils/constants");

const DAYS = 7;

async function computePosture() {
  const days = Array.from({ length: DAYS }, (_, i) =>
    new Date(Date.now() - (DAYS - 1 - i) * 86400000).toISOString().slice(0, 10),
  );
  const keys = days.flatMap((d) =>
    PUBLIC_EVENT_TYPES.map((t) => `sec:count:${t}:${d}`),
  );
  const vals = await redis.mget(keys);

  const totals = Object.fromEntries(PUBLIC_EVENT_TYPES.map((t) => [t, 0]));
  const daily = days.map((date, di) => {
    const byType = {};
    let total = 0;
    PUBLIC_EVENT_TYPES.forEach((t, ti) => {
      const n = Number(vals[di * PUBLIC_EVENT_TYPES.length + ti]) || 0;
      byType[t] = n;
      totals[t] += n;
      total += n;
    });
    return { date, total, byType };
  });
  return {
    windowDays: DAYS,
    totals,
    daily,
    generatedAt: new Date().toISOString(),
  };
}

// PUBLIC and deliberately sanitized: counts only. No IPs, paths, user agents or usernames.
exports.posture = asyncHandler(async (req, res) => {
  const data = await cache.getOrSet("security:posture", 60, computePosture);
  res.set("Cache-Control", "public, max-age=30");
  // servedBy shows the load balancer rotating replicas. Low-risk info, bounded to this one field.
  res.json({ ...data, servedBy: config.instanceId });
});

// ADMIN ONLY: detailed events (includes IPs).
exports.events = asyncHandler(async (req, res) => {
  const { page, type } = req.query;
  const filter = type ? { type } : {};
  const SIZE = 50;
  const [items, total] = await Promise.all([
    SecurityEvent.find(filter)
      .select("-__v")
      .sort({ ts: -1 })
      .skip((page - 1) * SIZE)
      .limit(SIZE)
      .lean(),
    SecurityEvent.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / SIZE) });
});
