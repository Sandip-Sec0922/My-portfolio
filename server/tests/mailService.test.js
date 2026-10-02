"use strict";

const mockLookup = jest.fn();

jest.mock("node:dns", () => ({
  promises: { lookup: (...args) => mockLookup(...args) },
}));
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(),
}));
jest.mock("../src/config/env", () => ({
  smtp: {
    host: "smtp.gmail.com",
    port: 587,
    user: "admin@example.com",
    pass: "test-password",
    notifyEmail: "admin@example.com",
  },
}));

let nodemailer;
let mail;

beforeEach(() => {
  jest.resetModules();
  nodemailer = require("nodemailer");
  mail = require("../src/services/mailService");
  mockLookup.mockReset();
  mockLookup.mockResolvedValue({ address: "192.0.2.10", family: 4 });
  nodemailer.createTransport.mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: "test-message" }),
  });
});

test("uses IPv4 for SMTP while retaining the hostname for TLS verification", async () => {
  await mail.sendAdminPasswordResetOtp("admin@example.com", "123456");

  expect(mockLookup).toHaveBeenCalledWith("smtp.gmail.com", { family: 4 });
  expect(nodemailer.createTransport).toHaveBeenCalledWith(
    expect.objectContaining({
      host: "192.0.2.10",
      port: 587,
      requireTLS: true,
      tls: { servername: "smtp.gmail.com" },
    }),
  );
  expect(
    nodemailer.createTransport.mock.results[0].value.sendMail,
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "admin@example.com",
      subject: "Admin password reset code",
    }),
  );
});

test("propagates DNS errors and allows a later connection attempt", async () => {
  mockLookup.mockRejectedValueOnce(new Error("DNS unavailable"));

  await expect(
    mail.sendAdminPasswordResetOtp("admin@example.com", "123456"),
  ).rejects.toThrow("DNS unavailable");
  expect(nodemailer.createTransport).not.toHaveBeenCalled();

  await expect(
    mail.sendAdminPasswordResetOtp("admin@example.com", "123456"),
  ).resolves.toBeUndefined();
  expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
});
