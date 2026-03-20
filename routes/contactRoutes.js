const express = require("express");
const { submitContact } = require("../controllers/contactController");
const { requireFields } = require("../middleware/validateRequest");

const router = express.Router();

router.post("/", requireFields(["name", "email", "message"]), submitContact);

module.exports = router;
