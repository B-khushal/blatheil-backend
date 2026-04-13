const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const User = require("../models/User");
const { createOrderWithFulfillment } = require("../services/orderService");
const { sendOrderCancelledEmail, sendOrderDeliveredEmail } = require("../services/emailService");

const getPrimaryFrontendUrl = () => {
  const configuredOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins[0] || "https://blatheil.com";
};

const queueDeliveredEmail = (payload, orderDoc) => {
  Promise.resolve()
    .then(() => sendOrderDeliveredEmail(payload))
    .then(() => {
      if (orderDoc) {
        orderDoc.deliveredEmailSentAt = new Date();
        return orderDoc.save();
      }
      return null;
    })
    .then(() => {
      console.log(`[Order] Delivered email sent for order ${orderDoc?._id}`);
    })
    .catch((error) => {
      console.error(`[Order] Delivered email failed for order ${orderDoc?._id}: ${error.message}`);
    });
};

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
  const { status, paymentStatus, cancellationReason, refundStatus, refundTimeline, resendDeliveredEmail } = req.body;

  if (!status && !paymentStatus) {
    return res.status(400).json({
      success: false,
      message: "status or paymentStatus is required",
    });
  }

  const order = await Order.findById(req.params.id).populate("items.productId", "name price");

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  const user = await User.findById(order.userId).select("name email");
  const previousStatus = order.status;

  if (paymentStatus) {
    order.paymentStatus = paymentStatus;
  }

  if (status) {
    order.status = status;
  }

  if (order.status === "delivered" && !order.deliveredAt) {
    order.deliveredAt = new Date();
  }

  if (order.status === "cancelled") {
    order.cancelledAt = order.cancelledAt || new Date();
    order.cancellationReason = cancellationReason || order.cancellationReason || "Cancelled by admin";
    order.refundStatus = refundStatus || order.refundStatus || "Initiated";
    order.refundTimeline = refundTimeline || order.refundTimeline || "5-7 business days";
    order.cancelledBy = req.user?._id || order.cancelledBy;
  }

  if (order.paymentStatus === "Failed" && order.status !== "cancelled") {
    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.cancellationReason = cancellationReason || "Cancelled due to payment failure";
    order.refundStatus = refundStatus || "Not Applicable";
    order.refundTimeline = refundTimeline || "Not Applicable";
    order.cancelledBy = req.user?._id || order.cancelledBy;
  }

  await order.save();

  if (user?.email && order.status === "cancelled" && previousStatus !== "cancelled") {
    await sendOrderCancelledEmail({
      to: user.email,
      customerName: user.name,
      order,
      cancellationReason: order.cancellationReason,
      refundStatus: order.refundStatus,
      refundTimeline: order.refundTimeline,
    });
  }

  const shouldSendDeliveredEmail =
    user?.email &&
    order.status === "delivered" &&
    (!order.deliveredEmailSentAt || previousStatus !== "delivered" || Boolean(resendDeliveredEmail));

  if (shouldSendDeliveredEmail) {
    queueDeliveredEmail({
      to: user.email,
      customerName: user.name,
      order,
      deliveredAt: order.deliveredAt ? order.deliveredAt.toLocaleString("en-IN") : undefined,
      reviewUrl: `${getPrimaryFrontendUrl()}/my-orders`,
      couponCode: process.env.DEFAULT_NEXT_PURCHASE_COUPON || "BLATHEIL10",
    }, order);
  }

  return res.json({
    success: true,
    data: order,
  });
});

const cancelOrder = asyncHandler(async (req, res) => {
  const { reason, refundStatus, refundTimeline } = req.body;
  const order = await Order.findById(req.params.id).populate("items.productId", "name price");

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  const isOwner = order.userId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";

  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: "Not authorized to cancel this order",
    });
  }

  if (order.status === "delivered") {
    return res.status(400).json({
      success: false,
      message: "Delivered orders cannot be cancelled",
    });
  }

  if (order.status === "cancelled") {
    return res.status(400).json({
      success: false,
      message: "Order is already cancelled",
    });
  }

  order.status = "cancelled";
  order.cancelledAt = new Date();
  order.cancellationReason = reason || (isAdmin ? "Cancelled by admin" : "Cancelled by customer");
  order.refundStatus = refundStatus || "Initiated";
  order.refundTimeline = refundTimeline || "5-7 business days";
  order.cancelledBy = req.user._id;

  await order.save();

  const user = await User.findById(order.userId).select("name email");
  if (user?.email) {
    await sendOrderCancelledEmail({
      to: user.email,
      customerName: user.name,
      order,
      cancellationReason: order.cancellationReason,
      refundStatus: order.refundStatus,
      refundTimeline: order.refundTimeline,
    });
  }

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
  cancelOrder,
};
