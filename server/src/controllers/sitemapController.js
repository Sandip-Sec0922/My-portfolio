"use strict";
const Post = require("../models/Post");
const asyncHandler = require("../utils/asyncHandler");
const config = require("../config/env");

const STATIC_PATHS = [
  "/",
  "/projects",
  "/lab",
  "/roadmap",
  "/blog",
  "/security",
  "/contact",
];

const xmlEscape = (value) =>
  value.replace(/[<>&'"]/g, (char) => {
    const replacements = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return replacements[char];
  });

exports.get = asyncHandler(async (req, res) => {
  const posts = await Post.find({ published: true })
    .select("slug updatedAt")
    .sort({ publishedAt: -1 })
    .lean();
  const entries = [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...posts.map((post) => ({
      path: `/blog/${post.slug}`,
      updatedAt: post.updatedAt,
    })),
  ];
  const urls = entries
    .map(({ path, updatedAt }) => {
      const loc = xmlEscape(`${config.publicSiteUrl}${path}`);
      const lastmod =
        updatedAt instanceof Date
          ? `<lastmod>${updatedAt.toISOString()}</lastmod>`
          : "";
      return `<url><loc>${loc}</loc>${lastmod}</url>`;
    })
    .join("");

  res
    .type("application/xml")
    .set("Cache-Control", "public, max-age=300")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    );
});
