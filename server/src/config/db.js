"use strict";
const mongoose = require("mongoose");
const config = require("./env");
const logger = require("../utils/logger");

mongoose.set("strictQuery", true); // unknown filter fields are dropped instead of being passed to MongoDB

async function connectDB() {
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10,
  });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  logger.info("mongo_connected");
}

module.exports = { connectDB };
