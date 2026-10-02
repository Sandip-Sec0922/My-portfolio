jest.mock("../src/services/securityEventService", () => ({
  logSecurity: jest.fn(),
}));

const { EventEmitter } = require("events");
const { logSecurity } = require("../src/services/securityEventService");
const audit = require("../src/middleware/audit");

test("audits a successful admin request when the request has no body", () => {
  const req = {
    user: { id: "admin-id" },
    params: {},
    baseUrl: "/api/admin",
  };
  const res = new EventEmitter();
  res.statusCode = 204;
  const next = jest.fn();

  audit("delete")(req, res, next);
  res.emit("finish");

  expect(next).toHaveBeenCalledTimes(1);
  expect(logSecurity).toHaveBeenCalledWith("admin_delete", req, {
    actorId: "admin-id",
    target: "/api/admin",
  });
});
