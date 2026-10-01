"use strict";
const { randomUUID } = require("crypto");
const pinoHttp = require("pino-http");
const logger = require("../utils/logger");

module.exports = pinoHttp({
  logger,
  // Accept Nginx's $request_id so one ID follows a request across both tiers. Strict pattern =
  // an attacker can't inject arbitrary content into the correlation field.
  genReqId(req, res) {
    const h = req.headers["x-request-id"];
    const id =
      typeof h === "string" && /^[A-Za-z0-9-]{8,64}$/.test(h)
        ? h
        : randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  autoLogging: { ignore: (req) => req.url === "/api/health" }, // don't drown real events in health-check noise
  customLogLevel: (req, res, err) =>
    err || res.statusCode >= 500
      ? "error"
      : res.statusCode >= 400
        ? "warn"
        : "info",
  customProps: (req) => ({
    event_type: "http",
    ip: req.ip,
    user_agent: (req.headers["user-agent"] || "").slice(0, 200),
  }),
  // WHY custom serializers: log the path WITHOUT the query string, and no headers (cookies/tokens).
  serializers: {
    req: (r) => ({
      id: r.id,
      method: r.method,
      path: String(r.url).split("?")[0],
    }),
    res: (r) => ({ status: r.statusCode }),
  },
});
