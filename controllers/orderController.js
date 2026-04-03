const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const { createOrderWithFulfillment } = require("../services/orderService");

const createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, phone, fullName, city, state, pincode, paymentMethod } = req.body;

  if (!Array.isArray(items) || items.length === 0 || !shippingAddress || !phone) {
    return res.status(400).json({
      success: false,
      message: "items, shippingAddress and phone are required",
    });
  }

  if (paymentMethod === "COD") {
    return res.status(400).json({
      success: false,
      message: "Cash on Delivery is no longer available.",
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
  });

  return res.status(201).json({
    success: true,
    data: created,
  });
});

const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: req.user._id })
    .populate("items.productId")
    .sort({ createdAt: -1 });

  return res.json({
    success: true,
    data: orders,
  });
});

const getAllOrders = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    Order.find({})
      .populate("userId", "name email")
      .populate("items.productId", "name price images")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments({}),
  ]);

  return res.json({
    success: true,
    data: orders,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({
      success: false,
      message: "status is required",
    });
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  order.status = status;
  await order.save();

  return res.json({
    success: true,
    data: order,
  });
});

module.exports = {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
};
