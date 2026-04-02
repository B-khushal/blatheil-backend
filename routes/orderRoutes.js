const express = require("express");
const {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
} = require("../controllers/orderController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { requireFields } = require("../middleware/validateRequest");

const router = express.Router();

router.post(
  "/",
  protect,
  requireFields(["items", "shippingAddress", "phone", "fullName", "city", "state", "pincode"]),
  createOrder
);
router.get("/my", protect, getMyOrders);
router.get("/", protect, authorizeRoles("admin"), getAllOrders);
router.put("/:id/status", protect, authorizeRoles("admin"), updateOrderStatus);

module.exports = router;
