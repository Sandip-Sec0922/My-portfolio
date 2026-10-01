"use strict";
const Post = require("../models/Post");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const cache = require("../services/cacheService");

const PAGE = 10;
const notFound = () => new AppError(404, "NOT_FOUND", "Post not found");
const paged = (items, total, page) => ({
  items,
  total,
  page,
  pages: Math.ceil(total / PAGE),
});

exports.list = asyncHandler(async (req, res) => {
  const { tag, category, q, page } = req.query;
  const filter = {
    published: true,
    ...(tag && { tags: tag }),
    ...(category && { category }),
  };
  const skip = (page - 1) * PAGE;
  res.set("Cache-Control", "public, max-age=60");

  // Search results are NOT cached: free-text input has an unbounded key space and would let an
  // attacker fill Redis. $text uses an index; q is a validated plain string (never an object).
  if (q) {
    const f = { ...filter, $text: { $search: q } };
    const [items, total] = await Promise.all([
      Post.find(f, { score: { $meta: "textScore" } })
        .select("-content -__v")
        .sort({ score: { $meta: "textScore" } })
        .skip(skip)
        .limit(PAGE)
        .lean(),
      Post.countDocuments(f),
    ]);
    return res.json(paged(items, total, page));
  }

  const data = await cache.getOrSet(
    `posts:list:${category || "all"}:${tag || "all"}:${page}`,
    10 * 60,
    async () => {
      const [items, total] = await Promise.all([
        Post.find(filter)
          .select("-content -__v")
          .sort({ publishedAt: -1 })
          .skip(skip)
          .limit(PAGE)
          .lean(),
        Post.countDocuments(filter),
      ]);
      return paged(items, total, page);
    },
    (v) => v.items.length > 0, // never cache empty pages (random tags / page numbers)
  );
  res.json(data);
});

exports.getBySlug = asyncHandler(async (req, res) => {
  const post = await cache.getOrSet(
    `posts:slug:${req.params.slug}`,
    10 * 60,
    () =>
      Post.findOne({ slug: req.params.slug, published: true })
        .select("-__v")
        .lean(),
    (v) => v !== null, // never cache 404s
  );
  if (!post) throw notFound();
  res.set("Cache-Control", "public, max-age=60");
  res.json(post);
});

// ---- admin ----
exports.adminList = asyncHandler(async (req, res) => {
  res.json({
    items: await Post.find()
      .select("-content -__v")
      .sort({ updatedAt: -1 })
      .lean(),
  });
});

exports.adminGet = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id).lean();
  if (!post) throw notFound();
  res.json(post);
});

exports.create = asyncHandler(async (req, res) => {
  const post = await Post.create({
    ...req.body,
    publishedAt: req.body.published ? new Date() : null,
  });
  await cache.invalidate("posts:");
  res.status(201).json(post);
});

exports.update = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw notFound();
  Object.assign(post, req.body); // safe: body already passed a .strict() schema (no mass assignment)
  if (post.published && !post.publishedAt) post.publishedAt = new Date();
  await post.save();
  await cache.invalidate("posts:");
  res.json(post);
});

exports.remove = asyncHandler(async (req, res) => {
  const post = await Post.findByIdAndDelete(req.params.id);
  if (!post) throw notFound();
  await cache.invalidate("posts:");
  res.status(204).end();
});
