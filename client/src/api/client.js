// Fetch wrapper. WHY it is written this way:
//  - tokens live in httpOnly cookies, so JS never touches them (XSS can't steal them)
//  - the CSRF token is kept in memory and sent as a header on every write
//  - SINGLE-FLIGHT refresh: the server treats a refresh token reused twice as theft and kills the
//    session. If five calls hit 401 together, they must share ONE refresh request.
let csrfPromise = null;
let refreshPromise = null;
let sessionLockTail = Promise.resolve();
const AUTH_REFRESH_LOCK = "portfolio-auth-refresh";
const REFRESH_LEASE_KEY = "portfolio-auth-refresh-lease";
const REFRESH_LEASE_MS = 30_000;
const REFRESH_COORDINATION_TIMEOUT_MS = 35_000;
const REFRESH_POLL_MS = 100;
const TAB_ID =
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let refreshChannel;

async function raw(path, { method = "GET", body, csrf } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const signal =
    typeof globalThis.AbortSignal?.timeout === "function"
      ? globalThis.AbortSignal.timeout(15_000)
      : undefined;
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error || {};
    throw Object.assign(new Error(e.message || "Request failed"), {
      status: res.status,
      code: e.code,
      details: e.details,
    });
  }
  return data;
}

const getCsrf = () =>
  (csrfPromise ??= raw("/auth/csrf")
    .then((d) => d.csrfToken)
    .catch((e) => {
      csrfPromise = null;
      throw e;
    }));

export async function request(path, opts = {}, tried = {}) {
  const write = opts.method && opts.method !== "GET";
  if (path === "/auth/logout" && !tried.sessionLock) {
    return withSessionLock(() =>
      request(path, opts, { ...tried, sessionLock: true }),
    );
  }
  try {
    return await raw(path, {
      ...opts,
      csrf: write ? await getCsrf() : undefined,
    });
  } catch (e) {
    // Another tab replaced the CSRF cookie: fetch a fresh pair and retry once (rejected before processing, so safe).
    if (e.code === "CSRF_FAILED" && !tried.csrf) {
      csrfPromise = null;
      return request(path, opts, { ...tried, csrf: true });
    }
    const isAuthCall =
      path.startsWith("/auth/login") || path.startsWith("/auth/refresh");
    if (
      e.status === 401 &&
      e.code === "UNAUTHENTICATED" &&
      !tried.refresh &&
      !isAuthCall
    ) {
      try {
        await refresh();
      } catch {
        throw e;
      }
      return request(path, opts, { ...tried, refresh: true });
    }
    throw e;
  }
}

async function refreshWhileHoldingLock() {
  try {
    await raw("/auth/me");
    return;
  } catch (error) {
    if (error.status !== 401 || error.code !== "UNAUTHENTICATED") throw error;
  }
  await request(
    "/auth/refresh",
    { method: "POST" },
    { refresh: true, csrf: false },
  );
}

function refreshBroadcastChannel() {
  if (refreshChannel) return refreshChannel;
  if (typeof globalThis.BroadcastChannel !== "function") return null;
  try {
    refreshChannel = new globalThis.BroadcastChannel(AUTH_REFRESH_LOCK);
    return refreshChannel;
  } catch {
    return null;
  }
}

function postRefreshMessage(type) {
  try {
    refreshBroadcastChannel()?.postMessage({ type, owner: TAB_ID });
  } catch {
    // The local-storage lease remains the coordination source if broadcast is unavailable.
  }
}

function readRefreshLease() {
  const storage = globalThis.localStorage;
  if (!storage) throw new Error("This browser cannot safely coordinate sessions.");
  const rawLease = storage.getItem(REFRESH_LEASE_KEY);
  if (!rawLease) return null;
  try {
    const lease = JSON.parse(rawLease);
    return typeof lease.owner === "string" &&
      Number.isFinite(lease.expiresAt)
      ? lease
      : null;
  } catch {
    return null;
  }
}

function waitForRefreshMessage(owner) {
  const channel = refreshBroadcastChannel();
  if (!channel) return new Promise((resolve) => setTimeout(() => resolve(null), REFRESH_POLL_MS));
  return new Promise((resolve) => {
    const finish = (message) => {
      clearTimeout(timer);
      channel.removeEventListener("message", onMessage);
      resolve(message);
    };
    const onMessage = ({ data }) => {
      if (
        data?.owner === owner &&
        (data.type === "session-updated" || data.type === "session-failed")
      ) {
        finish(data);
      }
    };
    const timer = setTimeout(
      () => finish(null),
      REFRESH_POLL_MS,
    );
    channel.addEventListener("message", onMessage);
  });
}

async function isSessionAuthenticated() {
  try {
    await raw("/auth/me");
    return true;
  } catch (error) {
    if (error.status === 401 && error.code === "UNAUTHENTICATED") return false;
    throw error;
  }
}

async function withRefreshLease(callback) {
  const storage = globalThis.localStorage;
  if (!storage) throw new Error("This browser cannot safely coordinate sessions.");
  const deadline = Date.now() + REFRESH_COORDINATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    let lease = readRefreshLease();
    if (lease && lease.expiresAt > Date.now()) {
      if (lease.owner === TAB_ID) {
        await new Promise((resolve) => setTimeout(resolve, REFRESH_POLL_MS));
        continue;
      }
      const message = await waitForRefreshMessage(lease.owner);
      if (message?.type === "session-failed") {
        throw new Error("Session coordination failed in another tab.");
      }
      if (message?.type === "session-updated" && await isSessionAuthenticated())
        return;

      lease = readRefreshLease();
      if (lease && lease.expiresAt > Date.now()) continue;
      if (await isSessionAuthenticated()) return;
      continue;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.floor(Math.random() * 35)),
    );
    lease = readRefreshLease();
    if (lease && lease.expiresAt > Date.now()) continue;

    storage.setItem(
      REFRESH_LEASE_KEY,
      JSON.stringify({ owner: TAB_ID, expiresAt: Date.now() + REFRESH_LEASE_MS }),
    );
    postRefreshMessage("session-claimed");
    await new Promise((resolve) => setTimeout(resolve, 75));
    if (readRefreshLease()?.owner !== TAB_ID) continue;

    try {
      const result = await callback();
      postRefreshMessage("session-updated");
      return result;
    } catch (error) {
      postRefreshMessage("session-failed");
      throw error;
    } finally {
      if (readRefreshLease()?.owner === TAB_ID)
        storage.removeItem(REFRESH_LEASE_KEY);
    }
  }
  throw new Error("Timed out while coordinating the session.");
}

function withSessionLock(callback) {
  const operation = sessionLockTail.then(async () => {
    const lockManager = globalThis.navigator?.locks;
    if (lockManager?.request)
      return lockManager.request(AUTH_REFRESH_LOCK, callback);
    return withRefreshLease(callback);
  });
  sessionLockTail = operation.catch(() => {});
  return operation;
}

const refresh = () => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = withSessionLock(refreshWhileHoldingLock).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
};

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: "POST", body: body ?? {} }),
  put: (p, body) => request(p, { method: "PUT", body }),
  patch: (p, body) => request(p, { method: "PATCH", body: body ?? {} }),
  del: (p) => request(p, { method: "DELETE" }),
};
