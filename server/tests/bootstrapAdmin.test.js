jest.mock("mongoose", () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
}));
jest.mock("../src/models/User", () => ({
  init: jest.fn(),
  exists: jest.fn(),
  create: jest.fn(),
}));
jest.mock("../src/services/passwordService", () => ({
  hash: jest.fn(),
}));

const mongoose = require("mongoose");
const User = require("../src/models/User");
const passwords = require("../src/services/passwordService");
const { bootstrapAdmin } = require("../scripts/bootstrap-admin");

beforeEach(() => {
  jest.clearAllMocks();
  mongoose.connect.mockResolvedValue();
  mongoose.disconnect.mockResolvedValue();
  User.init.mockResolvedValue();
  User.exists.mockResolvedValue(null);
  User.create.mockResolvedValue({});
  passwords.hash.mockResolvedValue("argon2id-hash");
});

const input = {
  mongoUri: "mongodb+srv://user:password@example.mongodb.net/app",
  email: "admin@example.com",
  password: "correct-horse-battery-42",
};

test("creates the one-time admin with a password hash and disconnects", async () => {
  await expect(bootstrapAdmin(input)).resolves.toBe(true);

  expect(User.create).toHaveBeenCalledWith({
    email: input.email,
    passwordHash: "argon2id-hash",
    role: "admin",
  });
  expect(User.create.mock.calls[0][0]).not.toHaveProperty("password");
  expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
});

test("returns successfully without changing an existing admin", async () => {
  User.exists.mockResolvedValue({ _id: "existing-admin" });

  await expect(bootstrapAdmin(input)).resolves.toBe(false);
  expect(User.create).not.toHaveBeenCalled();
  expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
});

test("treats a concurrent bootstrap as a successful no-op", async () => {
  User.create.mockRejectedValueOnce({ code: 11000 });
  User.exists
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ _id: "concurrent-admin" });

  await expect(bootstrapAdmin(input)).resolves.toBe(false);
  expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
});

test("rejects weak passwords before opening a database connection", async () => {
  await expect(
    bootstrapAdmin({ ...input, password: "too-short" }),
  ).rejects.toThrow("does not meet the required format");
  expect(mongoose.connect).not.toHaveBeenCalled();
});
