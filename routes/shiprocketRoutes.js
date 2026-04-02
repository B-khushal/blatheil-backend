const express = require("express");
const {
  createShipment,
  handleWebhook,
  trackByAwb,
} = require("../controllers/shiprocketController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/create-order", protect, authorizeRoles("admin"), createShipment);
router.post("/webhook", handleWebhook);
router.get("/track/:awb", trackByAwb);

module.exports = router;
