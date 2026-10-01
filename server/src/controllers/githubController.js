"use strict";
const asyncHandler = require("../utils/asyncHandler");
const { getGithubData } = require("../services/githubService");

exports.get = asyncHandler(async (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json(await getGithubData());
});
