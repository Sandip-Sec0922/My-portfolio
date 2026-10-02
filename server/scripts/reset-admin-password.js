"use strict";
const mongoose = require("mongoose");
const User = require("../src/models/User");
const passwords = require("../src/services/passwordService");

async function resetAdminPassword({ mongoUri, email, newPassword }) {
  if (!mongoUri || !email || !newPassword) {
    throw new Error("MONGO_URI, ADMIN_EMAIL and NEW_PASSWORD are required");
  }
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    newPassword.length < 14 ||
    newPassword.length > 128
  ) {
    throw new Error("Admin email or new password does not meet the required format");
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  try {
    const user = await User.findOne({
      $expr: {
        $eq: [{ $toLower: "$email" }, email.trim().toLowerCase()],
      },
    });
    if (!user) throw new Error("No user found with that email");
    if (user.role !== "admin")
      throw new Error("The user exists but does not have the admin role");

    user.passwordHash = await passwords.hash(newPassword);
    await user.save();
  } finally {
    await mongoose.disconnect();
  }
}

async function main() {
  try {
    await resetAdminPassword({
      mongoUri: process.env.MONGO_URI,
      email: process.env.ADMIN_EMAIL,
      newPassword: process.env.NEW_PASSWORD,
    });
    process.stdout.write(`Password reset for ${process.env.ADMIN_EMAIL.trim()}\n`);
  } catch (error) {
    console.error(`Admin password reset failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { resetAdminPassword };
