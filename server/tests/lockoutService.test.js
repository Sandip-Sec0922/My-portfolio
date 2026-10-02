jest.mock("../src/config/redis", () => {
  const Redis = require("ioredis-mock");
  return new Redis();
});

const redis = require("../src/config/redis");
const lockout = require("../src/services/lockoutService");

beforeEach(async () => {
  await redis.flushall();
});

test("increments the failure count atomically while retaining its expiry", async () => {
  const email = "lockout-regression@example.com";

  for (let count = 0; count < 4; count += 1) {
    await expect(lockout.recordFailure(email)).resolves.toBe(false);
  }

  const ttl = await redis.ttl(
    `login:fail:${require("crypto").createHash("sha256").update(email).digest("hex").slice(0, 32)}`,
  );
  expect(ttl).toBeGreaterThan(0);

  await expect(lockout.recordFailure(email)).resolves.toBe(true);
  await expect(lockout.isLocked(email)).resolves.toBe(true);
});
