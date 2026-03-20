const asyncHandler = require("express-async-handler");
const Product = require("../models/Product");

const getProducts = asyncHandler(async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
      ];
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.isFeatured === "true" || req.query.isFeatured === "false") {
      query.isFeatured = req.query.isFeatured === "true";
    }

    if (req.query.isSoldOut === "true" || req.query.isSoldOut === "false") {
      query.isSoldOut = req.query.isSoldOut === "true";
    }

    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) {
        const minPrice = Number(req.query.minPrice);
        if (isNaN(minPrice)) {
          return res.status(400).json({
            success: false,
            message: "Invalid minPrice parameter",
          });
        }
        query.price.$gte = minPrice;
      }
      if (req.query.maxPrice) {
        const maxPrice = Number(req.query.maxPrice);
        if (isNaN(maxPrice)) {
          return res.status(400).json({
            success: false,
            message: "Invalid maxPrice parameter",
          });
        }
        query.price.$lte = maxPrice;
      }
    }

    const [products, total] = await Promise.all([
      Product.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Product.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get products error:", error.message);
    throw error;
  }
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  return res.json({
    success: true,
    data: product,
  });
});

const createProduct = asyncHandler(async (req, res) => {
  const { name, price, category, description, sizes, stock, images, isFeatured } =
    req.body;

  if (!name || price === undefined || !category || !description || stock === undefined) {
    return res.status(400).json({
      success: false,
      message: "name, price, category, description and stock are required",
    });
  }

  const product = await Product.create({
    name,
    price,
    category,
    description,
    sizes,
    stock,
    images,
    isFeatured,
  });

  return res.status(201).json({
    success: true,
    data: product,
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  return res.json({
    success: true,
    data: product,
  });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  return res.json({
    success: true,
    data: {
      message: "Product deleted successfully",
    },
  });
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
