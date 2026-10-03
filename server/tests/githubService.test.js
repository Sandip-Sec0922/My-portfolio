"use strict";

process.env.GITHUB_TOKEN = "test-token";

const redisStore = new Map();
const mockRedis = {
  get: jest.fn(async (key) => redisStore.get(key) || null),
  set: jest.fn(async (key, value) => {
    redisStore.set(key, value);
    return "OK";
  }),
  incr: jest.fn(async (key) => {
    const next = Number(redisStore.get(key) || 0) + 1;
    redisStore.set(key, String(next));
    return next;
  }),
  eval: jest.fn(async () => 1),
};

jest.mock("../src/config/redis", () => mockRedis);
jest.mock("../src/utils/logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

const logger = require("../src/utils/logger");
const config = require("../src/config/env");
const cache = require("../src/services/cacheService");
const { getGithubData } = require("../src/services/githubService");
const originalToken = config.github.token;

afterEach(() => {
  config.github.token = originalToken;
});

const response = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => headers[name.toLowerCase()] || null },
  json: jest.fn().mockResolvedValue(body),
});

beforeEach(() => {
  redisStore.clear();
  jest.clearAllMocks();
});

test("retries public GitHub data without a rejected configured token", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(response(401, { message: "Bad credentials" }))
    .mockResolvedValueOnce(response(200, []));

  await expect(getGithubData()).resolves.toMatchObject({ repos: [] });

  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeDefined();
  expect(global.fetch.mock.calls[1][1].headers.Authorization).toBeUndefined();
  expect(logger.warn).toHaveBeenCalledWith(
    { status: 401 },
    "github_token_rejected",
  );
});

test("tries the configured credential again after a later rotation", async () => {
  config.github.token = "rejected-token";
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(response(401, { message: "Bad credentials" }))
    .mockResolvedValueOnce(response(200, []))
    .mockResolvedValueOnce(response(200, []));

  await expect(getGithubData()).resolves.toMatchObject({ repos: [] });
  config.github.token = "corrected-token";
  await cache.invalidate("github:");
  await expect(getGithubData()).resolves.toMatchObject({ repos: [] });

  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(global.fetch.mock.calls[2][1].headers.Authorization).toBe(
    "Bearer corrected-token",
  );
});

test("coalesces concurrent refreshes and writes fresh and stale values through the shared cache", async () => {
  global.fetch = jest.fn().mockResolvedValue(response(200, []));

  const [first, second] = await Promise.all([
    getGithubData(),
    getGithubData(),
  ]);

  expect(first).toEqual(second);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(redisStore.has("cache:github:v0:repos")).toBe(true);
  expect(redisStore.has("cache:github:v0:stale:repos")).toBe(true);
  expect(redisStore.has("cache:github:repos")).toBe(false);
  expect(redisStore.has("stale:github")).toBe(false);
});

test("serves the versioned stale GitHub copy after an upstream failure", async () => {
  const stale = { repos: [{ name: "cached" }], fetchedAt: "yesterday" };
  await cache.set("github:stale:repos", stale, 86400);
  global.fetch = jest.fn().mockResolvedValue(
    response(403, { message: "API rate limit exceeded" }),
  );

  await expect(getGithubData()).resolves.toEqual({ ...stale, stale: true });
});

test("records GitHub rate-limit details when the upstream request is rejected", async () => {
  global.fetch = jest.fn().mockResolvedValue(
    response(
      403,
      { message: "API rate limit exceeded" },
      { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1234567890" },
    ),
  );

  await expect(getGithubData()).rejects.toMatchObject({
    status: 502,
    code: "UPSTREAM_ERROR",
  });
  expect(logger.warn).toHaveBeenCalledWith(
    expect.objectContaining({
      upstreamStatus: 403,
      rateLimitRemaining: "0",
      rateLimitReset: "1234567890",
    }),
    "github_fetch_failed",
  );
});
