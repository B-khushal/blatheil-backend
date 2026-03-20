const express = require("express");
const { signup, login, changePassword } = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { requireFields } = require("../middleware/validateRequest");

const router = express.Router();

router.post("/signup", requireFields(["name", "email", "password"]), signup);
router.post("/login", requireFields(["email", "password"]), login);
router.post(
	"/change-password",
	protect,
	requireFields(["oldPassword", "newPassword"]),
	changePassword
);

module.exports = router;
