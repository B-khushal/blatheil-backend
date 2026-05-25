const GlobalSettings = require("../models/GlobalSettings");

const DEFAULT_USD_RATE = 83;
const FX_API_URL = process.env.FX_API_URL || "https://open.er-api.com/v6/latest/USD";
const SYNC_CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly check; updates at most once per day

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

async function fetchInrPerUsdFromProvider() {
  const response = await fetch(FX_API_URL, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`FX provider responded with status ${response.status}`);
  }

  const payload = await response.json();
  const inrRate =
    normalizeRate(payload?.rates?.INR) ||
    normalizeRate(payload?.conversion_rates?.INR) ||
    normalizeRate(payload?.data?.INR);

  if (!inrRate) {
    throw new Error("FX provider response does not include a valid INR rate");
  }

  return {
    usdRate: inrRate,
    provider: payload?.provider || payload?.result || "open.er-api.com",
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
    });
  }
  return settings;
}

async function syncUsdRateIfNeeded(options = {}) {
  const { force = false } = options;
  const settings = await getOrCreateSettings();

  if (!force && !settings.autoSyncEnabled) {
    return settings;
  }

  if (!force && !shouldSyncToday(settings.lastRateSyncedAt)) {
    return settings;
  }

  try {
    const { usdRate, provider } = await fetchInrPerUsdFromProvider();
    settings.usdRate = usdRate;
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
  syncUsdRateIfNeeded().catch((error) => {
    console.error(`Initial currency sync failed: ${error.message}`);
  });

  syncIntervalHandle = setInterval(() => {
    syncUsdRateIfNeeded().catch((error) => {
      console.error(`Scheduled currency sync failed: ${error.message}`);
    });
  }, SYNC_CHECK_INTERVAL_MS);
}

module.exports = {
  DEFAULT_USD_RATE,
  syncUsdRateIfNeeded,
  startCurrencyRateAutoSync,
};
