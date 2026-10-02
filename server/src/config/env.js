"use strict";
const { z } = require("zod");

// Compose passes unset optional vars as "" -> treat as undefined.
const raw = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== ""),
);

function isProductionOrigin(origin) {
  try {
    const url = new URL(origin);
    return (
      url.protocol === "https:" &&
      url.origin === origin &&
      !url.username &&
      !url.password &&
      url.hostname !== "localhost" &&
      !url.hostname.endsWith(".localhost") &&
      !url.hostname.startsWith("127.") &&
      url.hostname !== "[::1]"
    );
  } catch {
    return false;
  }
}

const schema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(10000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
    INSTANCE_ID: z.string().default("local"),
    LOG_LEVEL: z.string().optional(),
    MONGO_URI: z.string().min(1),
    REDIS_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    CSRF_SECRET: z.string().min(32),
    CORS_ORIGINS: z.string().min(1),
    PUBLIC_SITE_URL: z
      .string()
      .url()
      .default("https://my-portfolio-m3bc-9f23jsctz-sandip-80b8.vercel.app")
      .refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          url.pathname === "/" &&
          !url.search &&
          !url.hash
        );
      }, "Must be an HTTPS site origin"),
    COOKIE_DOMAIN: z.string().optional(),
    GITHUB_USERNAME: z.string().default("Sandip-Sec0922"),
    GITHUB_TOKEN: z.string().optional(),
    TURNSTILE_SECRET: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    NOTIFY_EMAIL: z.string().email().optional(),
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM: z.string().trim().min(3).max(320).optional(),
  })
  .superRefine((e, ctx) => {
    if (Boolean(e.RESEND_API_KEY) !== Boolean(e.RESEND_FROM)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [e.RESEND_API_KEY ? "RESEND_FROM" : "RESEND_API_KEY"],
        message: "RESEND_API_KEY and RESEND_FROM must be configured together",
      });
    }

    if (
      new Set([e.JWT_ACCESS_SECRET, e.JWT_REFRESH_SECRET, e.CSRF_SECRET])
        .size !== 3
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_ACCESS_SECRET"],
        message:
          "JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and CSRF_SECRET must all be different",
      });
    }

    const origins = e.CORS_ORIGINS.split(",").map((origin) => origin.trim());
    if (
      e.NODE_ENV === "production" &&
      (origins.length > 10 ||
        new Set(origins).size !== origins.length ||
        origins.some((origin) => !isProductionOrigin(origin)))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ORIGINS"],
        message:
          "Production requires up to 10 unique HTTPS frontend origins (no wildcard, localhost, path, or trailing slash)",
      });
    }

    const values = {
      JWT_ACCESS_SECRET: e.JWT_ACCESS_SECRET,
      JWT_REFRESH_SECRET: e.JWT_REFRESH_SECRET,
      CSRF_SECRET: e.CSRF_SECRET,
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value && /^change_me(?:_|$)/i.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Must be replaced with a unique secret",
        });
      }
    });
  });

// WHY fail fast: a misconfigured security setting should stop boot, not silently weaken the app.
// Only variable names and rules are printed, never values.
const parsed = schema.safeParse(raw);
if (!parsed.success) {
  console.error(
    "Invalid environment configuration:",
    parsed.error.issues.map(
      (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
    ),
  );
  process.exit(1);
}

const e = parsed.data;
const isProd = e.NODE_ENV === "production";

module.exports = Object.freeze({
  env: e.NODE_ENV,
  isProd,
  isTest: e.NODE_ENV === "test",
  port: e.PORT,
  trustProxyHops: e.TRUST_PROXY_HOPS,
  instanceId: e.INSTANCE_ID,
  logLevel:
    e.LOG_LEVEL ||
    (e.NODE_ENV === "test" ? "silent" : isProd ? "info" : "debug"),
  mongoUri: e.MONGO_URI,
  redisUrl: e.REDIS_URL,
  jwt: {
    accessSecret: e.JWT_ACCESS_SECRET,
    refreshSecret: e.JWT_REFRESH_SECRET,
    issuer: "soc-portfolio",
    accessTtl: "15m",
    refreshTtlSec: 7 * 24 * 3600,
  },
  csrfSecret: e.CSRF_SECRET,
  corsOrigins: e.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  publicSiteUrl: new URL(e.PUBLIC_SITE_URL).origin,
  cookieDomain: e.COOKIE_DOMAIN,
  github: { username: e.GITHUB_USERNAME, token: e.GITHUB_TOKEN },
  turnstileSecret: e.TURNSTILE_SECRET,
  smtp: {
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    user: e.SMTP_USER,
    pass: e.SMTP_PASS,
    notifyEmail: e.NOTIFY_EMAIL,
  },
  resend: {
    apiKey: e.RESEND_API_KEY,
    from: e.RESEND_FROM,
  },
});
