const express = require("express");
const {
	signup,
	login,
	changePassword,
	googleAuth,
	getCsrfToken,
	logout,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { requireFields } = require("../middleware/validateRequest");

const router = express.Router();

router.post("/signup", requireFields(["name", "email", "password"]), signup);
router.post("/login", requireFields(["email", "password"]), login);
router.get("/csrf-token", getCsrfToken);
router.post("/google", requireFields(["credential"]), googleAuth);
router.post(
	"/change-password",
	protect,
	requireFields(["oldPassword", "newPassword"]),
	changePassword
);
router.post("/logout", logout);

module.exports = router;
