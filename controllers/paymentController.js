const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const { validateAndPriceItems, createOrderWithFulfillment } = require("../services/orderService");

const getRazorpayClient = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_SECRET) {
    throw new Error("Razorpay credentials are not configured");
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_SECRET,
  });
};

const createPaymentOrder = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "items are required",
    });
  }

  const { totalPrice } = await validateAndPriceItems(items);
  const amount = Math.round(totalPrice * 100);

  const razorpay = getRazorpayClient();
  const receipt = `blatheil_${req.user._id.toString().slice(-8)}_${Date.now()}`.slice(0, 40);

  const razorpayOrder = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt,
    payment_capture: 1,
    notes: {
      userId: req.user._id.toString(),
    },
  });

  return res.status(201).json({
    success: true,
    data: {
      order_id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    },
  });
});

const verifyPaymentAndCreateOrder = asyncHandler(async (req, res) => {
  if (!process.env.RAZORPAY_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Razorpay secret is not configured",
    });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    items,
    shippingAddress,
    phone,
    fullName,
    city,
    state,
    pincode,
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: "Missing Razorpay verification fields",
    });
  }

  if (!shippingAddress || !phone || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "items, shippingAddress and phone are required",
    });
  }

  const { totalPrice } = await validateAndPriceItems(items);
  const expectedAmount = Math.round(totalPrice * 100);

  const razorpay = getRazorpayClient();
  const fetchedOrder = await razorpay.orders.fetch(razorpay_order_id);

  if (!fetchedOrder || fetchedOrder.amount !== expectedAmount || fetchedOrder.currency !== "INR") {
    return res.status(400).json({
      success: false,
      message: "Payment amount mismatch",
    });
  }

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (generatedSignature !== razorpay_signature) {
    return res.status(400).json({
      success: false,
      message: "Payment verification failed",
    });
  }

  const existingOrder = await Order.findOne({ razorpay_payment_id }).populate("items.productId", "name price");

  if (existingOrder) {
    return res.status(200).json({
      success: true,
      data: {
        order: existingOrder,
      },
      message: "Payment already processed",
    });
  }

  const created = await createOrderWithFulfillment({
    userId: req.user._id,
    items,
    shippingAddress,
    phone,
    fullName,
    city,
    state,
    pincode,
    paymentMethod: "Razorpay",
    paymentStatus: "Paid",
    razorpay_order_id,
    razorpay_payment_id,
  });

  return res.status(201).json({
    success: true,
    data: created,
    message: "Payment verified and order created",
  });
});

module.exports = {
  createPaymentOrder,
  verifyPaymentAndCreateOrder,
};
