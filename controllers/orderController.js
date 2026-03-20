const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const { generateWhatsAppMessage, generateWhatsAppLink } = require("../utils/whatsapp");
const { CONTACT_WHATSAPP_NUMBER } = require("../config/contact");

const createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, phone } = req.body;

  if (!Array.isArray(items) || items.length === 0 || !shippingAddress || !phone) {
    return res.status(400).json({
      success: false,
      message: "items, shippingAddress and phone are required",
    });
  }

  let totalPrice = 0;
  const products = [];

  for (const item of items) {
    if (!mongoose.Types.ObjectId.isValid(item.productId) || !item.quantity || !item.size) {
      return res.status(400).json({
        success: false,
        message: "Each item must include valid productId, quantity and size",
      });
    }

    const product = await Product.findById(item.productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product not found: ${item.productId}`,
      });
    }

    if (item.quantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${product.name}`,
      });
    }

    products.push(product);
    totalPrice += product.price * item.quantity;
  }

  for (const item of items) {
    const product = await Product.findById(item.productId);
    product.stock -= item.quantity;
    await product.save();
  }

  const order = await Order.create({
    userId: req.user._id,
    items,
    totalPrice,
    shippingAddress,
    phone,
  });

  await order.populate("items.productId", "name price");

  // Generate WhatsApp message and link
  const waMessage = generateWhatsAppMessage(order, products);
  const waLink = generateWhatsAppLink(CONTACT_WHATSAPP_NUMBER, waMessage);

  // Clear user's cart after order
  await Cart.updateOne({ userId: req.user._id }, { items: [] });

  return res.status(201).json({
    success: true,
    data: {
      order,
      whatsappLink: waLink,
      whatsappMessage: waMessage,
    },
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
