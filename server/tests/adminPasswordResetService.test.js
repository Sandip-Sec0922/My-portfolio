"use strict";

const store = new Map();
const mockRedis = {
  set: jest.fn(async (key, value, mode, seconds, onlyIfMissing) => {
    if (onlyIfMissing === "NX" && store.has(key)) return null;
    store.set(key, value);
    return "OK";
  }),
  del: jest.fn(async (...keys) =>
    keys.reduce((removed, key) => removed + Number(store.delete(key)), 0),
  ),
  multi: jest.fn(() => {
    const operations = [];
    const transaction = {
      set: (...args) => {
        operations.push(["set", ...args]);
        return transaction;
      },
      del: (...args) => {
        operations.push(["del", ...args]);
        return transaction;
      },
      exec: async () =>
        operations.map(([operation, ...args]) => {
          if (operation === "set") {
            store.set(args[0], args[1]);
            return [null, "OK"];
          }
          args.forEach((key) => store.delete(key));
          return [null, 1];
        }),
    };
    return transaction;
  }),
  eval: jest.fn(async (_script, _keyCount, otpKey, attemptsKey, expected) => {
    const digest = store.get(otpKey);
    if (!digest) return 0;
    const attempts = Number(store.get(attemptsKey) || 0) + 1;
    store.set(attemptsKey, String(attempts));
    if (digest === expected) {
      store.delete(otpKey);
      store.delete(attemptsKey);
      return 1;
    }
    if (attempts >= 5) {
      store.delete(otpKey);
      store.delete(attemptsKey);
    }
    return 0;
  }),
};

jest.mock("../src/config/redis", () => mockRedis);
jest.mock("../src/models/User", () => ({ findOne: jest.fn() }));
jest.mock("../src/services/passwordService", () => ({
  hash: jest.fn(async (password) => `hashed:${password}`),
}));
jest.mock("../src/services/tokenService", () => ({
  revokeAllForUser: jest.fn(),
}));
jest.mock("../src/services/lockoutService", () => ({
  clear: jest.fn(),
}));
jest.mock("../src/services/mailService", () => ({
  canSendPasswordReset: jest.fn(() => true),
  sendAdminPasswordResetOtp: jest.fn(),
}));
jest.mock("../src/utils/logger", () => ({ error: jest.fn() }));

const User = require("../src/models/User");
const passwords = require("../src/services/passwordService");
const tokens = require("../src/services/tokenService");
const lockout = require("../src/services/lockoutService");
const mail = require("../src/services/mailService");
const AppError = require("../src/utils/AppError");
const { requestCode, resetPassword } = require("../src/services/adminPasswordResetService");

const createUser = () => ({
  _id: "admin-id",
  email: "admin@example.com",
  role: "admin",
  save: jest.fn().mockResolvedValue(undefined),
});

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
  mail.canSendPasswordReset.mockReturnValue(true);
  mail.sendAdminPasswordResetOtp.mockResolvedValue(undefined);
});

test("sends an OTP only to an existing admin and stores only its digest", async () => {
  const admin = createUser();
  User.findOne.mockResolvedValue(admin);

  await expect(requestCode("ADMIN@example.com")).resolves.toContain(
    "If an admin account matches",
  );

  const [recipient, otp] = mail.sendAdminPasswordResetOtp.mock.calls[0];
  expect(recipient).toBe(admin.email);
  expect(otp).toMatch(/^\d{6}$/);
  expect([...store.values()]).not.toContain(otp);
  expect(User.findOne).toHaveBeenCalledWith({
    $expr: { $eq: [{ $toLower: "$email" }, "admin@example.com"] },
  });
});

test("returns the same request message and sends no mail for an unknown account", async () => {
  User.findOne.mockResolvedValue(null);

  await expect(requestCode("unknown@example.com")).resolves.toContain(
    "If an admin account matches",
  );
  expect(mail.sendAdminPasswordResetOtp).not.toHaveBeenCalled();
});

test("fails explicitly before lookup when SMTP is unavailable", async () => {
  mail.canSendPasswordReset.mockReturnValue(false);

  await expect(requestCode("admin@example.com")).rejects.toMatchObject({
    status: 503,
    code: "RESET_UNAVAILABLE",
  });
  expect(User.findOne).not.toHaveBeenCalled();
});

test("clears the OTP and cooldown after mail delivery fails", async () => {
  User.findOne.mockResolvedValue(createUser());
  mail.sendAdminPasswordResetOtp.mockRejectedValue(
    Object.assign(new Error("SMTP authentication failed"), {
      code: "EAUTH",
      responseCode: 535,
    }),
  );

  await expect(requestCode("admin@example.com")).rejects.toMatchObject({
    status: 503,
    code: "RESET_UNAVAILABLE",
  });

  expect(store.size).toBe(0);
});

test("accepts a code once, updates the password and revokes sessions/unlocks admin", async () => {
  const admin = createUser();
  User.findOne.mockResolvedValue(admin);
  await requestCode(admin.email);
  const otp = mail.sendAdminPasswordResetOtp.mock.calls[0][1];

  await expect(
    resetPassword({
      email: admin.email,
      otp,
      newPassword: "a-new-strong-password",
    }),
  ).resolves.toBe(admin);

  expect(passwords.hash).toHaveBeenCalledWith("a-new-strong-password");
  expect(admin.passwordHash).toBe("hashed:a-new-strong-password");
  expect(admin.save).toHaveBeenCalledTimes(1);
  expect(tokens.revokeAllForUser).toHaveBeenCalledWith("admin-id");
  expect(lockout.clear).toHaveBeenCalledWith(admin.email);
  await expect(
    resetPassword({
      email: admin.email,
      otp,
      newPassword: "another-new-strong-password",
    }),
  ).rejects.toBeInstanceOf(AppError);
});

test("invalid codes are limited to five attempts and then invalidate the OTP", async () => {
  const admin = createUser();
  User.findOne.mockResolvedValue(admin);
  await requestCode(admin.email);
  const otp = mail.sendAdminPasswordResetOtp.mock.calls[0][1];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expect(
      resetPassword({
        email: admin.email,
        otp: otp === "999999" ? "000000" : "999999",
        newPassword: "a-new-strong-password",
      }),
    ).rejects.toMatchObject({ code: "INVALID_RESET_CODE" });
  }

  await expect(
    resetPassword({
      email: admin.email,
      otp,
      newPassword: "a-new-strong-password",
    }),
  ).rejects.toMatchObject({ code: "INVALID_RESET_CODE" });
  expect(passwords.hash).not.toHaveBeenCalled();
});
