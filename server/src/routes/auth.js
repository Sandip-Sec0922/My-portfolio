"use strict";

const router = require("express").Router();
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { csrfProtect } = require("../middleware/csrf");
const {
  loginLimiter,
  refreshLimiter,
} = require("../middleware/rateLimit");
const s = require("../validators/schemas");
const auth = require("../controllers/authController");

router.get("/csrf", auth.csrf);
router.post(
  "/login",
  csrfProtect,
  loginLimiter,
  validate(s.loginSchema),
  auth.login,
);
router.post("/refresh", csrfProtect, refreshLimiter, auth.refresh);
router.post("/logout", csrfProtect, auth.logout);
router.get("/me", authenticate, auth.me);
router.post(
  "/change-password",
  authenticate,
  csrfProtect,
  validate(s.changePasswordSchema),
  auth.changePassword,
);

module.exports = router;