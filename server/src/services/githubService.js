"use strict";
const config = require("../config/env");
const redis = require("../config/redis");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");
const cache = require("./cacheService");

const API = "https://api.github.com"; // hard-coded host: the token is only ever sent here (no SSRF/token leak)
const TTL_SEC = 20 * 60;

async function gh(path) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "soc-portfolio-api",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (config.github.token)
    headers.Authorization = `Bearer ${config.github.token}`; // server-side only
  const res = await fetch(`${API}${path}`, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
  return res.json();
}

async function build() {
  const user = encodeURIComponent(config.github.username);
  const all = await gh(
    `/users/${user}/repos?per_page=100&sort=pushed&type=owner`,
  );
  const repos = all.filter((r) => !r.fork && !r.archived);

  // Language byte counts for the 10 most recently pushed repos, aggregated.
  const langs = await Promise.all(
    repos
      .slice(0, 10)
      .map((r) =>
        gh(`/repos/${user}/${encodeURIComponent(r.name)}/languages`).catch(
          () => ({}),
        ),
      ),
  );
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

async function getGithubData() {
  try {
    return await cache.getOrSet("github:repos", TTL_SEC, async () => {
      const data = await build();
      await redis
        .set("stale:github", JSON.stringify(data), "EX", 86400)
        .catch(() => {});
      return data;
    });
  } catch (err) {
    // Rate-limited or GitHub down: serve the last good copy (up to 24h) instead of breaking the page.
    logger.warn({ err: err.message }, "github_fetch_failed");
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
