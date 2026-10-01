"use strict";
const config = require("../config/env");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");

const notFound = (req, res, next) =>
  next(new AppError(404, "NOT_FOUND", "Resource not found"));

// Single exit point for errors. WHY: one place guarantees no stack trace, SQL/Mongo message or file
// path ever reaches a client in production. Full details go to the server log only.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong";
  let details;

  if (err instanceof AppError) {
    ({ status, code, message, details } = err);
  } else if (err.type === "entity.too.large") {
    [status, code, message] = [
      413,
      "PAYLOAD_TOO_LARGE",
      "Request body too large",
    ];
  } else if (err.type === "entity.parse.failed") {
    [status, code, message] = [400, "BAD_JSON", "Malformed JSON"];
  } else if (err.name === "CastError") {
    [status, code, message] = [400, "BAD_ID", "Invalid identifier"];
  } else if (err.name === "ValidationError") {
    [status, code, message] = [400, "VALIDATION_ERROR", "Invalid data"];
  } else if (err.code === 11000) {
    [status, code, message] = [409, "DUPLICATE", "Resource already exists"];
  }

  if (status >= 500)
    logger.error(
      { err, request_id: req.id, path: String(req.originalUrl).split("?")[0] },
      "unhandled_error",
    );

  res.status(status).json({
    error: { code, message, ...(details && { details }), requestId: req.id },
    ...(!config.isProd && status >= 500 && { debug: err.stack }), // dev only, never in production
  });
}

module.exports = { notFound, errorHandler };
