import assert from "node:assert/strict";
import { test } from "node:test";

let moduleId = 0;
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalFetch = globalThis.fetch;

function installBrowser({ locks = true, refreshFails = false } = {}) {
  let accessValid = false;
  let refreshCount = 0;
  let logoutCount = 0;
  let lockTail = Promise.resolve();

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: locks
      ? {
          locks: {
            request: async (_name, callback) => {
              const previous = lockTail;
              let release;
              lockTail = new Promise((resolve) => { release = resolve; });
              await previous;
              try {
                return await callback();
              } finally {
                release();
              }
            },
          },
        }
      : {},
  });

  globalThis.fetch = async (url) => {
    const path = String(url);
    if (path === "/api/auth/csrf")
      return Response.json({ csrfToken: "csrf-token" });
    if (path === "/api/auth/me") {
      return accessValid
        ? Response.json({ user: { role: "admin" } })
        : Response.json(
            { error: { code: "UNAUTHENTICATED", message: "Expired" } },
            { status: 401 },
          );
    }
    if (path === "/api/auth/refresh") {
      refreshCount += 1;
      if (refreshFails)
        return Response.json(
          { error: { code: "REFRESH_REUSE", message: "Session expired" } },
          { status: 401 },
        );
      accessValid = true;
      return Response.json({ user: { role: "admin" } });
    }
    if (path === "/api/auth/logout") {
      logoutCount += 1;
      accessValid = false;
      return new Response(null, { status: 204 });
    }
    if (path === "/api/projects") {
      return accessValid
        ? Response.json({ items: [] })
        : Response.json(
            { error: { code: "UNAUTHENTICATED", message: "Expired" } },
            { status: 401 },
          );
    }
    throw new Error(`Unexpected test request: ${path}`);
  };

  return {
    get refreshCount() { return refreshCount; },
    get logoutCount() { return logoutCount; },
  };
}

async function newClient() {
  moduleId += 1;
  return import(`../src/api/client.js?test-tab=${moduleId}`);
}

test.after(() => {
  globalThis.fetch = originalFetch;
  if (navigatorDescriptor)
    Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
  else delete globalThis.navigator;
});

test("parallel requests in one tab share one refresh", async () => {
  const browser = installBrowser();
  const { api } = await newClient();

  const results = await Promise.all([
    api.get("/projects"),
    api.get("/projects"),
    api.get("/projects"),
  ]);

  assert.equal(results.length, 3);
  assert.equal(browser.refreshCount, 1);
});

test("two tabs serialize refresh and the waiting tab reuses the rotated session", async () => {
  const browser = installBrowser();
  const [firstTab, secondTab] = await Promise.all([newClient(), newClient()]);

  const results = await Promise.all([
    firstTab.api.get("/projects"),
    secondTab.api.get("/projects"),
  ]);

  assert.equal(results.length, 2);
  assert.equal(browser.refreshCount, 1);
});

test("refresh replay rejection does not trigger a retry loop", async () => {
  const browser = installBrowser({ refreshFails: true });
  const { api } = await newClient();

  await assert.rejects(api.get("/projects"), (error) => {
    assert.equal(error.status, 401);
    assert.equal(error.code, "UNAUTHENTICATED");
    return true;
  });
  assert.equal(browser.refreshCount, 1);
});

test("normal logout still sends the CSRF-protected endpoint", async () => {
  const browser = installBrowser();
  const { api } = await newClient();

  await api.post("/auth/logout");
  assert.equal(browser.logoutCount, 1);
});

test("does not rotate refresh tokens when browser-wide locks are unavailable", async () => {
  const browser = installBrowser({ locks: false });
  const { api } = await newClient();

  await assert.rejects(api.get("/projects"), { status: 401 });
  assert.equal(browser.refreshCount, 0);
});
