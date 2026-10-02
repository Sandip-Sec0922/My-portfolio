"use strict";

process.env.GITHUB_TOKEN = "test-token";

const redisStore = new Map();
const mockRedis = {
  get: jest.fn(async (key) => redisStore.get(key) || null),
  set: jest.fn(async (key, value) => {
    redisStore.set(key, value);
    return "OK";
  }),
  eval: jest.fn(async () => 1),
};

jest.mock("../src/config/redis", () => mockRedis);
jest.mock("../src/services/cacheService", () => ({
  getOrSet: (_key, _ttl, fetcher) => fetcher(),
}));
jest.mock("../src/utils/logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

const logger = require("../src/utils/logger");
const { getGithubData } = require("../src/services/githubService");

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
