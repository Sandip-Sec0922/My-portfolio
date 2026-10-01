"use strict";
const Message = require("../models/Message");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

const PAGE = 20;

exports.list = asyncHandler(async (req, res) => {
  const { page, unread } = req.query;
  const filter = unread ? { read: false } : {};
  const [items, total] = await Promise.all([
    Message.find(filter)
      .select("-__v")
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE)
      .limit(PAGE)
      .lean(),
    Message.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / PAGE) });
});

exports.markRead = asyncHandler(async (req, res) => {
  const doc = await Message.findByIdAndUpdate(
    req.params.id,
    { $set: { read: true } },
    { new: true },
  );
  if (!doc) throw new AppError(404, "NOT_FOUND", "Message not found");
  res.json(doc);
});

exports.remove = asyncHandler(async (req, res) => {
  const doc = await Message.findByIdAndDelete(req.params.id);
  if (!doc) throw new AppError(404, "NOT_FOUND", "Message not found");
  res.status(204).end();
});
