"use strict";

const entries = new Map();
const mockRedis = {
  get: jest.fn(async (key) => entries.get(key) || null),
  set: jest.fn(async (key, value) => {
    entries.set(key, value);
    return "OK";
  }),
  incr: jest.fn(async (key) => {
    const next = Number(entries.get(key) || 0) + 1;
    entries.set(key, String(next));
    return next;
  }),
};

jest.mock("../src/config/redis", () => mockRedis);
jest.mock("../src/utils/logger", () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

const cache = require("../src/services/cacheService");

beforeEach(() => {
  entries.clear();
  jest.clearAllMocks();
});

test("uses cache hits and stores cache misses", async () => {
  const fetcher = jest.fn().mockResolvedValue({ items: ["project"] });

  await expect(
    cache.getOrSet("projects:list:all", 60, fetcher),
  ).resolves.toEqual({ items: ["project"] });
  await expect(
    cache.getOrSet("projects:list:all", 60, fetcher),
  ).resolves.toEqual({ items: ["project"] });

  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("an in-flight old read cannot repopulate the current cache after invalidation", async () => {
  let resolveOldRead;
  let markFetchStarted;
  const fetchStarted = new Promise((resolve) => { markFetchStarted = resolve; });
  const oldRead = cache.getOrSet(
    "projects:list:all",
    60,
    () => new Promise((resolve) => {
      resolveOldRead = resolve;
      markFetchStarted();
    }),
  );

  await fetchStarted;
  await cache.invalidate("projects:");
  resolveOldRead({ items: ["old"] });
  await oldRead;

  const fetcher = jest.fn().mockResolvedValue({ items: ["new"] });
  await expect(
    cache.getOrSet("projects:list:all", 60, fetcher),
  ).resolves.toEqual({ items: ["new"] });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("reads from the source of truth if cache version lookup fails", async () => {
  mockRedis.get.mockRejectedValueOnce(new Error("Redis unavailable"));
  const fetcher = jest.fn().mockResolvedValue({ items: ["source"] });

  await expect(
    cache.getOrSet("posts:list:all", 60, fetcher),
  ).resolves.toEqual({ items: ["source"] });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(mockRedis.set).not.toHaveBeenCalled();
});
