const asyncHandler = require("express-async-handler");
const Order = require("../models/Order");
const User = require("../models/User");
const {
  createShiprocketOrder,
  assignCourier,
  generatePickup,
  trackShipment,
} = require("../services/shiprocketService");
const { sendOrderDeliveredEmail } = require("../services/emailService");

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
      console.log(`[Shiprocket] Delivered email sent for order ${orderDoc?._id}`);
    })
    .catch((error) => {
      console.error(`[Shiprocket] Delivered email failed for order ${orderDoc?._id}: ${error.message}`);
    });
};

const toShippingStatus = (value) => {
  const normalized = String(value || "").trim().toUpperCase();

  if (!normalized) return "Pending";
  if (normalized.includes("DELIVERED")) return "Delivered";
  if (normalized.includes("OUT") && normalized.includes("DELIVERY")) return "Out For Delivery";
  if (normalized.includes("TRANSIT")) return "In Transit";
  if (normalized.includes("SHIP")) return "Shipped";
  if (normalized.includes("PROCESS")) return "Processing";
  return "Pending";
};

const syncShipmentForOrder = async (order, options = {}) => {
  const { force = false } = options;

  if (!force && order.shipment_id && order.awb_code) {
    return order;
  }

  const hydratedOrder = await Order.findById(order._id).populate("items.productId", "name price");
  if (!hydratedOrder) {
    throw new Error("Order not found during Shiprocket sync");
  }

  if (!force && hydratedOrder.shipment_id && hydratedOrder.awb_code) {
    return hydratedOrder;
  }

  if (!hydratedOrder.shipment_id || force) {
    const user = await User.findById(hydratedOrder.userId).select("name email");

    const srOrder = await createShiprocketOrder({
      order: hydratedOrder,
      user,
    });

    if (srOrder.shiprocket_order_id) {
      hydratedOrder.shiprocket_order_id = srOrder.shiprocket_order_id;
    }

    if (srOrder.shipment_id) {
      hydratedOrder.shipment_id = srOrder.shipment_id;
    }

    hydratedOrder.shipping_status = srOrder.status || "Processing";
    hydratedOrder.status = "confirmed";
  }

  if (hydratedOrder.shipment_id) {
    const assignment = await assignCourier(hydratedOrder.shipment_id);

    if (assignment.awb_code) {
      hydratedOrder.awb_code = assignment.awb_code;
      hydratedOrder.tracking_url = `/track-order/${assignment.awb_code}`;
    }

    if (assignment.courier_name) {
      hydratedOrder.courier_name = assignment.courier_name;
    }

    try {
      await generatePickup(hydratedOrder.shipment_id);
    } catch (pickupError) {
      console.warn(
        `[Shiprocket] Pickup generation failed for order ${hydratedOrder._id}: ${pickupError.message}`
      );
    }

    if (hydratedOrder.awb_code) {
      hydratedOrder.shipping_status = "Shipped";
      hydratedOrder.status = "shipped";
    }
  }

  await hydratedOrder.save();
  return hydratedOrder;
};

const createShipment = asyncHandler(async (req, res) => {
  const { orderId, force } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "orderId is required",
    });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  const syncedOrder = await syncShipmentForOrder(order, { force: Boolean(force) });

  return res.json({
    success: true,
    data: syncedOrder,
    message: "Shipment sync completed",
  });
});

const handleWebhook = asyncHandler(async (req, res) => {
  const webhookSecret = process.env.SHIPROCKET_WEBHOOK_SECRET;
  if (webhookSecret) {
    const providedSecret =
      req.headers["x-shiprocket-webhook-token"] ||
      req.headers["x-webhook-token"] ||
      req.headers["x-webhook-secret"];

    if (providedSecret !== webhookSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized webhook",
      });
    }
  }

  const awbCode = req.body?.awb || req.body?.awb_code || req.body?.data?.awb;
  const shipmentId =
    req.body?.shipment_id ||
    req.body?.shipment?.shipment_id ||
    req.body?.data?.shipment_id;
  const incomingStatus =
    req.body?.current_status ||
    req.body?.shipment_status ||
    req.body?.status ||
    req.body?.data?.current_status;

  if (!awbCode && !shipmentId) {
    return res.status(400).json({
      success: false,
      message: "awb_code or shipment_id is required in webhook payload",
    });
  }

  const query = {
    $or: [
      awbCode ? { awb_code: String(awbCode) } : null,
      shipmentId ? { shipment_id: String(shipmentId) } : null,
    ].filter(Boolean),
  };

  const order = await Order.findOne(query);

  if (!order) {
    return res.status(200).json({
      success: true,
      message: "Webhook received but matching order not found",
    });
  }

  const previousStatus = order.status;
  const shippingStatus = toShippingStatus(incomingStatus);
  order.shipping_status = shippingStatus;

  if (awbCode) {
    order.awb_code = String(awbCode);
  }

  if (shipmentId) {
    order.shipment_id = String(shipmentId);
  }

  if (shippingStatus === "Delivered") {
    order.status = "delivered";
    order.deliveredAt = order.deliveredAt || new Date();
  } else if (
    shippingStatus === "Shipped" ||
    shippingStatus === "In Transit" ||
    shippingStatus === "Out For Delivery"
  ) {
    order.status = "shipped";
  } else if (shippingStatus === "Processing") {
    order.status = "confirmed";
  }

  await order.save();

  if (order.status === "delivered" && previousStatus !== "delivered") {
    const user = await User.findById(order.userId).select("name email");
    if (user?.email) {
      queueDeliveredEmail({
        to: user.email,
        customerName: user.name,
        order,
        deliveredAt: order.deliveredAt ? order.deliveredAt.toLocaleString("en-IN") : undefined,
        reviewUrl: `${getPrimaryFrontendUrl()}/my-orders`,
        couponCode: process.env.DEFAULT_NEXT_PURCHASE_COUPON || "BLATHEIL10",
      }, order);
    }
  }

  return res.status(200).json({
    success: true,
    message: "Webhook processed",
  });
});

const trackByAwb = asyncHandler(async (req, res) => {
  const { awb } = req.params;

  const tracking = await trackShipment(awb);

  const order = await Order.findOne({ awb_code: String(awb) });

  if (order) {
    const previousStatus = order.status;
    order.shipping_status = toShippingStatus(tracking.current_status);
    order.courier_name = tracking.courier_name || order.courier_name;
    order.tracking_url = tracking.tracking_url || order.tracking_url;

    if (order.shipping_status === "Delivered") {
      order.status = "delivered";
      order.deliveredAt = order.deliveredAt || new Date();
    }

    await order.save();

    if (order.status === "delivered" && previousStatus !== "delivered") {
      const user = await User.findById(order.userId).select("name email");
      if (user?.email) {
        queueDeliveredEmail({
          to: user.email,
          customerName: user.name,
          order,
          deliveredAt: order.deliveredAt ? order.deliveredAt.toLocaleString("en-IN") : undefined,
          reviewUrl: `${getPrimaryFrontendUrl()}/my-orders`,
          couponCode: process.env.DEFAULT_NEXT_PURCHASE_COUPON || "BLATHEIL10",
        }, order);
      }
    }
  }

  return res.json({
    success: true,
    data: {
      ...tracking,
      shipping_status: toShippingStatus(tracking.current_status),
    },
  });
});

module.exports = {
  createShipment,
  handleWebhook,
  trackByAwb,
  syncShipmentForOrder,
};
