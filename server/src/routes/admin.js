"use strict";
const router = require("express").Router();
const validate = require("../middleware/validate");
const { authenticate, requireRole } = require("../middleware/auth");
const { csrfProtect } = require("../middleware/csrf");
const { adminLimiter } = require("../middleware/rateLimit");
const s = require("../validators/schemas");
const project = require("../controllers/projectController");
const post = require("../controllers/postController");
const message = require("../controllers/messageController");
const security = require("../controllers/securityController");

// Everything below is deny-by-default: authenticated + admin role + CSRF on writes + rate limited.
router.use(authenticate, requireRole("admin"), csrfProtect, adminLimiter);

router.get("/projects", project.adminList);
router.post("/projects", validate(s.projectSchema), project.create);
router.put(
  "/projects/:id",
  validate(s.idParam, "params"),
  validate(s.projectUpdateSchema),
  project.update,
);
router.delete("/projects/:id", validate(s.idParam, "params"), project.remove);

router.get("/posts", post.adminList);
router.get("/posts/:id", validate(s.idParam, "params"), post.adminGet);
router.post("/posts", validate(s.postSchema), post.create);
router.put(
  "/posts/:id",
  validate(s.idParam, "params"),
  validate(s.postUpdateSchema),
  post.update,
);
router.delete("/posts/:id", validate(s.idParam, "params"), post.remove);

router.get("/messages", validate(s.pageQuery, "query"), message.list);
router.patch(
  "/messages/:id/read",
  validate(s.idParam, "params"),
  message.markRead,
);
router.delete("/messages/:id", validate(s.idParam, "params"), message.remove);

router.get(
  "/security-events",
  validate(s.eventsQuery, "query"),
  security.events,
);

module.exports = router;
