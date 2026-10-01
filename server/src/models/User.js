"use strict";
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    // select:false -> the hash is never loaded unless a query explicitly asks (login / change-password).
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin"], default: "admin" },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
