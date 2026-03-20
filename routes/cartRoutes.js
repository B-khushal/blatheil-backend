const express = require("express");
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} = require("../controllers/cartController");
const { protect } = require("../middleware/authMiddleware");
const { requireFields } = require("../middleware/validateRequest");

const router = express.Router();

router.get("/", protect, getCart);
router.post("/add", protect, requireFields(["productId", "quantity", "size"]), addToCart);
router.put("/update", protect, requireFields(["productId", "quantity", "size"]), updateCartItem);
router.post("/remove", protect, requireFields(["productId", "size"]), removeFromCart);
router.post("/clear", protect, clearCart);

module.exports = router;
