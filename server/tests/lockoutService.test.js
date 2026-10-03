jest.mock("../src/config/redis", () => {
  const Redis = require("ioredis-mock");
  return new Redis();
});

const redis = require("../src/config/redis");
const lockout = require("../src/services/lockoutService");
const config = require("../src/config/env");
const crypto = require("crypto");

beforeEach(async () => {
  await redis.flushall();
});

test("increments the failure count atomically while retaining its expiry", async () => {
  const email = "lockout-regression@example.com";
  const ip = "192.0.2.10";

  for (let count = 0; count < 4; count += 1) {
    await expect(lockout.recordFailure(email, ip)).resolves.toBe(false);
  }

  const keys = `login:${lockout.accountId(email)}:`;
  const ipId = crypto
    .createHmac("sha256", config.csrfSecret)
    .update(ip)
    .digest("hex")
    .slice(0, 24);
  const ttl = await redis.ttl(`${keys}${ipId}:fail`);
  expect(ttl).toBeGreaterThan(0);

  await expect(lockout.recordFailure(email, ip)).resolves.toBe(true);
  await expect(lockout.isLocked(email, ip)).resolves.toBe(true);
  await expect(lockout.isLocked(email, "192.0.2.11")).resolves.toBe(false);
});

test("a successful login clears the source-IP lock without locking the account globally", async () => {
  const email = "lockout-regression@example.com";
  const attackingIp = "192.0.2.10";
  const trustedIp = "192.0.2.11";

  for (let attempt = 0; attempt < 5; attempt += 1)
    await lockout.recordFailure(email, attackingIp);

  await expect(lockout.isLocked(email, attackingIp)).resolves.toBe(true);
  await expect(lockout.isLocked(email, trustedIp)).resolves.toBe(false);
  await lockout.clear(email, trustedIp);
  await expect(lockout.isLocked(email, attackingIp)).resolves.toBe(true);
  await lockout.clear(email);
  await expect(lockout.isLocked(email, attackingIp)).resolves.toBe(false);
});
