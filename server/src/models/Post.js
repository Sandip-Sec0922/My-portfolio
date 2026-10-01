"use strict";
const mongoose = require("mongoose");
const { POST_CATEGORIES } = require("../utils/constants");

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true, maxlength: 80 },
    excerpt: { type: String, required: true, maxlength: 300 },
    // Stored as RAW markdown. The server never renders it; the client renders without raw HTML (Phase 4).
    content: { type: String, required: true, maxlength: 200000 },
    category: { type: String, enum: POST_CATEGORIES, required: true },
    tags: [{ type: String, maxlength: 30 }],
    published: { type: Boolean, default: false },
    publishedAt: Date,
  },
  { timestamps: true },
);

postSchema.index({ published: 1, publishedAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index(
  { title: "text", excerpt: "text", tags: "text", content: "text" },
  { weights: { title: 10, tags: 5, excerpt: 3, content: 1 } },
);

module.exports = mongoose.model("Post", postSchema);
