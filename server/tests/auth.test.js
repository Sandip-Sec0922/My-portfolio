// Hermetic: Redis is faked in memory and the User/SecurityEvent models are stubbed, so no services are needed.
jest.mock("../src/config/redis", () => {
  const Redis = require("ioredis-mock");
  return new Redis();
});
jest.mock("../src/models/SecurityEvent", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/models/User", () => {
  const store = { user: null };
  const query = () => {
    const p = Promise.resolve(store.user);
    p.select = () => Promise.resolve(store.user);
    return p;
  };
  return {
    __store: store,
    findOne: jest.fn(query),
    findById: jest.fn(query),
    updateOne: jest.fn(() => Promise.resolve({})),
  };
});

const request = require("supertest");
const redis = require("../src/config/redis");
const User = require("../src/models/User");
const passwords = require("../src/services/passwordService");
const { createApp } = require("../src/app");

const EMAIL = "admin@example.com";
const PASSWORD = "Correct-Horse-Battery-42";
let app;
let realUser;

beforeAll(async () => {
  app = createApp();
  realUser = {
    _id: "665f1f77bcf86cd799439011",
    email: EMAIL,
    role: "admin",
    passwordHash: await passwords.hash(PASSWORD),
    save: jest.fn(),
  };
});
beforeEach(async () => {
  User.__store.user = realUser;
  await redis.flushall();
});

const getCookie = (res, name) =>
  res.headers["set-cookie"].find((c) => c.startsWith(`${name}=`));
async function csrf(agent) {
  const r = await agent.get("/api/auth/csrf");
  return {
    token: r.body.csrfToken,
    cookie: getCookie(r, "csrf_token").split(";")[0],
  };
}
const login = (agent, token, password = PASSWORD, email = EMAIL) =>
  agent
    .post("/api/auth/login")
    .set("X-CSRF-Token", token)
    .send({ email, password });

describe("CSRF", () => {
  test("state-changing request without token is rejected", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_FAILED");
  });
  test("token that does not match the cookie is rejected", async () => {
    const agent = request.agent(app);
    await csrf(agent);
    const res = await login(agent, "f".repeat(64) + "." + "f".repeat(64));
    expect(res.status).toBe(403);
  });
});

describe("login", () => {
  test("returns the same response for unknown user and wrong password", async () => {
    const agent = request.agent(app);
    const { token } = await csrf(agent);
    const wrongPw = await login(agent, token, "nope-nope-nope-nope");
    User.__store.user = null;
    const unknown = await login(
      agent,
      token,
      "nope-nope-nope-nope",
      "ghost@example.com",
    );
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrongPw.body.error.message);
  });

  test("locks the account after 5 failures even if the next password is correct", async () => {
    const agent = request.agent(app);
    const { token } = await csrf(agent);
    for (let i = 0; i < 5; i += 1)
      expect((await login(agent, token, "wrong-wrong-wrong")).status).toBe(401);
    const res = await login(agent, token, PASSWORD);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
  });

  test("sets HttpOnly + SameSite=Strict cookies and /me works", async () => {
    const agent = request.agent(app);
    const { token } = await csrf(agent);
    const res = await login(agent, token);
    expect(res.status).toBe(200);
    const access = getCookie(res, "access_token");
    const refresh = getCookie(res, "refresh_token");
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=Strict/i);
    expect(refresh).toMatch(/Path=\/api\/auth/);
    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(EMAIL);
  });

  test("wrong current password does not invalidate an authenticated session", async () => {
    const agent = request.agent(app);
    const { token } = await csrf(agent);
    await login(agent, token);

    const result = await agent
      .post("/api/auth/change-password")
      .set("X-CSRF-Token", token)
      .send({
        currentPassword: "incorrect-current-password",
        newPassword: "Different-Long-Password-42",
      });
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("INVALID_CREDENTIALS");
    expect((await agent.get("/api/auth/me")).status).toBe(200);
  });

  test("blocks NoSQL operator injection", async () => {
    const agent = request.agent(app);
    const { token } = await csrf(agent);
    const res = await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", token)
      .send({ email: { $gt: "" }, password: "x" });
    expect(res.status).toBe(400);
  });
});

describe("sessions", () => {
  test("/me requires authentication", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  test("admin API is denied without a token", async () => {
    expect((await request(app).get("/api/admin/messages")).status).toBe(401);
  });

  test("logout blacklists the access token (replay fails)", async () => {
    const agent = request.agent(app);
    const { token } = await csrf(agent);
    const res = await login(agent, token);
    const stolen = getCookie(res, "access_token").split(";")[0];
    expect(
      (await agent.post("/api/auth/logout").set("X-CSRF-Token", token)).status,
    ).toBe(204);
    const replay = await request(app).get("/api/auth/me").set("Cookie", stolen);
    expect(replay.status).toBe(401);
  });

  test("refresh rotates the token and detects reuse of the old one", async () => {
    const agent = request.agent(app);
    const { token, cookie: csrfCookie } = await csrf(agent);
    const res = await login(agent, token);
    const oldRefresh = getCookie(res, "refresh_token").split(";")[0];

    expect(
      (await agent.post("/api/auth/refresh").set("X-CSRF-Token", token)).status,
    ).toBe(200);

    const replay = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [oldRefresh, csrfCookie])
      .set("X-CSRF-Token", token);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("REFRESH_REUSE");

    // Reuse revoked the whole family, so the legitimately rotated token is dead too.
    expect(
      (await agent.post("/api/auth/refresh").set("X-CSRF-Token", token)).status,
    ).toBe(401);
  });
});
