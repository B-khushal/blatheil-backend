const express = require("express");
const router = express.Router();
const {
  getSettings,
  updateCurrencyRate,
  forceCurrencySync,
} = require("../controllers/settingsController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

router.route("/").get(getSettings);
router.route("/currency-rate").put(protect, authorizeRoles("admin"), updateCurrencyRate);
router.route("/currency-sync").post(protect, authorizeRoles("admin"), forceCurrencySync);

module.exports = router;
