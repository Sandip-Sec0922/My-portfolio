// Fetch wrapper. WHY it is written this way:
//  - tokens live in httpOnly cookies, so JS never touches them (XSS can't steal them)
//  - the CSRF token is kept in memory and sent as a header on every write
//  - SINGLE-FLIGHT refresh: the server treats a refresh token reused twice as theft and kills the
//    session. If five calls hit 401 together, they must share ONE refresh request.
let csrfPromise = null;
let refreshPromise = null;
const AUTH_REFRESH_LOCK = "portfolio-auth-refresh";

async function raw(path, { method = "GET", body, csrf } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
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

const refresh = () => {
  if (refreshPromise) return refreshPromise;
  const operation = async () => {
    const lockManager = globalThis.navigator?.locks;
    if (!lockManager?.request)
      throw new Error("This browser cannot safely coordinate session refresh.");
    await lockManager.request(AUTH_REFRESH_LOCK, refreshWhileHoldingLock);
  };
  refreshPromise = operation().finally(() => {
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
