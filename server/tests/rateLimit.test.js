"use strict";

let mockRedisUnavailable = false;
const mockStores = [];

jest.mock("../src/config/env", () => ({
  ...jest.requireActual("../src/config/env"),
  isTest: false,
}));
jest.mock("../src/config/redis", () => ({ call: jest.fn() }));
jest.mock("../src/services/securityEventService", () => ({
  logSecurity: jest.fn(),
}));
jest.mock("rate-limit-redis", () => {
  const AppError = require("../src/utils/AppError");
  return {
    RedisStore: class TestRedisStore {
      constructor() {
        this.counters = new Map();
        mockStores.push(this);
      }

      init(options) {
        this.windowMs = options.windowMs;
      }

      async increment(key) {
        if (mockRedisUnavailable)
          throw new AppError(
            503,
            "RATE_LIMIT_UNAVAILABLE",
            "Request protection is temporarily unavailable",
          );
        const now = Date.now();
        let entry = this.counters.get(key);
        if (!entry || entry.resetTime <= now) {
          entry = { totalHits: 0, resetTime: now + this.windowMs };
        }
        entry.totalHits += 1;
        this.counters.set(key, entry);
        return {
          totalHits: entry.totalHits,
          resetTime: new Date(entry.resetTime),
        };
      }

      async decrement(key) {
        const entry = this.counters.get(key);
        if (entry) entry.totalHits = Math.max(0, entry.totalHits - 1);
      }

      async resetKey(key) {
        this.counters.delete(key);
      }
    },
  };
});

const express = require("express");
const request = require("supertest");
const { errorHandler } = require("../src/middleware/errorHandler");
const {
  globalLimiter,
  loginLimiter,
  contactLimiter,
  adminLimiter,
} = require("../src/middleware/rateLimit");

const app = express();
app.set("trust proxy", 1);
app.get("/global", globalLimiter, (req, res) => res.sendStatus(200));
app.post("/login", loginLimiter, (req, res) => res.sendStatus(401));
app.post("/contact", contactLimiter, (req, res) => res.sendStatus(201));
app.post("/admin", adminLimiter, (req, res) => res.sendStatus(204));
app.use(errorHandler);

beforeEach(() => {
  mockRedisUnavailable = false;
  mockStores.forEach((store) => store.counters.clear());
});

test("allows requests under the configured login limit and blocks excess attempts per IP", async () => {
  for (let attempt = 0; attempt < 5; attempt += 1)
    expect((await request(app).post("/login").set("X-Forwarded-For", "192.0.2.1")).status).toBe(401);

  const blocked = await request(app)
    .post("/login")
    .set("X-Forwarded-For", "192.0.2.1");
  expect(blocked.status).toBe(429);

  const otherIp = await request(app)
    .post("/login")
    .set("X-Forwarded-For", "192.0.2.2");
  expect(otherIp.status).toBe(401);
});

test("limits contact and admin operations", async () => {
  for (let attempt = 0; attempt < 5; attempt += 1)
    expect((await request(app).post("/contact")).status).toBe(201);
  expect((await request(app).post("/contact")).status).toBe(429);

  for (let attempt = 0; attempt < 200; attempt += 1)
    expect((await request(app).post("/admin")).status).toBe(204);
  expect((await request(app).post("/admin")).status).toBe(429);
});

test("keeps public requests available but fails closed for sensitive limiters when Redis is down", async () => {
  mockRedisUnavailable = true;

  expect((await request(app).get("/global")).status).toBe(200);
  const response = await request(app).post("/contact");
  expect(response.status).toBe(503);
  expect(response.body.error.code).toBe("RATE_LIMIT_UNAVAILABLE");
});
