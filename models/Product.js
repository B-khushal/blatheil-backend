const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    sizes: {
      type: [
        {
          type: String,
          enum: ["S", "M", "L", "XL", "XXL", "One Size"],
        },
      ],
      default: ["S", "M", "L", "XL"],
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    images: {
      type: [String],
      default: [],
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
      description: 'Average rating calculated from all visible reviews'
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
      description: 'Total count of visible approved reviews'
    },
    ratingDistribution: {
      type: {
        5: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        1: { type: Number, default: 0 }
      },
      default: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      description: 'Count of reviews for each rating level'
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isSoldOut: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.pre("save", function (next) {
  this.isSoldOut = this.stock <= 0;
  next();
});

productSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const stock = update.stock ?? (update.$set && update.$set.stock);

  if (typeof stock === "number") {
    if (!update.$set) {
      update.$set = {};
    }
    update.$set.isSoldOut = stock <= 0;
  }

  this.setUpdate(update);
  next();
});

module.exports = mongoose.model("Product", productSchema);
