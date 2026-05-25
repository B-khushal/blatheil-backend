const {
  SUPPORTED_CURRENCIES,
  syncExchangeRatesIfNeeded,
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
        supportsForceCurrencySync: true,
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
        supportsForceCurrencySync: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  forceCurrencySync,
};
