const { spawnSync } = require("child_process");
const path = require("path");

const validEnv = {
  NODE_ENV: "test",
  MONGO_URI: "mongodb://localhost:27017/test",
  REDIS_URL: "redis://localhost:6379",
  JWT_ACCESS_SECRET: "access-secret-unique-012345678901234",
  JWT_REFRESH_SECRET: "refresh-secret-unique-01234567890123",
  CSRF_SECRET: "csrf-secret-unique-01234567890123456",
  CORS_ORIGINS: "http://localhost:5173",
};

test("rejects shipped placeholder secrets without echoing their values", () => {
  const placeholder = "change_me_this_is_not_a_secret";
  const result = spawnSync(
    process.execPath,
    ["-e", "require('./src/config/env')"],
    {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, ...validEnv, JWT_ACCESS_SECRET: placeholder },
      encoding: "utf8",
    },
  );

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("JWT_ACCESS_SECRET");
  expect(result.stderr).not.toContain(placeholder);
});

test("accepts distinct configured secrets", () => {
  const result = spawnSync(
    process.execPath,
    ["-e", "require('./src/config/env')"],
    {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, ...validEnv },
      encoding: "utf8",
    },
  );

  expect(result.status).toBe(0);
});
