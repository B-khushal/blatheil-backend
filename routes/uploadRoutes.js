const express = require("express");
const { uploadImage, uploadMultipleImages } = require("../controllers/uploadController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();

// Single image upload (legacy)
router.post("/", protect, authorizeRoles("admin"), upload.single, uploadImage);

// Multiple images upload
router.post("/multiple", protect, authorizeRoles("admin"), upload.multiple, uploadMultipleImages);

module.exports = router;
