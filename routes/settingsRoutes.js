const express = require("express");
const router = express.Router();
const {
  getSettings,
  updateCurrencyRate,
} = require("../controllers/settingsController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.route("/").get(getSettings);
router.route("/currency-rate").put(protect, authorizeRoles("admin"), updateCurrencyRate);

module.exports = router;
