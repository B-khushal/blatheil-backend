const mongoose = require("mongoose");

const offerCampaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: "",
    },
    couponCode: {
      type: String,
      trim: true,
    },
    buttonText: {
      type: String,
      default: "SHOP NOW",
    },
    buttonLink: {
      type: String,
      default: "/shop",
    },
    image: {
      type: String,
      default: "",
    },
    campaignId: {
      type: String,
      required: true,
      unique: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    popupDelay: {
      type: Number,
      default: 3000,
    },
    showOnce: {
      type: Boolean,
      default: true,
    },
    // ── Discount fields ──────────────────────────────────
    discountType: {
      type: String,
      enum: ["percentage", "flat"],
      default: "percentage",
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimumOrderValue: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("OfferCampaign", offerCampaignSchema);
