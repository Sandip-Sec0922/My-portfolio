"use strict";
const mongoose = require("mongoose");
const { PROJECT_CATEGORIES } = require("../utils/constants");

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, maxlength: 80 },
    summary: { type: String, required: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 3000 },
    category: {
      type: String,
      enum: PROJECT_CATEGORIES,
      required: true,
      index: true,
    },
    tech: [{ type: String, maxlength: 30 }],
    securityHighlights: [{ type: String, maxlength: 200 }],
    githubUrl: { type: String, maxlength: 300 },
    liveUrl: { type: String, maxlength: 300 },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Project", projectSchema);
