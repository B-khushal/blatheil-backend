const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const {
  getActiveOffer,
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  validateOffer,
} = require("../controllers/offerController");

router.route("/").post(protect, authorizeRoles("admin"), createOffer).get(protect, authorizeRoles("admin"), getOffers);
router.get("/active", getActiveOffer);
router.get("/validate/:code", validateOffer);
router.route("/:id").put(protect, authorizeRoles("admin"), updateOffer).delete(protect, authorizeRoles("admin"), deleteOffer);

module.exports = router;
