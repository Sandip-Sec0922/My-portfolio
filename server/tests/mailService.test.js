"use strict";

const mockLookup = jest.fn();
const mockConfig = {
  smtp: {
    host: "smtp.gmail.com",
    port: 587,
    user: "admin@example.com",
    pass: "test-password",
    notifyEmail: "admin@example.com",
  },
  resend: { apiKey: "", from: "" },
};

jest.mock("node:dns", () => ({
  promises: { lookup: (...args) => mockLookup(...args) },
}));
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(),
}));
jest.mock("../src/config/env", () => mockConfig);

let nodemailer;
let mail;

beforeEach(() => {
  jest.resetModules();
  nodemailer = require("nodemailer");
  mail = require("../src/services/mailService");
  mockConfig.smtp.notifyEmail = "admin@example.com";
  mockConfig.resend.apiKey = "";
  mockConfig.resend.from = "";
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

test("sends mail through Resend HTTPS when configured", async () => {
  mockConfig.resend.apiKey = "test-resend-key";
  mockConfig.resend.from = "Portfolio <noreply@example.com>";
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({ id: "email-id" }),
  });

  await mail.sendAdminPasswordResetOtp("admin@example.com", "123456");

  expect(global.fetch).toHaveBeenCalledWith(
    "https://api.resend.com/emails",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer test-resend-key",
      }),
    }),
  );
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
    from: "Portfolio <noreply@example.com>",
    to: ["admin@example.com"],
    subject: "Admin password reset code",
  });
  expect(mockLookup).not.toHaveBeenCalled();
  expect(nodemailer.createTransport).not.toHaveBeenCalled();
});

test("sends contact notifications to NOTIFY_EMAIL through Resend", async () => {
  mockConfig.resend.apiKey = "test-resend-key";
  mockConfig.resend.from = "Portfolio <noreply@example.com>";
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({ id: "email-id" }),
  });

  await mail.notifyNewMessage({
    name: "Site visitor",
    email: "visitor@example.com",
    subject: "Project question",
    message: "I would like to ask about your project.",
    ip: "192.0.2.1",
  });

  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
    to: ["admin@example.com"],
    reply_to: "visitor@example.com",
    subject: "[Portfolio] Project question",
  });
});

test("skips optional contact email when NOTIFY_EMAIL is unset", async () => {
  mockConfig.resend.apiKey = "test-resend-key";
  mockConfig.resend.from = "Portfolio <noreply@example.com>";
  mockConfig.smtp.notifyEmail = "";
  global.fetch = jest.fn();

  await expect(
    mail.notifyNewMessage({
      name: "Site visitor",
      email: "visitor@example.com",
      subject: "Project question",
      message: "I would like to ask about your project.",
    }),
  ).resolves.toBeUndefined();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("reports Resend API errors without leaking the API key", async () => {
  mockConfig.resend.apiKey = "test-resend-key";
  mockConfig.resend.from = "Portfolio <noreply@example.com>";
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: jest.fn().mockResolvedValue({
      name: "validation_error",
      message: "Sender domain is not verified",
    }),
  });

  await expect(
    mail.sendAdminPasswordResetOtp("admin@example.com", "123456"),
  ).rejects.toThrow("Resend API responded 403: Sender domain is not verified");
});
