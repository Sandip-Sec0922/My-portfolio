import assert from "node:assert/strict";
import { test } from "node:test";

let moduleId = 0;
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const broadcastDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "BroadcastChannel",
);
const originalFetch = globalThis.fetch;
const localStorageValues = new Map();
const channels = new Map();

class FakeBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.listeners = new Set();
    const peers = channels.get(name) || new Set();
    peers.add(this);
    channels.set(name, peers);
  }
  addEventListener(type, listener) {
    if (type === "message") this.listeners.add(listener);
  }
  removeEventListener(type, listener) {
    if (type === "message") this.listeners.delete(listener);
  }
  postMessage(data) {
    for (const peer of channels.get(this.name) || []) {
      if (peer !== this)
        for (const listener of peer.listeners)
          queueMicrotask(() => listener({ data }));
    }
  }
}

function installBrowser({
  locks = true,
  refreshFails = false,
  holdRefresh = false,
} = {}) {
  let accessValid = false;
  let refreshCount = 0;
  let logoutCount = 0;
  let lockTail = Promise.resolve();
  let releaseRefresh;
  let markRefreshStarted;
  const refreshStarted = new Promise((resolve) => {
    markRefreshStarted = resolve;
  });
  const refreshGate = new Promise((resolve) => {
    releaseRefresh = resolve;
  });

  localStorageValues.clear();
  channels.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => localStorageValues.get(key) ?? null,
      setItem: (key, value) => localStorageValues.set(key, String(value)),
      removeItem: (key) => localStorageValues.delete(key),
    },
  });
  Object.defineProperty(globalThis, "BroadcastChannel", {
    configurable: true,
    value: FakeBroadcastChannel,
  });

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
      markRefreshStarted();
      if (holdRefresh) await refreshGate;
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
    refreshStarted,
    releaseRefresh,
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
  if (storageDescriptor)
    Object.defineProperty(globalThis, "localStorage", storageDescriptor);
  else delete globalThis.localStorage;
  if (broadcastDescriptor)
    Object.defineProperty(globalThis, "BroadcastChannel", broadcastDescriptor);
  else delete globalThis.BroadcastChannel;
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

test("tabs without Web Locks serialize refresh through the lease fallback", async () => {
  const browser = installBrowser({ locks: false });
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

test("logout waits for an in-flight refresh in the same tab", async () => {
  const browser = installBrowser({ locks: false, holdRefresh: true });
  const { api } = await newClient();

  const protectedRequest = api.get("/projects");
  await browser.refreshStarted;
  const logout = api.post("/auth/logout");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(browser.logoutCount, 0);

  browser.releaseRefresh();
  await Promise.all([protectedRequest, logout]);
  assert.equal(browser.logoutCount, 1);
});

test("fails closed when neither a Web Lock nor local storage lease is available", async () => {
  const browser = installBrowser({ locks: false });
  delete globalThis.localStorage;
  const { api } = await newClient();

  await assert.rejects(api.get("/projects"), { status: 401 });
  assert.equal(browser.refreshCount, 0);
});
