jest.mock("mongoose", () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
}));
jest.mock("../src/models/User", () => ({
  findOne: jest.fn(),
}));
jest.mock("../src/services/passwordService", () => ({
  hash: jest.fn(),
}));

const mongoose = require("mongoose");
const User = require("../src/models/User");
const passwords = require("../src/services/passwordService");
const { resetAdminPassword } = require("../scripts/reset-admin-password");

const validInput = {
  mongoUri: "mongodb+srv://user:password@example.mongodb.net/app",
  email: "Admin@example.com",
  newPassword: "new-secure-password-123",
};

beforeEach(() => {
  jest.clearAllMocks();
  mongoose.connect.mockResolvedValue();
  mongoose.disconnect.mockResolvedValue();
  passwords.hash.mockResolvedValue("argon2id-hash");
  User.findOne.mockResolvedValue({
    email: "admin@example.com",
    role: "admin",
    save: jest.fn().mockResolvedValue(),
  });
});

test("finds email case-insensitively and saves an Argon2 password hash", async () => {
  const user = {
    email: "admin@example.com",
    role: "admin",
    save: jest.fn().mockResolvedValue(),
  };
  User.findOne.mockResolvedValue(user);

  await resetAdminPassword(validInput);

  const [filter] = User.findOne.mock.calls[0];
  expect(filter).toEqual({
    $expr: {
      $eq: [{ $toLower: "$email" }, "admin@example.com"],
    },
  });
  expect(user.passwordHash).toBe("argon2id-hash");
  expect(user.save).toHaveBeenCalledTimes(1);
  expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
});

test("rejects an unknown email and closes the database connection", async () => {
  User.findOne.mockResolvedValue(null);

  await expect(resetAdminPassword(validInput)).rejects.toThrow(
    "No user found with that email",
  );
  expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
});

test("rejects a non-admin user without changing its password", async () => {
  const user = {
    email: validInput.email,
    role: "viewer",
    save: jest.fn(),
  };
  User.findOne.mockResolvedValue(user);

  await expect(resetAdminPassword(validInput)).rejects.toThrow(
    "does not have the admin role",
  );
  expect(user.save).not.toHaveBeenCalled();
  expect(passwords.hash).not.toHaveBeenCalled();
  expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
});

test.each([
  [{ ...validInput, mongoUri: "" }, "MONGO_URI"],
  [{ ...validInput, email: "" }, "ADMIN_EMAIL"],
  [{ ...validInput, newPassword: "" }, "NEW_PASSWORD"],
  [{ ...validInput, newPassword: "short" }, "required format"],
])("validates reset input before connecting", async (input, expected) => {
  await expect(resetAdminPassword(input)).rejects.toThrow(expected);
  expect(mongoose.connect).not.toHaveBeenCalled();
});
