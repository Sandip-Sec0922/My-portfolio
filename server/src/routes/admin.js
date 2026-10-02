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
const audit = require("../middleware/audit");

// Everything below is deny-by-default: authenticated + admin role + CSRF on writes + rate limited.
router.use(authenticate, requireRole("admin"), csrfProtect, adminLimiter);

router.get("/projects", project.adminList);
router.post("/projects", validate(s.projectSchema), audit("create"), project.create);
router.put(
  "/projects/:id",
  validate(s.idParam, "params"),
  validate(s.projectUpdateSchema),
  audit("update"),
  project.update,
);
router.delete("/projects/:id", validate(s.idParam, "params"), audit("delete"), project.remove);

router.get("/posts", post.adminList);
router.get("/posts/:id", validate(s.idParam, "params"), post.adminGet);
router.post("/posts", validate(s.postSchema), audit("create"), post.create);
router.put(
  "/posts/:id",
  validate(s.idParam, "params"),
  validate(s.postUpdateSchema),
  audit("update"),
  post.update,
);
router.delete("/posts/:id", validate(s.idParam, "params"), audit("delete"), post.remove);

router.get("/messages", validate(s.pageQuery, "query"), message.list);
router.patch(
  "/messages/:id/read",
  validate(s.idParam, "params"),
  audit("update"),
  message.markRead,
);
router.delete("/messages/:id", validate(s.idParam, "params"), audit("delete"), message.remove);

router.get(
  "/security-events",
  validate(s.eventsQuery, "query"),
  security.events,
);

module.exports = router;
