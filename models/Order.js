const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    size: {
      type: String,
      enum: ["S", "M", "L", "XL", "XXL", "One Size"],
      required: true,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "Order must contain at least one item",
      },
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      min: 0,
      default: null,
    },
    shippingAddress: {
      type: String,
      required: true,
      trim: true,
    },
    fullName: {
      type: String,
      trim: true,
      default: null,
    },
    city: {
      type: String,
      trim: true,
      default: null,
    },
    state: {
      type: String,
      trim: true,
      default: null,
    },
    pincode: {
      type: String,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "Razorpay"],
      default: "COD",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
      index: true,
    },
    razorpay_order_id: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    razorpay_payment_id: {
      type: String,
      trim: true,
      default: null,
    },
    shiprocket_order_id: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    shipment_id: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    awb_code: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    courier_name: {
      type: String,
      trim: true,
      default: null,
    },
    shipping_status: {
      type: String,
      trim: true,
      default: "Pending",
      index: true,
    },
    tracking_url: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ razorpay_payment_id: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Order", orderSchema);
