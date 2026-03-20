const { CONTACT_EMAIL } = require("../config/contact");

const generateWhatsAppMessage = (order, products) => {
  let message = "📦 *Order Confirmation*\n\n";
  message += `Order ID: ${order._id}\n`;
  message += `Date: ${new Date(order.createdAt).toLocaleDateString("en-IN")}\n\n`;

  message += "*Items:*\n";
  for (const item of order.items) {
    const product = products.find((p) => p._id.toString() === item.productId.toString());
    const itemTotal = product ? product.price * item.quantity : 0;
    message += `• ${product?.name || "Product"} (${item.size})\n`;
    message += `  Qty: ${item.quantity} × ₹${product?.price || 0} = ₹${itemTotal}\n`;
  }

  message += `\n*Total: ₹${order.totalPrice}*\n`;
  message += `\n*Delivery Address:*\n${order.shippingAddress}\n`;
  message += `Phone: ${order.phone}\n`;
  message += `Status: ${order.status}\n\n`;
  message += `Support Email: ${CONTACT_EMAIL}\n`;
  message += `Thank you for your order! 🎉`;

  return message;
};

const generateWhatsAppLink = (phoneNumber, message) => {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phoneNumber}?text=${encoded}`;
};

module.exports = { generateWhatsAppMessage, generateWhatsAppLink };
