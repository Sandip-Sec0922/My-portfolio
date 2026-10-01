"use strict";
const { z } = require("zod");
const { FilterXSS } = require("xss");
const {
  PROJECT_CATEGORIES,
  POST_CATEGORIES,
  ALL_EVENT_TYPES,
} = require("../utils/constants");

// WHY strip at the trust boundary: plain-text fields never legitimately contain HTML. Removing it here
// protects the admin inbox/email, logs and any future consumer. (React escaping protects the browser.)
const htmlStripper = new FilterXSS({
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
});

const text = ({ min = 1, max, multiline = false }) => {
  let s = z.string().trim().max(max);
  // WHY: CR/LF in single-line fields is the classic email-header / log-injection vector.
  if (!multiline) s = s.regex(/^[^\r\n]*$/, "Must be a single line");
  return s
    .transform((v) => htmlStripper.process(v).trim())
    .pipe(z.string().min(min));
};

const email = z.string().trim().toLowerCase().email().max(254);
const slug = z
  .string()
  .min(1)
  .max(80)
  // The bounded slug grammar is linear in the input length.
  // eslint-disable-next-line security/detect-unsafe-regex
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, hyphens");
const tag = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{1,30}$/);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
// WHY https-only: blocks javascript:, data: and plain-http links stored in admin-managed content.
const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .url()
  .refine((u) => u.startsWith("https://"), "Must be an https URL");
const githubUrl = httpsUrl.refine(
  (u) => new URL(u).hostname === "github.com",
  "Must be a github.com URL",
);
const page = z.coerce.number().int().min(1).max(1000).default(1);

// WHY .strict() everywhere: unknown keys are rejected, which prevents mass-assignment
// (e.g. someone posting {"role":"admin"}).
const loginSchema = z
  .object({ email, password: z.string().min(1).max(128) })
  .strict(); // max 128 bounds argon2 CPU/memory use

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(14).max(128),
  })
  .strict()
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: "New password must differ",
    path: ["newPassword"],
  });

const contactSchema = z
  .object({
    name: text({ max: 80 }),
    email,
    subject: text({ min: 3, max: 120 }),
    message: text({ min: 10, max: 2000, multiline: true }),
    website: z.string().max(200).optional(), // honeypot: real users never see or fill this field
    turnstileToken: z.string().max(2048).optional(),
  })
  .strict();

const projectBase = z
  .object({
    title: text({ max: 100 }),
    slug,
    summary: text({ max: 200 }),
    description: text({ max: 3000, multiline: true }),
    category: z.enum(PROJECT_CATEGORIES),
    tech: z
      .array(text({ max: 30 }))
      .max(20)
      .default([]),
    securityHighlights: z
      .array(text({ max: 200 }))
      .max(10)
      .default([]),
    githubUrl: githubUrl.nullish(),
    liveUrl: httpsUrl.nullish(),
    featured: z.boolean().default(false),
    order: z.number().int().min(0).max(1000).default(0),
  })
  .strict();

const postBase = z
  .object({
    title: text({ max: 150 }),
    slug,
    excerpt: text({ max: 300 }),
    content: z.string().min(1).max(200000), // raw markdown, sanitised at render time on the client
    category: z.enum(POST_CATEGORIES),
    tags: z.array(tag).max(10).default([]),
    published: z.boolean().default(false),
  })
  .strict();

module.exports = {
  loginSchema,
  changePasswordSchema,
  contactSchema,
  projectSchema: projectBase,
  projectUpdateSchema: projectBase.partial(), // partial() leaves absent fields absent (defaults don't overwrite)
  postSchema: postBase,
  postUpdateSchema: postBase.partial(),
  emptyQuery: z.object({}).strict(), // rejects stray params, which also blocks cache-busting
  projectsQuery: z
    .object({ category: z.enum(PROJECT_CATEGORIES).optional() })
    .strict(),
  postsQuery: z
    .object({
      tag: tag.optional(),
      category: z.enum(POST_CATEGORIES).optional(),
      q: z.string().trim().min(2).max(80).optional(),
      page,
    })
    .strict(),
  pageQuery: z.object({ page, unread: z.enum(["true"]).optional() }).strict(),
  eventsQuery: z
    .object({ page, type: z.enum(ALL_EVENT_TYPES).optional() })
    .strict(),
  idParam: z.object({ id: objectId }).strict(),
  slugParam: z.object({ slug }).strict(),
};
