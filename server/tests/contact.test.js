jest.mock("../src/config/redis", () => {
  const Redis = require("ioredis-mock");
  return new Redis();
});
jest.mock("../src/models/SecurityEvent", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/models/Message", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/services/turnstileService", () => ({
  verify: jest.fn().mockResolvedValue(true),
}));
jest.mock("../src/services/mailService", () => ({
  notifyNewMessage: jest.fn().mockResolvedValue(undefined),
}));

const request = require("supertest");
const Message = require("../src/models/Message");
const mail = require("../src/services/mailService");
const { createApp } = require("../src/app");

const app = createApp();

test("accepted contact requests are persisted as message documents", async () => {
  const savedMessage = {
    name: "Site visitor",
    email: "visitor@example.com",
    subject: "Project question",
    message: "I would like to ask about your project.",
  };
  Message.create.mockResolvedValue(savedMessage);
  const agent = request.agent(app);
  const csrf = await agent.get("/api/auth/csrf");

  const response = await agent
    .post("/api/contact")
    .set("X-CSRF-Token", csrf.body.csrfToken)
    .send({
      name: "Site visitor",
      email: "visitor@example.com",
      subject: "Project question",
      message: "I would like to ask about your project.",
    });

  expect(response.status).toBe(201);
  expect(response.body).toEqual({ ok: true });
  expect(Message.create).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Site visitor",
      email: "visitor@example.com",
      subject: "Project question",
      message: "I would like to ask about your project.",
    }),
  );
  expect(mail.notifyNewMessage).toHaveBeenCalledWith(savedMessage);
});
