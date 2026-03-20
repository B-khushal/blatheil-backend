const asyncHandler = require("express-async-handler");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

const getCart = asyncHandler(async (req, res) => {
  let cart = await Cart.findOne({ userId: req.user._id }).populate(
    "items.productId",
    "name price images stock"
  );

  if (!cart) {
    cart = await Cart.create({ userId: req.user._id, items: [] });
  }

  return res.json({
    success: true,
    data: cart,
  });
});

const addToCart = asyncHandler(async (req, res) => {
  const { productId, quantity, size } = req.body;

  if (!productId || !quantity || !size) {
    return res.status(400).json({
      success: false,
      message: "productId, quantity, and size are required",
    });
  }

  const product = await Product.findById(productId);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  if (product.isSoldOut) {
    return res.status(400).json({
      success: false,
      message: "Product is sold out",
    });
  }

  let cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    cart = await Cart.create({ userId: req.user._id, items: [] });
  }

  const existingItem = cart.items.find(
    (item) =>
      item.productId.toString() === productId && item.size === size
  );

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({ productId, quantity, size });
  }

  await cart.save();
  await cart.populate("items.productId", "name price images stock");

  return res.status(201).json({
    success: true,
    data: cart,
  });
});

const updateCartItem = asyncHandler(async (req, res) => {
  const { productId, quantity, size } = req.body;

  if (!productId || quantity === undefined || !size) {
    return res.status(400).json({
      success: false,
      message: "productId, quantity, and size are required",
    });
  }

  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return res.status(404).json({
      success: false,
      message: "Cart not found",
    });
  }

  const item = cart.items.find(
    (item) =>
      item.productId.toString() === productId && item.size === size
  );

  if (!item) {
    return res.status(404).json({
      success: false,
      message: "Item not in cart",
    });
  }

  if (quantity <= 0) {
    cart.items = cart.items.filter(
      (item) =>
        !(item.productId.toString() === productId && item.size === size)
    );
  } else {
    item.quantity = quantity;
  }

  await cart.save();
  await cart.populate("items.productId", "name price images stock");

  return res.json({
    success: true,
    data: cart,
  });
});

const removeFromCart = asyncHandler(async (req, res) => {
  const { productId, size } = req.body;

  if (!productId || !size) {
    return res.status(400).json({
      success: false,
      message: "productId and size are required",
    });
  }

  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return res.status(404).json({
      success: false,
      message: "Cart not found",
    });
  }

  cart.items = cart.items.filter(
    (item) =>
      !(item.productId.toString() === productId && item.size === size)
  );

  await cart.save();
  await cart.populate("items.productId", "name price images stock");

  return res.json({
    success: true,
    data: cart,
  });
});

const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user._id });

  if (!cart) {
    return res.status(404).json({
      success: false,
      message: "Cart not found",
    });
  }

  cart.items = [];
  await cart.save();

  return res.json({
    success: true,
    data: cart,
  });
});

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
};
