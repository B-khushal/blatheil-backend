const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");

const PRODUCT_FIELDS = "name price category description sizes stock images isFeatured isSoldOut createdAt updatedAt";

const ensureWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ userId });

  if (!wishlist) {
    wishlist = await Wishlist.create({ userId, products: [] });
  }

  return wishlist;
};

const populateWishlist = async (wishlist) => {
  await wishlist.populate("products", PRODUCT_FIELDS);
  return wishlist;
};

const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await ensureWishlist(req.user._id);
  await populateWishlist(wishlist);

  return res.json({
    success: true,
    data: wishlist,
  });
});

const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      message: "A valid productId is required",
    });
  }

  const product = await Product.findById(productId).select("_id");

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  const wishlist = await ensureWishlist(req.user._id);
  const alreadyExists = wishlist.products.some(
    (id) => id.toString() === productId
  );

  if (!alreadyExists) {
    wishlist.products.push(product._id);
    await wishlist.save();
  }

  await populateWishlist(wishlist);

  return res.status(200).json({
    success: true,
    data: wishlist,
  });
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      message: "A valid productId is required",
    });
  }

  const wishlist = await ensureWishlist(req.user._id);
  const initialCount = wishlist.products.length;

  wishlist.products = wishlist.products.filter(
    (id) => id.toString() !== productId
  );

  if (wishlist.products.length !== initialCount) {
    await wishlist.save();
  }

  await populateWishlist(wishlist);

  return res.json({
    success: true,
    data: wishlist,
  });
});

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
