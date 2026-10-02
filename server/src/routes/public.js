"use strict";

const router = require("express").Router();
const validate = require("../middleware/validate");
const { csrfProtect } = require("../middleware/csrf");
const { contactLimiter } = require("../middleware/rateLimit");
const s = require("../validators/schemas");
const projects = require("../controllers/projectController");
const posts = require("../controllers/postController");
const contact = require("../controllers/contactController");
const github = require("../controllers/githubController");
const security = require("../controllers/securityController");
const sitemap = require("../controllers/sitemapController");

router.get("/sitemap.xml", sitemap.get);
router.get("/projects", validate(s.projectsQuery, "query"), projects.list);
router.get("/posts", validate(s.postsQuery, "query"), posts.list);
router.get("/posts/:slug", validate(s.slugParam, "params"), posts.getBySlug);
router.get("/github", github.get);
router.get("/security/posture", security.posture);
router.post(
  "/contact",
  csrfProtect,
  contactLimiter,
  validate(s.contactSchema),
  contact.create,
);
module.exports = router;