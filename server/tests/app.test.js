"use strict";
jest.mock("../src/config/redis", () => {
  const Redis = require("ioredis-mock");
  return new Redis();
});
jest.mock("../src/models/SecurityEvent", () => ({
  create: jest.fn().mockResolvedValue({}),
}));

const request = require("supertest");
const { createApp } = require("../src/app");

const app = createApp();

test("root probes return the API liveness response", async () => {
  const get = await request(app).get("/");
  expect(get.status).toBe(200);
  expect(get.body.status).toBe("ok");

  const head = await request(app).head("/");
  expect(head.status).toBe(200);
});
