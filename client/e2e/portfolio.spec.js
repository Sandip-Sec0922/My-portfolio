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
    publicProjects: [
      {
        _id: "public-project-1",
        title: "Threat Intelligence Board",
        slug: "threat-intelligence-board",
        summary: "Collect, enrich, triage, and alert on threat intelligence.",
        description: "A hands-on threat-intelligence project with a documented operational workflow.",
        category: "automation",
        tech: ["Python", "RAG", "Streamlit"],
        securityHighlights: ["Extracts indicators of compromise for analyst review."],
        githubUrl: "https://github.com/Sandip-Sec0922/cybersecurity-recent-news",
        liveUrl: null,
        featured: true,
      },
    ],
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
      } else if (path === "/api/projects" && method === "GET") {
        body = { items: state.publicProjects };
      } else if (path === "/api/github" && method === "GET") {
        body = {
          repos: [
            {
              name: "cybersecurity-recent-news",
              description: "Threat intelligence collection and review.",
              url: "https://github.com/Sandip-Sec0922/cybersecurity-recent-news",
              language: "Python",
              stars: 0,
              forks: 0,
            },
          ],
          totalStars: 0,
          languages: [{ name: "Python", percent: 100 }],
        };
      } else if (path === "/api/security/posture" && method === "GET") {
        const dates = Array.from({ length: 7 }, (_, index) => {
          const date = new Date(Date.now() - (6 - index) * 86400000)
            .toISOString()
            .slice(0, 10);
          return { date, total: 1, byType: { failed_login: 1 } };
        });
        body = {
          windowDays: 7,
          totals: {
            failed_login: 1,
            account_locked: 0,
            rate_limit_hit: 0,
            validation_failure: 0,
            cors_blocked: 0,
            nosql_injection_blocked: 0,
            honeypot_triggered: 0,
            csrf_failure: 0,
            auth_denied: 0,
            captcha_failed: 0,
          },
          daily: dates,
          generatedAt: new Date().toISOString(),
        };
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
      } else if (path === "/api/admin/posts" && method === "GET") {
        body = { items: [] };
      } else if (path === "/api/admin/messages" && method === "GET") {
        body = {
          items: [
            {
              _id: "message-1",
              name: "Portfolio Visitor",
              email: `${"long-address-segment".repeat(6)}@example.test`,
              subject: "Question about the security automation project",
              message: "I would like to discuss the project.",
              createdAt: "2026-01-15T00:00:00.000Z",
              ip: "192.0.2.10",
              read: false,
            },
          ],
          total: 1,
          page: 1,
          pages: 1,
        };
      } else if (path === "/api/admin/security-events" && method === "GET") {
        body = {
          items: [
            {
              _id: "event-1",
              ts: "2026-01-15T00:00:00.000Z",
              type: "failed_login",
              ip: "192.0.2.10",
              method: "POST",
              path: `/api/auth/login/${"segment".repeat(50)}`,
              details: { reason: "Invalid credentials" },
            },
          ],
          total: 1,
          page: 1,
          pages: 1,
        };
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
  const navigationToggle = page.getByRole("button", { name: "Close navigation" });
  await expect(navigationToggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  await expect(page.locator("#mobile-navigation")).toHaveCount(0);

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

test("skip links and admin navigation work with keyboard focus", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await page.keyboard.press("Tab");
  const publicSkipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(publicSkipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();

  await page.goto("/admin/projects");
  const adminSkipLink = page.getByRole("link", { name: "Skip to admin content" });
  await expect(adminSkipLink).toBeAttached();
  await page.keyboard.press("Tab");
  await expect(adminSkipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#admin-main")).toBeFocused();

  await page.getByLabel("Email").fill("admin@example.test");
  await page.getByLabel("Password").fill("a-long-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/projects$/);
  const adminNavigation = page.getByRole("navigation", { name: "Admin" });
  const projectsLink = adminNavigation.getByRole("link", { name: "Projects", exact: true });
  await expect(projectsLink).toHaveAttribute("aria-current", "page");
  await projectsLink.focus();
  await page.keyboard.press("Tab");
  const postsLink = adminNavigation.getByRole("link", { name: "Posts", exact: true });
  await expect(postsLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/posts$/);
  await expect(page.locator("#admin-page-content")).toBeFocused();
});

test("page search restores focus to its opener when dismissed", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const searchButton = page.getByRole("button", { name: "Open page search" });
  await searchButton.click();
  await expect(page.getByRole("dialog", { name: "Navigate to a page" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(searchButton).toBeFocused();

  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Navigate to a page" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(searchButton).toBeFocused();
});

test("public pages stay responsive without horizontal overflow at target widths", async ({
  page,
}) => {
  await mockApi(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/projects");

  await expect(
    page.getByRole("heading", { name: "Projects & experiments" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Threat Intelligence Board" }),
  ).toBeVisible();
  await expect(page.getByText("Security notes")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /cybersecurity-recent-news/ }),
  ).toBeVisible();

  const sizes = [320, 375, 430, 768, 1024, 1280, 1440, 1920];
  const overflowingViews = [];
  for (const path of ["/projects", "/lab", "/blog", "/blog/suspicious-login", "/"]) {
    await page.goto(path);
    for (const width of sizes) {
      await page.setViewportSize({ width, height: 900 });
      const overflowing = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      if (overflowing) overflowingViews.push(`${path} at ${width}px`);
    }
  }
  expect(overflowingViews).toEqual([]);
});

test("remaining public and admin entry routes stay accessible and responsive", async ({
  page,
}) => {
  await mockApi(page);
  const routes = [
    ["/roadmap", "Learning roadmap"],
    ["/security", "Security posture"],
    ["/contact", "Get in touch"],
    ["/admin/login", "Admin sign in"],
    ["/admin/reset-password", "Reset admin password"],
  ];
  const sizes = [320, 375, 768, 1024, 1920];
  const failures = [];

  for (const [path, heading] of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
    for (const width of sizes) {
      await page.setViewportSize({ width, height: 900 });
      const overflowing = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      if (overflowing) failures.push(`${path} at ${width}px`);
    }
  }
  expect(failures).toEqual([]);
});

test("lab topology is explicitly identified as planned", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/lab");

  await expect(
    page.getByRole("heading", { name: "A contained detection loop" }),
  ).toBeVisible();
  await expect(page.getByText("Conceptual · not deployed")).toBeVisible();
  await expect(page.getByText(/Planned flow:/)).toBeVisible();
  await expect(page.locator(".topology-svg")).toHaveClass(/topology-isometric/);
  await expect(page.getByText(/Isometric-style schematic, not a live 3D environment/)).toBeVisible();
  await expect(page.getByText("Windows endpoint")).toBeVisible();
  await expect(page.getByText("Planned", { exact: true }).first()).toBeVisible();
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

  const adminOverflow = [];
  for (const width of [320, 375, 430, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflowing = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (overflowing) adminOverflow.push(`${width}px`);
  }
  expect(adminOverflow).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 900 });

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

test("authenticated admin views stay within narrow viewport widths", async ({
  page,
}) => {
  await mockApi(page, { authenticated: true });
  await page.goto("/admin/projects");

  const views = [
    ["Posts", /\/admin\/posts$/, "Posts"],
    ["Messages", /\/admin\/messages$/, "Messages"],
    ["Security log", /\/admin\/security$/, "Security log"],
    ["Account", /\/admin\/account$/, "Account"],
  ];
  const overflow = [];

  for (const [linkName, url, heading] of views) {
    await page.getByRole("navigation", { name: "Admin" })
      .getByRole("link", { name: linkName, exact: true })
      .click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(heading) })).toBeVisible();
    for (const width of [320, 375, 430, 768]) {
      await page.setViewportSize({ width, height: 900 });
      const overflowing = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      if (overflowing) overflow.push(`${linkName} at ${width}px`);
    }
  }

  expect(overflow).toEqual([]);
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
