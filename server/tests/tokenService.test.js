jest.mock("../src/config/redis", () => {
  const Redis = require("ioredis-mock");
  return new Redis();
});

const redis = require("../src/config/redis");
const tokens = require("../src/services/tokenService");

beforeEach(async () => {
  await redis.flushall();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("refresh-session persistence", () => {
  test("does not issue auth cookies when Redis rejects the refresh-token write", async () => {
    const writeError = new Error("Redis is out of memory");
    const transaction = {
      set: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest
        .fn()
        .mockResolvedValue([[writeError, null], [null, 1], [null, 1]]),
    };
    jest.spyOn(redis, "multi").mockReturnValue(transaction);
    jest.spyOn(redis, "del").mockResolvedValue(0);
    jest.spyOn(redis, "srem").mockResolvedValue(0);
    const response = { cookie: jest.fn() };

    await expect(
      tokens.issueSession(response, {
        _id: "665f1f77bcf86cd799439011",
        role: "admin",
      }),
    ).rejects.toBe(writeError);

    expect(redis.del).toHaveBeenCalledWith(expect.stringMatching(/^rt:/));
    expect(redis.srem).toHaveBeenCalledWith(
      "user_rt:665f1f77bcf86cd799439011",
      expect.any(String),
    );
    expect(response.cookie).not.toHaveBeenCalled();
  });

  test("does not allow refresh rotation past the absolute session age", async () => {
    const response = { cookie: jest.fn() };
    const authTime = Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60;
    await tokens.issueSession(
      response,
      { _id: "665f1f77bcf86cd799439011", role: "admin" },
      authTime,
    );
    const refresh = response.cookie.mock.calls.find(
      ([name]) => name === "refresh_token",
    )[1];

    await expect(tokens.consumeRefresh(refresh)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      status: 401,
    });
    expect(
      await redis.smembers("user_rt:665f1f77bcf86cd799439011"),
    ).toEqual([]);
  });
});
