const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const User = require("../models/User");
const { generateWhatsAppMessage, generateWhatsAppLink } = require("../utils/whatsapp");
const { CONTACT_WHATSAPP_NUMBER } = require("../config/contact");
const { syncShipmentForOrder } = require("../controllers/shiprocketController");
const { sendOrderConfirmationEmail } = require("./emailService");

const validateAndPriceItems = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order items are required");
  }

  let totalPrice = 0;
  const products = [];

  for (const item of items) {
    if (!mongoose.Types.ObjectId.isValid(item.productId) || !item.quantity || !item.size) {
      throw new Error("Each item must include valid productId, quantity and size");
    }

    const product = await Product.findById(item.productId);
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    if (item.quantity > product.stock) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    totalPrice += Number(product.price) * Number(item.quantity);
    products.push(product);
  }

  return { totalPrice, products };
};

const reserveStock = async (items) => {
  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) {
      throw new Error(`Product not found during stock reservation: ${item.productId}`);
    }

    if (item.quantity > product.stock) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    product.stock -= item.quantity;
    await product.save();
  }
};

const createOrderWithFulfillment = async ({
  userId,
  items,
  shippingAddress,
  phone,
  paymentMethod = "Razorpay",
  paymentStatus = "Pending",
  razorpay_order_id = null,
  razorpay_payment_id = null,
  fullName = "",
  city = "",
  state = "",
  pincode = "",
  clearUserCart = true,
}) => {
  const { totalPrice, products } = await validateAndPriceItems(items);

  await reserveStock(items);

  const order = await Order.create({
    userId,
    items,
    totalPrice,
    totalAmount: totalPrice,
    shippingAddress,
    phone,
    fullName,
    city,
    state,
    pincode,
    paymentMethod,
    paymentStatus,
    razorpay_order_id,
    razorpay_payment_id,
  });

  await order.populate("items.productId", "name price");

  let latestOrder = order;
  const isShiprocketConfigured =
    Boolean(process.env.SHIPROCKET_EMAIL) && Boolean(process.env.SHIPROCKET_PASSWORD);

  if (isShiprocketConfigured) {
    try {
      latestOrder = await syncShipmentForOrder(order);
      console.log(`[Shiprocket] Shipment synced for order ${latestOrder._id}`);
    } catch (shiprocketError) {
      console.error(
        `[Shiprocket] Failed to sync shipment for order ${order._id}: ${shiprocketError.message}`
      );
      order.shipping_status = "Pending";
      await order.save();
      latestOrder = order;
    }
  }

  const user = await User.findById(userId).select("name email");
  const waMessage = generateWhatsAppMessage(latestOrder, products);
  const waLink = generateWhatsAppLink(CONTACT_WHATSAPP_NUMBER, waMessage);

  if (user?.email) {
    await sendOrderConfirmationEmail({
      to: user.email,
      customerName: user.name,
      order: latestOrder,
      estimatedDelivery: process.env.DEFAULT_ESTIMATED_DELIVERY || "3-7 business days",
    });
  }

  if (clearUserCart) {
    await Cart.updateOne({ userId }, { items: [] });
  }

  return {
    order: latestOrder,
    totalPrice,
    whatsappLink: waLink,
    whatsappMessage: waMessage,
    customerName: user?.name || "Customer",
  };
};

module.exports = {
  validateAndPriceItems,
  createOrderWithFulfillment,
};
