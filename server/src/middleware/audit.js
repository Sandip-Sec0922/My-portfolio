"use strict";
const { logSecurity } = require("../services/securityEventService");

const audit = (action) => (req, res, next) => {
  res.once("finish", () => {
    if (res.statusCode < 400) {
      logSecurity(`admin_${action}`, req, {
        actorId: req.user.id,
        target: req.params.id || req.body?.slug || req.baseUrl,
      });
    }
  });
  next();
};

module.exports = audit;
