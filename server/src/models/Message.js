"use strict";
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 80 },
  email: { type: String, required: true, maxlength: 254 },
  subject: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 2000 },
  ip: String,
  userAgent: { type: String, maxlength: 200 },
  read: { type: Boolean, default: false },
  // WHY TTL: data minimisation. Visitor PII (email, IP) auto-deletes after 180 days.
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 180 },
});

module.exports = mongoose.model("Message", messageSchema);
