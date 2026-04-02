const GlobalSettings = require("../models/GlobalSettings");

// @desc    Get global settings
// @route   GET /api/settings
// @access  Public
const getSettings = async (req, res, next) => {
  try {
    let settings = await GlobalSettings.findOne();

    // If no settings document exists, create default one
    if (!settings) {
      settings = await GlobalSettings.create({
        usdRate: 83,
      });
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update currency rate
// @route   PUT /api/settings/currency-rate
// @access  Private/Admin
const updateCurrencyRate = async (req, res, next) => {
  try {
    const { usdRate } = req.body;

    if (!usdRate || isNaN(usdRate) || usdRate <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid USD to INR conversion rate greater than 0.",
      });
    }

    let settings = await GlobalSettings.findOne();

    if (!settings) {
      settings = await GlobalSettings.create({ usdRate });
    } else {
      settings.usdRate = usdRate;
      await settings.save();
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateCurrencyRate,
};
