"use strict";
const mongoose = require("mongoose");
const config = require("./config/env");
const logger = require("./utils/logger");
const redis = require("./config/redis");
const { connectDB } = require("./config/db");
const passwords = require("./services/passwordService");
const { createApp } = require("./app");

const waitForRedis = (ms = 10000) =>
  new Promise((resolve, reject) => {
    if (redis.status === "ready") return resolve();
    const t = setTimeout(() => reject(new Error("Redis not ready")), ms);
    redis.once("ready", () => {
      clearTimeout(t);
      resolve();
    });
  });

async function main() {
  await connectDB();
  await waitForRedis();
  await passwords.dummyHash();

  const server = createApp().listen(config.port, () =>
    logger.info({ port: config.port }, "api_listening"),
  );
  // Keep persistent requests bounded while remaining compatible with managed ingress.
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 15000;

  // Graceful shutdown: finish in-flight requests so `docker compose up -d` rolls without dropped requests.
  const shutdown = (signal) => {
    logger.info({ signal }, "shutting_down");
    server.close(async () => {
      await mongoose.disconnect();
      redis.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// After an unknown error the process state is untrusted: log and exit so Docker restarts a clean instance.
process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "unhandled_rejection");
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught_exception");
  process.exit(1);
});

main().catch((err) => {
  logger.fatal({ err }, "startup_failed");
  process.exit(1);
});
