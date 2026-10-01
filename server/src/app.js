"use strict";
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const httpLogger = require("./middleware/httpLogger");
const {
  helmetMw,
  permissionsPolicy,
  noStore,
  corsMw,
} = require("./middleware/security");
const { globalLimiter } = require("./middleware/rateLimit");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const { logSecurity } = require("./services/securityEventService");
const health = require("./controllers/healthController");
const routes = require("./routes");

// WHY two parsers: 16 KB is plenty for everything public; only admin blog posts need more.
// Nginx (Phase 3) enforces a matching client_max_body_size per location.
const small = express.json({ limit: "16kb", strict: true });
const large = express.json({ limit: "256kb", strict: true });
const bodyParser = (req, res, next) =>
  (req.path.startsWith("/api/admin/posts") ? large : small)(req, res, next);

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Exactly one proxy (Nginx) sits in front. Trusting more would let clients spoof X-Forwarded-For
  // and dodge rate limits / pollute logs.
  app.set("trust proxy", 1);

  app.use(httpLogger);
  app.use(helmetMw);
  app.use(permissionsPolicy);
  app.use(noStore);

  app.get("/api/health", health.live); // before limiter: health checks must never be throttled

  app.use(corsMw);
  app.use(globalLimiter); // before body parsing: reject floods cheaply
  app.use(bodyParser); // JSON only; urlencoded/multipart intentionally not supported
  app.use(cookieParser());
  // Strip $-operators and dotted keys from body/query/params (NoSQL injection), and log each attempt.
  app.use(
    mongoSanitize({
      onSanitize: ({ req, key }) =>
        logSecurity("nosql_injection_blocked", req, { key }),
    }),
  );
  app.use(hpp()); // HTTP parameter pollution: duplicate params collapse to the last value

  app.use("/api", routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
