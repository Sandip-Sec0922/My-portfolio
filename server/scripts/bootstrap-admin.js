"use strict";
const mongoose = require("mongoose");
const User = require("../src/models/User");
const passwords = require("../src/services/passwordService");

async function bootstrapAdmin({ mongoUri, email, password }) {
  if (!mongoUri || !email || !password) {
    throw new Error(
      "MONGO_URI, ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are required",
    );
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 14 ||
    password.length > 128
  ) {
    throw new Error("Admin email or password does not meet the required format");
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await User.init();
    if (await User.exists({ role: "admin" })) return false;

    try {
      await User.create({
        email,
        passwordHash: await passwords.hash(password),
        role: "admin",
      });
      return true;
    } catch (error) {
      if (error.code === 11000 && (await User.exists({ role: "admin" })))
        return false;
      throw error;
    }
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  try {
    const created = await bootstrapAdmin({
      mongoUri: process.env.MONGO_URI,
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    });
    process.stdout.write(
      created
        ? "Initial admin created. Unset the one-time bootstrap environment variables.\n"
        : "An admin already exists; no changes made.\n",
    );
  } catch (err) {
    console.error("Bootstrap error:", err);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { bootstrapAdmin };
