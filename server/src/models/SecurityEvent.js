"use strict";
const mongoose = require("mongoose");
const { ALL_EVENT_TYPES } = require("../utils/constants");

const securityEventSchema = new mongoose.Schema({
  type: { type: String, enum: ALL_EVENT_TYPES, required: true },
  ip: String,
  method: String,
  path: String,
  userAgent: String,
  requestId: String,
  details: mongoose.Schema.Types.Mixed,
  // 30-day retention keeps the collection bounded. Long-term retention belongs in your SIEM via stdout logs.
  ts: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
});
securityEventSchema.index({ type: 1, ts: -1 });

module.exports = mongoose.model("SecurityEvent", securityEventSchema);
