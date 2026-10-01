"use strict";
const pino = require("pino");
const config = require("../config/env");

// WHY JSON + ISO timestamps: one event per line is what Wazuh/Splunk/ELK ingest without custom parsers.
// Pino JSON-encodes values, so attacker-controlled strings (User-Agent, paths) cannot forge extra
// log lines (log injection).
module.exports = pino({
  level: config.logLevel,
  base: {
    service: "soc-portfolio-api",
    env: config.env,
    instance: config.instanceId,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  messageKey: "message",
  formatters: { level: (label) => ({ level: label }) },
  // WHY: defence in depth so a careless logger.info({ body }) can never write credentials to disk.
  redact: {
    paths: [
      "*.password",
      "*.passwordHash",
      "*.currentPassword",
      "*.newPassword",
      "*.token",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    censor: "[REDACTED]",
  },
});
