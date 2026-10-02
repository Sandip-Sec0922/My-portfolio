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

function loadEnv(overrides = {}) {
  const env = { ...process.env, ...validEnv, ...overrides };
  if (!Object.hasOwn(overrides, "PORT")) delete env.PORT;
  return spawnSync(
    process.execPath,
    ["-e", "const e=require('./src/config/env'); console.log(JSON.stringify({port:e.port}))"],
    {
      cwd: path.join(__dirname, ".."),
      env,
      encoding: "utf8",
    },
  );
}

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
  const result = loadEnv();
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({ port: 10000 });
});

test.each([
  ["missing", ""],
  ["wildcard", "*"],
  ["localhost", "http://localhost:5173"],
  ["multiple origins", "https://portfolio.example,https://preview.example"],
])("refuses production CORS origin configuration: %s", (_name, origin) => {
  const result = loadEnv({
    NODE_ENV: "production",
    CORS_ORIGINS: origin,
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("CORS_ORIGINS");
});

test("accepts one exact HTTPS frontend origin in production", () => {
  const result = loadEnv({
    NODE_ENV: "production",
    CORS_ORIGINS:
      "https://my-portfolio-m3bc-9f23jsctz-sandip-80b8.vercel.app",
  });

  expect(result.status).toBe(0);
});
