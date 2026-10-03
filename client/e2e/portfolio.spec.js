import { expect, test } from "@playwright/test";

const samplePost = {
  _id: "post-1",
  title: "Investigating a Suspicious Login",
  slug: "suspicious-login",
  excerpt: "A practical investigation walkthrough.",
  content: "## Investigation\n\nReview the authentication timeline.",
  category: "incident-report",
  tags: ["auth"],
  publishedAt: "2026-01-15T00:00:00.000Z",
};

async function mockApi(page, { authenticated = false } = {}) {
  const state = {
    authenticated,
    contact: null,
    projectPayload: null,
    projects: [],
    reportPages: [],
    resetCompleted: false,
  };

  await page.route(
    (url) => new URL(url).pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      let status = 200;
      let body = {};

      if (path === "/api/auth/csrf") {
        body = { csrfToken: "playwright-csrf-token" };
      } else if (path === "/api/auth/me") {
        if (state.authenticated)
          body = { user: { email: "admin@example.test", role: "admin" } };
        else {
          status = 401;
          body = {
            error: { code: "UNAUTHENTICATED", message: "Sign in required." },
          };
        }
      } else if (path === "/api/auth/refresh") {
        status = 401;
        body = { error: { code: "UNAUTHENTICATED", message: "Sign in required." } };
      } else if (path === "/api/auth/login" && method === "POST") {
        state.authenticated = true;
        body = { user: { email: "admin@example.test", role: "admin" } };
      } else if (
        ["/api/auth/logout", "/api/auth/logout-all"].includes(path) &&
        method === "POST"
      ) {
        state.authenticated = false;
        body = { message: "Signed out." };
      } else if (path === "/api/posts" && method === "GET") {
        const url = new URL(request.url());
        const page = Number(url.searchParams.get("page") || 1);
        if (url.searchParams.get("category") === "incident-report") {
          state.reportPages.push(page);
          const post =
            page === 1
              ? samplePost
              : {
                  ...samplePost,
                  _id: "post-2",
                  title: "Reviewing a Phishing Alert",
                  slug: "phishing-alert",
                };
          body = { items: [post], page, pages: 2, total: 20 };
        } else {
          body = { items: [samplePost], page: 1, pages: 1, total: 1 };
        }
      } else if (
        path === `/api/posts/${samplePost.slug}` &&
        method === "GET"
      ) {
        body = samplePost;
      } else if (path === "/api/contact" && method === "POST") {
        state.contact = request.postDataJSON();
        body = { message: "Message received." };
      } else if (
        path === "/api/auth/password-reset/request" &&
        method === "POST"
      ) {
        body = {
          message: "If the address is an admin account, a code was sent.",
        };
      } else if (
        path === "/api/auth/password-reset/complete" &&
        method === "POST"
      ) {
        state.resetCompleted = true;
        body = { message: "Password reset." };
      } else if (path === "/api/admin/projects" && method === "GET") {
        body = { items: state.projects };
      } else if (path === "/api/admin/projects" && method === "POST") {
        state.projectPayload = request.postDataJSON();
        const project = {
          ...state.projectPayload,
          _id: "project-1",
        };
        state.projects.push(project);
        status = 201;
        body = { item: project };
      } else {
        status = 404;
        body = { error: { code: "NOT_FOUND", message: "No mocked endpoint." } };
      }

      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    },
  );

  return state;
}

test("mobile navigation and theme toggle work", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator("#mobile-navigation").getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

  const html = page.locator("html");
  const wasDark = await html.evaluate((element) => element.classList.contains("dark"));
  await page.locator('button[aria-label^="Switch to"]').click();
  await expect
    .poll(() => html.evaluate((element) => element.classList.contains("dark")))
    .toBe(!wasDark);
});

test("a write-up opens from the blog list and renders its content", async ({ page }) => {
  await mockApi(page);
  await page.goto("/blog");

  await page.getByRole("link", { name: "Read write-up" }).click();
  await expect(page).toHaveURL(/\/blog\/suspicious-login$/);
  await expect(
    page.getByRole("heading", { name: samplePost.title }),
  ).toBeVisible();
  await expect(page.getByText("Review the authentication timeline.")).toBeVisible();
});

test("Lab incident reports paginate without leaving the route", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/lab");

  await expect(page.getByRole("link", { name: samplePost.title })).toBeVisible();
  const pagination = page.getByRole("navigation", {
    name: "Incident report pages",
  });
  await pagination.getByRole("button", { name: /Next/ }).click();

  await expect(page).toHaveURL(/\/lab\?page=2$/);
  await expect(
    page.getByRole("link", { name: "Reviewing a Phishing Alert" }),
  ).toBeVisible();
  expect(state.reportPages).toContain(1);
  expect(state.reportPages.at(-1)).toBe(2);
});

test("contact form submits its fields and confirms success", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/contact");

  await page.getByLabel("Name", { exact: true }).fill("A Visitor");
  await page.getByLabel("Email", { exact: true }).fill("visitor@example.test");
  await page.getByLabel("Subject", { exact: true }).fill("Portfolio question");
  await page.getByLabel("Message", { exact: true }).fill("I would like to ask about your security project.");
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByRole("status")).toContainText("Message sent");
  expect(state.contact).toMatchObject({
    name: "A Visitor",
    email: "visitor@example.test",
    subject: "Portfolio question",
  });
});

test("admin routes require login; project creation and sign-out work", async ({
  page,
}) => {
  const state = await mockApi(page);
  await page.goto("/admin/projects");
  await expect(page).toHaveURL(/\/admin\/login$/);

  await page.getByLabel("Email").fill("admin@example.test");
  await page.getByLabel("Password").fill("a-long-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/projects$/);

  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Title").fill("Defensive Lab");
  await page.getByLabel("Slug").fill("defensive-lab");
  await page.getByLabel("Summary (max 200)").fill("A defensive security project.");
  await page.getByLabel("Description (max 3000)").fill("A project used to test the admin create flow.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Defensive Lab")).toBeVisible();
  expect(state.projectPayload).toMatchObject({
    title: "Defensive Lab",
    slug: "defensive-lab",
    category: "automation",
  });

  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Account" }).click();
  await page.getByRole("button", { name: "Sign out all sessions" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("admin password-reset form completes the two-step flow", async ({ page }) => {
  const state = await mockApi(page);
  await page.goto("/admin/reset-password");

  await page.getByLabel("Admin email").fill("admin@example.test");
  await page.getByRole("button", { name: "Email reset code" }).click();
  await expect(page.getByText(/a code was sent/i)).toBeVisible();

  await page.getByLabel("Six-digit code").fill("123456");
  await page.getByLabel("New password").fill("test-password-long-enough");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expect(page.getByRole("status")).toContainText("Your password was reset");
  expect(state.resetCompleted).toBe(true);
});
