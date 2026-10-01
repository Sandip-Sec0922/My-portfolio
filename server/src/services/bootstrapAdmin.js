"use strict";
const config = require("../config/env");
const logger = require("../utils/logger");
const User = require("../models/User");
const passwords = require("./passwordService");

// Creates the first admin once. Three replicas boot together, so a duplicate-key error from a
// sibling winning the race is expected and ignored. There is no public registration endpoint.
async function bootstrapAdmin() {
  if (await User.exists({ role: "admin" })) return;
  const { email, password } = config.adminBootstrap;
  if (!email || !password) {
    logger.warn("no_admin_exists_and_no_bootstrap_credentials_set");
    return;
  }
  try {
    await User.create({
      email,
      passwordHash: await passwords.hash(password),
      role: "admin",
    });
    logger.warn(
      { email },
      "admin_bootstrapped: change the password, then remove ADMIN_BOOTSTRAP_* from .env",
    );
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

module.exports = bootstrapAdmin;
