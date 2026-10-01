"use strict";
const Project = require("../models/Project");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");
const cache = require("../services/cacheService");

const notFound = () => new AppError(404, "NOT_FOUND", "Project not found");

// Public + cached. Key space is bounded: `category` is a validated enum, unknown params are rejected.
exports.list = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const items = await cache.getOrSet(
    `projects:list:${category || "all"}`,
    15 * 60,
    () =>
      Project.find(category ? { category } : {})
        .select("-__v")
        .sort({ order: 1, createdAt: -1 })
        .lean(),
  );
  res.set("Cache-Control", "public, max-age=60");
  res.json({ items });
});

exports.adminList = asyncHandler(async (req, res) => {
  res.json({
    items: await Project.find()
      .select("-__v")
      .sort({ order: 1, createdAt: -1 })
      .lean(),
  });
});

// Every write invalidates the cached lists so visitors never see stale data after an admin edit.
exports.create = asyncHandler(async (req, res) => {
  const doc = await Project.create(req.body);
  await cache.invalidate("projects:");
  res.status(201).json(doc);
});

exports.update = asyncHandler(async (req, res) => {
  const doc = await Project.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true },
  );
  if (!doc) throw notFound();
  await cache.invalidate("projects:");
  res.json(doc);
});

exports.remove = asyncHandler(async (req, res) => {
  const doc = await Project.findByIdAndDelete(req.params.id);
  if (!doc) throw notFound();
  await cache.invalidate("projects:");
  res.status(204).end();
});
