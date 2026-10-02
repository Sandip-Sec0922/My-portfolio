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
    if (await User.exists({ role: "admin" })) {
      throw new Error("An admin account already exists; refusing to bootstrap another");
    }

    await User.create({
      email,
      passwordHash: await passwords.hash(password),
      role: "admin",
    });
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  try {
    await bootstrapAdmin({
      mongoUri: process.env.MONGO_URI,
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    });
    process.stdout.write(
      "Initial admin created. Unset the one-time bootstrap environment variables.\n",
    );
  } catch {
    console.error(
      "Admin bootstrap failed. Check the environment, database connectivity, and whether an admin already exists; credentials were not logged.",
    );
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { bootstrapAdmin };
