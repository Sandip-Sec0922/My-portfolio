"use strict";
const { randomUUID } = require("crypto");
const config = require("../config/env");
const redis = require("../config/redis");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");
const cache = require("./cacheService");

const API = "https://api.github.com"; // hard-coded host: the token is only ever sent here (no SSRF/token leak)
const TTL_SEC = 20 * 60;
const LOCK_SEC = 30;
const RELEASE_LOCK =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
let refreshPromise;

async function gh(path) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "soc-portfolio-api",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (config.github.token)
    headers.Authorization = `Bearer ${config.github.token}`; // server-side only
  const url = `${API}${path}`;
  const options = {
    headers,
    signal: AbortSignal.timeout(5000),
  };
  let res = await fetch(url, options);
  if (res.status === 401 && config.github.token) {
    logger.warn({ status: res.status }, "github_token_rejected");
    const publicHeaders = { ...headers };
    delete publicHeaders.Authorization;
    res = await fetch(url, { ...options, headers: publicHeaders });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = new Error(
      `GitHub responded ${res.status}: ${String(body.message || "upstream request failed").slice(0, 200)}`,
    );
    error.status = res.status;
    error.rateLimitRemaining = res.headers.get("x-ratelimit-remaining");
    error.rateLimitReset = res.headers.get("x-ratelimit-reset");
    error.retryAfter = res.headers.get("retry-after");
    throw error;
  }
  return res.json();
}

async function build() {
  const user = encodeURIComponent(config.github.username);
  const all = await gh(
    `/users/${user}/repos?per_page=100&sort=pushed&type=owner`,
  );
  const repos = all.filter((r) => !r.fork && !r.archived);

  // Language byte counts for the 10 most recently pushed repos, aggregated.
  const langs = [];
  const languageRepos = repos.slice(0, 10);
  for (let i = 0; i < languageRepos.length; i += 3) {
    const batch = languageRepos.slice(i, i + 3);
    langs.push(
      ...(await Promise.all(
        batch.map((r) =>
          gh(`/repos/${user}/${encodeURIComponent(r.name)}/languages`).catch(
            () => ({}),
          ),
        ),
      )),
    );
  }
  const totals = {};
  langs.forEach((l) =>
    Object.entries(l).forEach(([k, v]) => {
      totals[k] = (totals[k] || 0) + v;
    }),
  );
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;

  // Return only the fields the UI needs (smaller cache, smaller leak surface).
  return {
    fetchedAt: new Date().toISOString(),
    totalStars: repos.reduce((a, r) => a + r.stargazers_count, 0),
    repos: repos.map((r) => ({
      name: r.name,
      description: r.description,
      url: r.html_url,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language,
      topics: r.topics || [],
      pushedAt: r.pushed_at,
    })),
    languages: Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, bytes]) => ({
        name,
        percent: Math.round((bytes / sum) * 1000) / 10,
      })),
  };
}

async function buildAndStore() {
  const data = await build();
  const serialized = JSON.stringify(data);
  await Promise.all([
    redis.set("cache:github:repos", serialized, "EX", TTL_SEC).catch((err) =>
      logger.warn({ err: err.message }, "github_cache_write_failed"),
    ),
    redis.set("stale:github", serialized, "EX", 86400).catch((err) =>
      logger.warn({ err: err.message }, "github_stale_cache_write_failed"),
    ),
  ]);
  return data;
}

async function coordinatedBuild() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const lockKey = "lock:github:repos";
    const owner = randomUUID();
    let acquired;
    try {
      acquired = await redis.set(lockKey, owner, "EX", LOCK_SEC, "NX");
    } catch (err) {
      logger.warn({ err: err.message }, "github_refresh_lock_failed");
      return buildAndStore();
    }

    if (acquired !== "OK") {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const cached = await redis.get("cache:github:repos");
        if (cached) return JSON.parse(cached);
      }
      throw new Error("Another GitHub refresh is still in progress");
    }

    try {
      return await buildAndStore();
    } finally {
      try {
        await redis.eval(RELEASE_LOCK, 1, lockKey, owner);
      } catch (err) {
        logger.warn({ err: err.message }, "github_refresh_lock_release_failed");
      }
    }
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function getGithubData() {
  try {
    return await cache.getOrSet(
      "github:repos",
      TTL_SEC,
      coordinatedBuild,
    );
  } catch (err) {
    // Rate-limited or GitHub down: serve the last good copy (up to 24h) instead of breaking the page.
    logger.warn(
      {
        err: err.message,
        upstreamStatus: err.status,
        rateLimitRemaining: err.rateLimitRemaining,
        rateLimitReset: err.rateLimitReset,
        retryAfter: err.retryAfter,
      },
      "github_fetch_failed",
    );
    const stale = await redis.get("stale:github").catch(() => null);
    if (stale) return { ...JSON.parse(stale), stale: true };
    throw new AppError(
      502,
      "UPSTREAM_ERROR",
      "GitHub data temporarily unavailable",
    );
  }
}

module.exports = { getGithubData };
