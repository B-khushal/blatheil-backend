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
