// Hermetic: Redis is faked in memory and the User/SecurityEvent models are stubbed, so no services are needed.
jest.mock("../src/config/redis", () => {
  const Redis = require("ioredis-mock");
  return new Redis();
});
jest.mock("../src/models/SecurityEvent", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/models/Project", () => ({
  find: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));
jest.mock("../src/models/Post", () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndDelete: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock("../src/models/User", () => {
  const store = { user: null };
  const query = (value) => {
    const p = Promise.resolve(value);
    p.select = () => Promise.resolve(value);
    return p;
  };
  return {
    __store: store,
    findOne: jest.fn(() => query(store.user)),
    findById: jest.fn(() => query(store.user)),
    findByIdAndUpdate: jest.fn((_id, update) => {
      if (store.user) {
        Object.assign(store.user, update.$set || {});
        if (update.$inc)
          Object.entries(update.$inc).forEach(([key, value]) => {
            store.user[key] = (store.user[key] || 0) + value;
          });
      }
      return query(store.user);
    }),
    updateOne: jest.fn(() => Promise.resolve({})),
  };
});
jest.mock("../src/services/mailService", () => ({
  canSendPasswordReset: jest.fn(() => true),
  sendAdminPasswordResetOtp: jest.fn().mockResolvedValue(undefined),
}));

const request = require("supertest");
const redis = require("../src/config/redis");
const User = require("../src/models/User");
const Project = require("../src/models/Project");
const Post = require("../src/models/Post");
const passwords = require("../src/services/passwordService");
const mail = require("../src/services/mailService");
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
    authVersion: 0,
    save: jest.fn(),
  };
});
beforeEach(async () => {
  User.__store.user = realUser;
  realUser.passwordHash = await passwords.hash(PASSWORD);
  realUser.authVersion = 0;
  jest.restoreAllMocks();
  jest.clearAllMocks();
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
async function authenticatedAdmin() {
  const agent = request.agent(app);
  const { token } = await csrf(agent);
  const response = await login(agent, token);
  expect(response.status).toBe(200);
  return { agent, token };
}

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

  test("password change invalidates old access and allows a new login", async () => {
    const agent = request.agent(app);
    const { token } = await csrf(agent);
    const loginResult = await login(agent, token);
    const oldAccess = getCookie(loginResult, "access_token").split(";")[0];

    const changed = await agent
      .post("/api/auth/change-password")
      .set("X-CSRF-Token", token)
      .send({
        currentPassword: PASSWORD,
        newPassword: "Different-Long-Password-42",
      });
    expect(changed.status).toBe(204);
    expect(
      (
        await request(app)
          .get("/api/auth/me")
          .set("Cookie", oldAccess)
      ).status,
    ).toBe(401);

    const newSession = request.agent(app);
    const nextCsrf = await csrf(newSession);
    expect(
      (await login(newSession, nextCsrf.token, "Different-Long-Password-42"))
        .status,
    ).toBe(200);
  });

  test("password reset invalidates an already issued access token", async () => {
    const signedIn = request.agent(app);
    const signedInCsrf = await csrf(signedIn);
    const loginResult = await login(signedIn, signedInCsrf.token);
    const oldAccess = getCookie(loginResult, "access_token").split(";")[0];

    const resetAgent = request.agent(app);
    const resetCsrf = await csrf(resetAgent);
    const requested = await resetAgent
      .post("/api/auth/password-reset/request")
      .set("X-CSRF-Token", resetCsrf.token)
      .send({ email: EMAIL });
    expect(requested.status).toBe(202);
    const otp = mail.sendAdminPasswordResetOtp.mock.calls.at(-1)[1];
    jest.spyOn(redis, "eval").mockResolvedValueOnce(1);

    const reset = await resetAgent
      .post("/api/auth/password-reset/complete")
      .set("X-CSRF-Token", resetCsrf.token)
      .send({
        email: EMAIL,
        otp,
        newPassword: "Reset-Long-Password-42",
      });
    expect(reset.status).toBe(204);
    expect(
      (
        await request(app)
          .get("/api/auth/me")
          .set("Cookie", oldAccess)
      ).status,
    ).toBe(401);
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

  test("admin content API is denied without a token", async () => {
    expect((await request(app).get("/api/admin/projects")).status).toBe(401);
    expect((await request(app).get("/api/admin/posts")).status).toBe(401);
    expect(
      (await request(app).post("/api/admin/projects").send({})).status,
    ).toBe(401);
    expect(
      (await request(app).post("/api/admin/posts").send({})).status,
    ).toBe(401);
    expect(Project.create).not.toHaveBeenCalled();
    expect(Post.create).not.toHaveBeenCalled();
  });

  test("logout blacklists the access token (replay fails)", async () => {
    const agent = request.agent(app);
    const { token } = await csrf(agent);
    const res = await login(agent, token);
    const stolen = getCookie(res, "access_token").split(";")[0];
    expect(getCookie(res, "access_token")).toMatch(/Path=\/api(?:;|$)/);

    const loggedOut = await agent
      .post("/api/auth/logout")
      .set("X-CSRF-Token", token);
    expect(loggedOut.status).toBe(204);
    const clearedAccess = getCookie(loggedOut, "access_token");
    expect(clearedAccess).toMatch(/Path=\/api(?:;|$)/);
    expect(clearedAccess).toMatch(/Expires=Thu, 01 Jan 1970/i);
    const replay = await request(app).get("/api/auth/me").set("Cookie", stolen);
    expect(replay.status).toBe(401);
  });

  test("logout-all invalidates existing access tokens and clears cookies", async () => {
    const agent = request.agent(app);
    const { token } = await csrf(agent);
    const res = await login(agent, token);
    const stolen = getCookie(res, "access_token").split(";")[0];

    const loggedOut = await agent
      .post("/api/auth/logout-all")
      .set("X-CSRF-Token", token);
    expect(loggedOut.status).toBe(204);
    expect(loggedOut.headers["set-cookie"].join(";")).toMatch(
      /Expires=Thu, 01 Jan 1970/,
    );
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

  test("concurrent refresh attempts cannot both consume the same token", async () => {
    const agent = request.agent(app);
    const { token, cookie: csrfCookie } = await csrf(agent);
    const res = await login(agent, token);
    const oldRefresh = getCookie(res, "refresh_token").split(";")[0];

    const attempts = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(app)
          .post("/api/auth/refresh")
          .set("Cookie", [oldRefresh, csrfCookie])
          .set("X-CSRF-Token", token),
      ),
    );

    expect(attempts.map(({ status }) => status).sort()).toEqual([200, 401]);
    expect(attempts.find(({ status }) => status === 401).body.error.code).toBe(
      "REFRESH_REUSE",
    );
  });
});

describe("admin content management", () => {
  const projectInput = {
    title: "Defensive Lab",
    slug: "defensive-lab",
    summary: "A defensive security project.",
    description: "A project used to validate the authenticated project flow.",
    category: "automation",
    tech: ["Node.js"],
    securityHighlights: [],
    featured: false,
    order: 1,
  };
  const postInput = {
    title: "Triage notes",
    slug: "triage-notes",
    excerpt: "Notes from an investigation.",
    content: "Review the authentication timeline.",
    category: "incident-report",
    tags: ["auth"],
    published: true,
  };

  test("project create, update, and delete invalidate cached public lists", async () => {
    const { agent, token } = await authenticatedAdmin();
    const created = { _id: "665f1f77bcf86cd799439012", ...projectInput };
    const updated = { ...created, title: "Defensive Lab Updated" };
    Project.create.mockResolvedValue(created);
    Project.findByIdAndUpdate.mockResolvedValue(updated);
    Project.findByIdAndDelete.mockResolvedValue(updated);

    const createResponse = await agent
      .post("/api/admin/projects")
      .set("X-CSRF-Token", token)
      .send(projectInput);
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject(projectInput);
    expect(await redis.get("cache:version:projects")).toBe("1");

    const updateResponse = await agent
      .put(`/api/admin/projects/${created._id}`)
      .set("X-CSRF-Token", token)
      .send({ title: updated.title });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.title).toBe(updated.title);
    expect(Project.findByIdAndUpdate).toHaveBeenCalledWith(
      created._id,
      { $set: { title: updated.title } },
      { new: true, runValidators: true },
    );
    expect(await redis.get("cache:version:projects")).toBe("2");

    const deleteResponse = await agent
      .delete(`/api/admin/projects/${created._id}`)
      .set("X-CSRF-Token", token);
    expect(deleteResponse.status).toBe(204);
    expect(await redis.get("cache:version:projects")).toBe("3");
  });

  test("post create, update, and delete invalidate cached content", async () => {
    const { agent, token } = await authenticatedAdmin();
    const created = {
      _id: "665f1f77bcf86cd799439013",
      ...postInput,
      publishedAt: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    Post.create.mockResolvedValue(created);
    Post.findById.mockResolvedValue(created);
    Post.findByIdAndDelete.mockResolvedValue(created);

    const createResponse = await agent
      .post("/api/admin/posts")
      .set("X-CSRF-Token", token)
      .send({ ...postInput, published: false });
    expect(createResponse.status).toBe(201);
    expect(Post.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...postInput, published: false, publishedAt: null }),
    );
    expect(await redis.get("cache:version:posts")).toBe("1");

    const updateResponse = await agent
      .put(`/api/admin/posts/${created._id}`)
      .set("X-CSRF-Token", token)
      .send({ published: true });
    expect(updateResponse.status).toBe(200);
    expect(created.save).toHaveBeenCalledTimes(1);
    expect(created.publishedAt).toBeInstanceOf(Date);
    expect(await redis.get("cache:version:posts")).toBe("2");

    const deleteResponse = await agent
      .delete(`/api/admin/posts/${created._id}`)
      .set("X-CSRF-Token", token);
    expect(deleteResponse.status).toBe(204);
    expect(await redis.get("cache:version:posts")).toBe("3");
  });
});
