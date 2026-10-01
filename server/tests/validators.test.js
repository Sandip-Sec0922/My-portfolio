const s = require("../src/validators/schemas");

const validProject = {
  title: "Cyber Intel Board",
  slug: "cyber-intel-board",
  summary: "Telegram threat intel pipeline",
  description: "Collects, labels and indexes posts.",
  category: "automation",
};

describe("login schema", () => {
  test("normalises email", () => {
    expect(
      s.loginSchema.parse({ email: "  Admin@Example.COM ", password: "x" })
        .email,
    ).toBe("admin@example.com");
  });
  test("rejects NoSQL operator objects", () => {
    expect(
      s.loginSchema.safeParse({ email: { $gt: "" }, password: "x" }).success,
    ).toBe(false);
  });
  test("caps password length (argon2 DoS guard)", () => {
    expect(
      s.loginSchema.safeParse({ email: "a@b.co", password: "x".repeat(129) })
        .success,
    ).toBe(false);
  });
  test("rejects unknown keys (mass assignment)", () => {
    expect(
      s.loginSchema.safeParse({ email: "a@b.co", password: "x", role: "admin" })
        .success,
    ).toBe(false);
  });
});

describe("contact schema", () => {
  const base = {
    name: "Ana",
    email: "ana@example.com",
    subject: "Hello there",
    message: "This is a long enough message.",
  };
  test("strips HTML and script bodies", () => {
    const out = s.contactSchema.parse({
      ...base,
      message: "Hi <script>alert(1)</script><b>there</b>, nice portfolio site",
    });
    expect(out.message).not.toMatch(/<|alert/);
  });
  test("rejects newlines in subject (header injection)", () => {
    expect(
      s.contactSchema.safeParse({
        ...base,
        subject: "Hi\r\nBcc: evil@example.com",
      }).success,
    ).toBe(false);
  });
  test("rejects too-short message", () => {
    expect(
      s.contactSchema.safeParse({ ...base, message: "short" }).success,
    ).toBe(false);
  });
});

describe("project schema", () => {
  test("accepts a valid project and applies defaults", () => {
    const out = s.projectSchema.parse(validProject);
    expect(out.tech).toEqual([]);
    expect(out.featured).toBe(false);
  });
  test("rejects javascript: and non-github URLs", () => {
    expect(
      s.projectSchema.safeParse({
        ...validProject,
        liveUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(
      s.projectSchema.safeParse({
        ...validProject,
        githubUrl: "https://evil.example/x",
      }).success,
    ).toBe(false);
  });
  test("rejects bad slug and unknown fields", () => {
    expect(
      s.projectSchema.safeParse({ ...validProject, slug: "Bad Slug!" }).success,
    ).toBe(false);
    expect(
      s.projectSchema.safeParse({ ...validProject, _id: "x" }).success,
    ).toBe(false);
  });
  test("partial update does not inject defaults", () => {
    expect(s.projectUpdateSchema.parse({ title: "New" })).toEqual({
      title: "New",
    });
  });
});

describe("query schemas", () => {
  test("posts query rejects unknown params and operator objects", () => {
    expect(s.postsQuery.safeParse({ foo: "bar" }).success).toBe(false);
    expect(s.postsQuery.safeParse({ q: { $ne: "x" } }).success).toBe(false);
  });
  test("page is coerced and bounded", () => {
    expect(s.postsQuery.parse({ page: "3" }).page).toBe(3);
    expect(s.postsQuery.safeParse({ page: "99999" }).success).toBe(false);
  });
});
