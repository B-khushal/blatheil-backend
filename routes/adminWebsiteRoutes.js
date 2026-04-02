const express = require("express");
const router = express.Router();
const {
  getWebsiteContent,
  updateWebsiteContent,
} = require("../controllers/adminWebsiteController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// Route is mounted at /api/admin/website-content in server.js
// But it's usually good to keep the public part public if we are fetching it on the frontend without auth.
// Wait, the specification says GET /api/admin/website-content needs to be fetched by public UI.
// So GET is public, PUT is protected.
router.route("/")
  .get(getWebsiteContent)
  .put(protect, authorizeRoles("admin"), updateWebsiteContent);

module.exports = router;
