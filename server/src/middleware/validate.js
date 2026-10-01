"use strict";
const AppError = require("../utils/AppError");
const { logSecurity } = require("../services/securityEventService");

// Validates AND replaces req[source] with the parsed (typed, stripped, defaulted) result, so handlers
// only ever see data that passed the schema. Only field NAMES are logged, never values (they may be secrets).
const validate =
  (schema, source = "body") =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join(".") || "(root)",
        message: i.message,
      }));
      logSecurity("validation_failure", req, {
        source,
        fields: details
          .map((d) => d.field)
          .join(",")
          .slice(0, 200),
      });
      return next(
        new AppError(400, "VALIDATION_ERROR", "Invalid input", details),
      );
    }
    req[source] = result.data;
    next();
  };

module.exports = validate;
