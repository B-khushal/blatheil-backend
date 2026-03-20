const express = require("express");
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { requireFields } = require("../middleware/validateRequest");

const router = express.Router();

router.get("/", getProducts);
router.get("/:id", getProductById);
router.post(
  "/",
  protect,
  authorizeRoles("admin"),
  requireFields(["name", "price", "category", "description", "stock"]),
  createProduct
);
router.put("/:id", protect, authorizeRoles("admin"), updateProduct);
router.delete("/:id", protect, authorizeRoles("admin"), deleteProduct);

module.exports = router;
