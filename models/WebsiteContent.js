const mongoose = require("mongoose");

const websiteContentSchema = new mongoose.Schema(
  {
    heroSection: {
      title: { type: String, default: "Born to Lead Style" },
      subtitle: { type: String, default: "Premium streetwear designed for leaders." },
      buttonText: { type: String, default: "Shop the Drop" },
      buttonLink: { type: String, default: "/shop" },
      desktopImage: { type: String, default: "" }, // Background URL
      mobileImage: { type: String, default: "" }, // Background URL
      isActive: { type: Boolean, default: true },
    },
    collectionsSection: [
      {
        id: { type: String }, // For drag-and-drop sortable mapping
        title: { type: String },
        image: { type: String },
        redirectLink: { type: String },
        displayOrder: { type: Number },
      },
    ],
    nextDropSection: {
      title: { type: String, default: "Next Drop Incoming" },
      description: { type: String, default: "Limited pieces. Once they're gone, they're gone. Set your alarms." },
      image: { type: String, default: "" },
      countdownDate: { type: Date },
      isVisible: { type: Boolean, default: true },
    },
    announcementBar: {
      text: { type: String, default: "Free shipping on orders over $150" },
      isVisible: { type: Boolean, default: false },
    },
    footer: {
      aboutText: { type: String, default: "BLATHEIL is a luxury premium streetwear brand." },
      instagram: { type: String, default: "https://instagram.com" },
      whatsapp: { type: String, default: "" },
      email: { type: String, default: "contact@blatheil.com" },
    },
    seo: {
      metaTitle: { type: String, default: "BLATHEIL | Born to Lead Style" },
      metaDescription: { type: String, default: "Premium streetwear designed for leaders. Shop the latest collections from BLATHEIL." },
      keywords: { type: [String], default: ["streetwear", "luxury", "blatheil", "clothing", "fashion"] },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WebsiteContent", websiteContentSchema);
