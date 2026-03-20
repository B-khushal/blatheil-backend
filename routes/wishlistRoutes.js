const express = require("express");
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} = require("../controllers/wishlistController");
const { protect } = require("../middleware/authMiddleware");
const { requireFields } = require("../middleware/validateRequest");

const router = express.Router();

router.get("/", protect, getWishlist);
router.post("/add", protect, requireFields(["productId"]), addToWishlist);
router.delete("/remove/:productId", protect, removeFromWishlist);

module.exports = router;
