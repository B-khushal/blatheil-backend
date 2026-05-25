const mongoose = require("mongoose");

const globalSettingsSchema = new mongoose.Schema(
  {
    usdRate: {
      type: Number,
      default: 83, // 1 USD = 83 INR by default
      required: true,
    },
    autoSyncEnabled: {
      type: Boolean,
      default: true,
    },
    lastRateSyncedAt: {
      type: Date,
      default: null,
    },
    rateProvider: {
      type: String,
      default: "manual/default",
      trim: true,
    },
    // Can expand with other global settings later like shipping fee config, maintenance mode etc.
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("GlobalSettings", globalSettingsSchema);
