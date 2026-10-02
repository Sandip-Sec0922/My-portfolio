jest.mock("../src/config/redis", () => ({
  status: "ready",
  ping: jest.fn().mockResolvedValue("PONG"),
}));

const mongoose = require("mongoose");
const redis = require("../src/config/redis");
const health = require("../src/controllers/healthController");

function response() {
  return {
    status: jest.fn(function setStatus(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function setJson(body) {
      this.body = body;
      return this;
    }),
  };
}

beforeEach(() => {
  mongoose.connection.readyState = 1;
  mongoose.connection.db = {
    admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }),
  };
  redis.status = "ready";
  redis.ping.mockResolvedValue("PONG");
});

test("reports ready only after MongoDB and Redis respond", async () => {
  const res = response();
  await health.ready({}, res);

  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.body.dependencies).toEqual({ mongo: true, redis: true });
});

test("reports unavailable when Redis is reachable only by stale status", async () => {
  redis.ping.mockRejectedValue(new Error("connection lost"));
  const res = response();
  await health.ready({}, res);

  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.body.dependencies).toEqual({ mongo: true, redis: false });
});

test("reports unavailable while MongoDB is disconnected", async () => {
  mongoose.connection.readyState = 0;
  const res = response();
  await health.ready({}, res);

  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.body.dependencies).toEqual({ mongo: false, redis: true });
});
