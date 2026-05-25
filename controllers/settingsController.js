const {
  SUPPORTED_CURRENCIES,
  syncExchangeRatesIfNeeded,
  setManualUsdRate,
} = require("../services/currencyRateService");

// @desc    Get global settings
// @route   GET /api/settings
// @access  Public
const getSettings = async (req, res, next) => {
  try {
    // Automatically refresh INR/USD rate once per day (best effort)
    const settings = await syncExchangeRatesIfNeeded();

    const exchangeRates = Object.fromEntries(settings.exchangeRates || []);

    res.status(200).json({
      success: true,
      data: {
        ...settings.toObject(),
        exchangeRates,
        supportedCurrencies: SUPPORTED_CURRENCIES,
      },
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

    const settings = await setManualUsdRate(usdRate);

    res.status(200).json({
      success: true,
      data: {
        ...settings.toObject(),
        exchangeRates: Object.fromEntries(settings.exchangeRates || []),
        supportedCurrencies: SUPPORTED_CURRENCIES,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Force currency sync from provider
// @route   POST /api/settings/currency-sync
// @access  Private/Admin
const forceCurrencySync = async (req, res, next) => {
  try {
    const settings = await syncExchangeRatesIfNeeded({ force: true });
    res.status(200).json({
      success: true,
      data: {
        ...settings.toObject(),
        exchangeRates: Object.fromEntries(settings.exchangeRates || []),
        supportedCurrencies: SUPPORTED_CURRENCIES,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateCurrencyRate,
  forceCurrencySync,
};
