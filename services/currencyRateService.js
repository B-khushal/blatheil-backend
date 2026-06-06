const GlobalSettings = require("../models/GlobalSettings");

const DEFAULT_USD_RATE = 83;
const FX_API_URL = process.env.FX_API_URL || "https://open.er-api.com/v6/latest/USD";
const SYNC_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly check; updates at most once per day
const SUPPORTED_CURRENCIES = [
  "INR",
  "USD",
  "AED",
  "AUD",
  "GBP",
  "EUR",
  "CAD",
  "SGD",
  "JPY",
  "NZD",
];

const utcDayKey = (date) => new Date(date).toISOString().slice(0, 10);

const shouldSyncToday = (lastSyncedAt) => {
  if (!lastSyncedAt) return true;
  return utcDayKey(lastSyncedAt) !== utcDayKey(new Date());
};

const normalizeRate = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  // Keep up to 4 decimals for accuracy while keeping payload clean
  return Number(numeric.toFixed(4));
};

const toPlainRatesObject = (mapOrObject) => {
  if (!mapOrObject) return {};
  if (typeof mapOrObject.get === "function") {
    return Object.fromEntries(mapOrObject);
  }
  return { ...mapOrObject };
};

function buildDefaultExchangeRates() {
  return {
    INR: 1,
    USD: DEFAULT_USD_RATE,
    AED: Number((DEFAULT_USD_RATE / 3.6725).toFixed(4)),
    AUD: Number((DEFAULT_USD_RATE / 1.53).toFixed(4)),
    GBP: Number((DEFAULT_USD_RATE / 0.79).toFixed(4)),
    EUR: Number((DEFAULT_USD_RATE / 0.92).toFixed(4)),
    CAD: Number((DEFAULT_USD_RATE / 1.36).toFixed(4)),
    SGD: Number((DEFAULT_USD_RATE / 1.35).toFixed(4)),
    JPY: Number((DEFAULT_USD_RATE / 157).toFixed(4)),
    NZD: Number((DEFAULT_USD_RATE / 1.66).toFixed(4)),
  };
}

function ensureAllSupportedRates(ratesInput) {
  const defaults = buildDefaultExchangeRates();
  const current = toPlainRatesObject(ratesInput);
  const merged = { ...defaults };

  for (const code of SUPPORTED_CURRENCIES) {
    const candidate = normalizeRate(current[code]);
    if (code === "INR") {
      merged.INR = 1;
      continue;
    }
    merged[code] = candidate || defaults[code];
  }

  return merged;
}

async function fetchInrBasedRatesFromProvider() {
  const response = await fetch(FX_API_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`FX provider responded with status ${response.status}`);
  }

  const payload = await response.json();
  const rates = payload?.rates || payload?.conversion_rates || payload?.data || {};
  const inrRate =
    normalizeRate(payload?.rates?.INR) ||
    normalizeRate(payload?.conversion_rates?.INR) ||
    normalizeRate(payload?.data?.INR);

  if (!inrRate) {
    throw new Error("FX provider response does not include a valid INR rate");
  }

  const exchangeRates = { INR: 1 };
  for (const currency of SUPPORTED_CURRENCIES) {
    if (currency === "INR") {
      exchangeRates.INR = 1;
      continue;
    }

    const usdToCurrency = normalizeRate(rates[currency]);
    if (!usdToCurrency) {
      continue;
    }

    exchangeRates[currency] = normalizeRate(inrRate / usdToCurrency);
  }

  return {
    usdRate: inrRate,
    exchangeRates,
    provider: "auto-forex-sync",
  };
}

async function getOrCreateSettings() {
  let settings = await GlobalSettings.findOne();
  if (!settings) {
    settings = await GlobalSettings.create({
      usdRate: DEFAULT_USD_RATE,
      autoSyncEnabled: true,
      lastRateSyncedAt: null,
      rateProvider: "manual/default",
      exchangeRates: buildDefaultExchangeRates(),
    });
  }

  // Normalize legacy provider strings to a generic label.
  if (typeof settings.rateProvider === "string" && settings.rateProvider.startsWith("http")) {
    settings.rateProvider = "auto-forex-sync";
  }

  // Backfill for older settings docs and ensure new currencies are always present.
  const patchedRates = ensureAllSupportedRates(settings.exchangeRates);
  const currentRates = toPlainRatesObject(settings.exchangeRates);
  const needsPatch = SUPPORTED_CURRENCIES.some((code) => !currentRates[code]);
  const needsSave = !settings.exchangeRates || settings.exchangeRates.size === 0 || needsPatch;
  if (needsSave) {
    settings.exchangeRates = patchedRates;
    settings.usdRate = patchedRates.USD || settings.usdRate || DEFAULT_USD_RATE;
  }

  if (needsSave || settings.isModified("rateProvider")) {
    await settings.save();
  }

  return settings;
}

async function syncExchangeRatesIfNeeded(options = {}) {
  const { force = false } = options;
  const settings = await getOrCreateSettings();

  if (!force && !settings.autoSyncEnabled) {
    // Keep data shape complete even when auto sync is disabled.
    settings.exchangeRates = ensureAllSupportedRates(settings.exchangeRates);
    return settings;
  }

  if (!force && !shouldSyncToday(settings.lastRateSyncedAt)) {
    // Already synced today; still ensure all currencies exist.
    settings.exchangeRates = ensureAllSupportedRates(settings.exchangeRates);
    return settings;
  }

  try {
    const { usdRate, exchangeRates, provider } = await fetchInrBasedRatesFromProvider();
    const existingRates = ensureAllSupportedRates(settings.exchangeRates);
    settings.usdRate = usdRate;
    settings.exchangeRates = ensureAllSupportedRates({
      ...existingRates,
      ...exchangeRates,
    });
    settings.lastRateSyncedAt = new Date();
    settings.rateProvider = provider;
    await settings.save();
  } catch (error) {
    console.error(`Currency auto-sync skipped: ${error.message}`);
    // Keep last known rate; do not fail request/server boot.
  }

  return settings;
}

let syncIntervalHandle = null;

function startCurrencyRateAutoSync() {
  if (syncIntervalHandle) return;

  // Initial best-effort sync on startup
  syncExchangeRatesIfNeeded().catch((error) => {
    console.error(`Initial currency sync failed: ${error.message}`);
  });

  syncIntervalHandle = setInterval(() => {
    syncExchangeRatesIfNeeded().catch((error) => {
      console.error(`Scheduled currency sync failed: ${error.message}`);
    });
  }, SYNC_CHECK_INTERVAL_MS);
}

module.exports = {
  DEFAULT_USD_RATE,
  SUPPORTED_CURRENCIES,
  syncExchangeRatesIfNeeded,
  startCurrencyRateAutoSync,
  buildDefaultExchangeRates,
};
