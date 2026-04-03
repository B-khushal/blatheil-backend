const asyncHandler = require("express-async-handler");
const OfferCampaign = require("../models/OfferCampaign");

// @desc    Get active offer campaign (public)
// @route   GET /api/offers/active
// @access  Public
const getActiveOffer = asyncHandler(async (req, res) => {
  // Pick the NEWEST active offer for the popup campaign
  const offer = await OfferCampaign.findOne({ isActive: true })
    .sort({ createdAt: -1 })
    .exec();

  if (!offer) {
    return res.status(200).json({ success: false, message: "No active offer campaign" });
  }

  // Auto-expire if end date has passed
  if (offer.endDate && new Date(offer.endDate) < new Date()) {
    offer.isActive = false;
    await offer.save();
    return res.status(404).json({ success: false, message: "Offer expired" });
  }

  res.json({ success: true, data: offer });
});

// @desc    Get all offer campaigns
// @route   GET /api/offers
// @access  Private/Admin
const getOffers = asyncHandler(async (req, res) => {
  const offers = await OfferCampaign.find({}).sort({ createdAt: -1 });
  res.json({ success: true, data: offers });
});

// @desc    Create a new offer campaign
// @route   POST /api/offers
// @access  Private/Admin
const createOffer = asyncHandler(async (req, res) => {
  const {
    title,
    subtitle,
    couponCode,
    buttonText,
    buttonLink,
    image,
    campaignId,
    startDate,
    endDate,
    isActive,
    popupDelay,
    showOnce,
    discountType,
    discountValue,
    minimumOrderValue,
  } = req.body;

  // Multiple offers can now be active simultaneously.
  // One for popup (newest), others for manual promo code entry.

  const offer = new OfferCampaign({
    title,
    subtitle,
    couponCode,
    buttonText,
    buttonLink,
    image,
    campaignId: campaignId || `camp_${Date.now()}`,
    startDate,
    endDate,
    isActive,
    popupDelay,
    showOnce: showOnce !== undefined ? Boolean(showOnce) : true,
    discountType: discountType || "percentage",
    discountValue: discountValue != null ? Number(discountValue) : 0,
    minimumOrderValue: minimumOrderValue != null && minimumOrderValue !== "" ? Number(minimumOrderValue) : null,
  });

  const createdOffer = await offer.save();
  res.status(201).json({ success: true, data: createdOffer });
});

// @desc    Update offer campaign
// @route   PUT /api/offers/:id
// @access  Private/Admin
const updateOffer = asyncHandler(async (req, res) => {
  const existing = await OfferCampaign.findById(req.params.id);

  if (!existing) {
    res.status(404);
    throw new Error("Offer campaign not found");
  }

  const {
    isActive,
    discountValue,
    minimumOrderValue,
    discountType,
    ...rest
  } = req.body;

  // Build a clean $set payload — only include fields that were actually sent
  const setPayload = {};

  // Scalar string / date fields — include only if present in body
  const stringFields = ["title", "subtitle", "couponCode", "buttonText", "buttonLink", "image", "campaignId", "startDate", "endDate"];
  stringFields.forEach((field) => {
    if (req.body[field] !== undefined) setPayload[field] = req.body[field];
  });

  if (req.body.popupDelay !== undefined) setPayload.popupDelay = Number(req.body.popupDelay) || 3000;

  // Discount type (enum) — validate before setting
  if (discountType !== undefined) {
    if (!["percentage", "flat"].includes(discountType)) {
      res.status(400);
      throw new Error(`Invalid discountType: "${discountType}". Must be "percentage" or "flat".`);
    }
    setPayload.discountType = discountType;
  }

  // Discount value — must be a non-negative number
  if (discountValue !== undefined) {
    const parsed = Number(discountValue);
    if (isNaN(parsed) || parsed < 0) {
      res.status(400);
      throw new Error("discountValue must be a non-negative number");
    }
    setPayload.discountValue = parsed;
  }

  // minimumOrderValue: null / "" / 0 = no minimum  |  positive number = enforced minimum
  if (minimumOrderValue !== undefined) {
    if (minimumOrderValue === null || minimumOrderValue === "" || Number(minimumOrderValue) === 0) {
      setPayload.minimumOrderValue = null;
    } else {
      const parsed = Number(minimumOrderValue);
      if (isNaN(parsed) || parsed < 0) {
        res.status(400);
        throw new Error("minimumOrderValue must be a positive number or empty");
      }
      setPayload.minimumOrderValue = parsed;
    }
  }

  if (req.body.showOnce !== undefined) {
    setPayload.showOnce = Boolean(req.body.showOnce);
  }

  // isActive — multiple offers can now be active
  if (isActive !== undefined) {
    setPayload.isActive = Boolean(isActive);
  }

  const updatedOffer = await OfferCampaign.findByIdAndUpdate(
    req.params.id,
    { $set: setPayload },
    { new: true, runValidators: true }
  );

  res.json({ success: true, data: updatedOffer });
});


// @desc    Delete offer campaign
// @route   DELETE /api/offers/:id
// @access  Private/Admin
const deleteOffer = asyncHandler(async (req, res) => {
  const offer = await OfferCampaign.findById(req.params.id);

  if (!offer) {
    res.status(404);
    throw new Error("Offer campaign not found");
  }

  await OfferCampaign.deleteOne({ _id: req.params.id });
  res.json({ success: true, message: "Offer campaign removed" });
});

// @desc    Validate a promo code (public)
// @route   GET /api/offers/validate/:code
// @access  Public
const validateOffer = asyncHandler(async (req, res) => {
  const { code } = req.params;

  if (!code) {
    return res.status(200).json({ success: false, message: "Please enter a promo code" });
  }

  // Find ANY active offer with matching couponCode (case-insensitive)
  const offer = await OfferCampaign.findOne({
    couponCode: { $regex: new RegExp(`^${code.trim()}$`, "i") },
    isActive:   true,
  });

  if (!offer) {
    return res.status(200).json({ success: false, message: `Promo code "${code}" is invalid or inactive` });
  }

  // Expiration check
  if (offer.endDate && new Date(offer.endDate) < new Date()) {
    offer.isActive = false;
    await offer.save();
    return res.status(200).json({ success: false, message: "This promo code has expired" });
  }

  res.json({ success: true, data: offer });
});

module.exports = { getActiveOffer, getOffers, createOffer, updateOffer, deleteOffer, validateOffer };
