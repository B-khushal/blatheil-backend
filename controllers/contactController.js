const asyncHandler = require("express-async-handler");
const { CONTACT_EMAIL } = require("../config/contact");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(\+91\s?)?[6-9]\d{9}$/;

const submitContact = asyncHandler(async (req, res) => {
  const { name, email, message, phone } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      message: "name, email and message are required",
    });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
    });
  }

  if (phone && !phoneRegex.test(String(phone).replace(/[-()\s]/g, ""))) {
    return res.status(400).json({
      success: false,
      message: "Invalid phone format",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Contact request received",
    data: {
      recipientEmail: CONTACT_EMAIL,
    },
  });
});

module.exports = { submitContact };
