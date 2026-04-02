const express = require("express");
const {
  createPaymentOrder,
  verifyPaymentAndCreateOrder,
} = require("../controllers/paymentController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/create-order", protect, createPaymentOrder);
router.post("/verify", protect, verifyPaymentAndCreateOrder);

module.exports = router;
