const express = require("express");
const {
  getProfile,
  updateProfile,
  getTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
} = require("../controllers/userController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/profile").get(protect, getProfile).put(protect, updateProfile);

// Team routes (Admin only)
router.route("/team")
  .get(protect, authorizeRoles("admin"), getTeamMembers)
  .post(protect, authorizeRoles("admin"), createTeamMember);

router.route("/team/:id")
  .put(protect, authorizeRoles("admin"), updateTeamMember)
  .delete(protect, authorizeRoles("admin"), deleteTeamMember);

module.exports = router;
