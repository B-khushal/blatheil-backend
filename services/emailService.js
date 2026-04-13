const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const TEMPLATE_DIR = path.join(__dirname, "..", "templates");

const SUBJECTS = {
  confirmation: "Your Blatheil Order Has Been Confirmed 🎉",
  cancelled: "Your Blatheil Order Has Been Cancelled",
  delivered: "Your Blatheil Order Has Been Delivered Successfully ✅",
};

const getSupportDetails = () => ({
  email: process.env.CONTACT_EMAIL || "support@blatheil.com",
  phone: process.env.CONTACT_PHONE || "+91 00000 00000",
  whatsapp: process.env.CONTACT_WHATSAPP_NUMBER || "",
});

const buildTransporter = () => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user, pass },
  });
};

const transporter = buildTransporter();

const isEmailTransportConfigured = () => Boolean(transporter);

const verifyEmailTransporter = async () => {
  if (!transporter) {
    return false;
  }

  try {
    await transporter.verify();
    return true;
  } catch (error) {
    console.error(`[Email] Transporter verify failed: ${error.message}`);
    return false;
  }
};

const formatCurrency = (amount) => {
  const numericAmount = Number(amount || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(numericAmount);
};

const readTemplate = (fileName) => {
  const filePath = path.join(TEMPLATE_DIR, fileName);
  return fs.readFileSync(filePath, "utf8");
};

const inject = (template, payload) => {
  let content = template;

  Object.entries(payload).forEach(([key, value]) => {
    const safeValue = value === undefined || value === null ? "" : String(value);
    content = content.replace(new RegExp(`{{${key}}}`, "g"), safeValue);
  });

  return content;
};

const toItemsRows = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return `<tr><td colspan="4" style="padding:10px 12px;border-bottom:1px solid #e9ecef;">No items</td></tr>`;
  }

  return items
    .map((item) => {
      const name = item?.productId?.name || item?.name || "Product";
      const size = item?.size ? ` (${item.size})` : "";
      const quantity = Number(item?.quantity || 0);
      const unitPrice = Number(item?.productId?.price ?? item?.price ?? 0);
      const lineTotal = unitPrice * quantity;

      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;">${name}${size}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;">${quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;">${formatCurrency(unitPrice)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e9ecef;">${formatCurrency(lineTotal)}</td>
      </tr>`;
    })
    .join("");
};

const sendEmail = async ({ to, subject, html, contextLabel }) => {
  if (!transporter) {
    console.warn(`[Email] Skipped ${contextLabel}: transporter not configured`);
    return { skipped: true };
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
    });

    console.log(`[Email] ${contextLabel} sent to ${to}. messageId=${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[Email] Failed ${contextLabel} for ${to}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

const sendOrderConfirmationEmail = async ({ to, customerName, order, estimatedDelivery }) => {
  const support = getSupportDetails();
  const template = readTemplate("orderConfirmation.html");
  const html = inject(template, {
    customerName: customerName || "Customer",
    orderId: order._id,
    itemsRows: toItemsRows(order.items),
    totalAmount: formatCurrency(order.totalAmount || order.totalPrice || 0),
    shippingAddress: `${order.shippingAddress || ""}${order.city ? `, ${order.city}` : ""}${
      order.state ? `, ${order.state}` : ""
    }${order.pincode ? ` - ${order.pincode}` : ""}`,
    paymentStatus: order.paymentStatus || "Pending",
    estimatedDelivery: estimatedDelivery || "3-7 business days",
    supportEmail: support.email,
    supportPhone: support.phone,
    supportWhatsapp: support.whatsapp,
    currentYear: new Date().getFullYear(),
  });

  return sendEmail({
    to,
    subject: SUBJECTS.confirmation,
    html,
    contextLabel: `order-confirmation:${order._id}`,
  });
};

const sendOrderCancelledEmail = async ({
  to,
  customerName,
  order,
  cancellationReason,
  refundStatus,
  refundTimeline,
}) => {
  const support = getSupportDetails();
  const template = readTemplate("orderCancelled.html");
  const html = inject(template, {
    customerName: customerName || "Customer",
    orderId: order._id,
    itemsRows: toItemsRows(order.items),
    cancellationReason: cancellationReason || "Cancelled as requested",
    refundStatus: refundStatus || "Initiated",
    refundTimeline: refundTimeline || "5-7 business days",
    supportEmail: support.email,
    supportPhone: support.phone,
    supportWhatsapp: support.whatsapp,
    currentYear: new Date().getFullYear(),
  });

  return sendEmail({
    to,
    subject: SUBJECTS.cancelled,
    html,
    contextLabel: `order-cancelled:${order._id}`,
  });
};

const sendOrderDeliveredEmail = async ({
  to,
  customerName,
  order,
  deliveredAt,
  couponCode,
  reviewUrl,
}) => {
  const support = getSupportDetails();
  const template = readTemplate("orderDelivered.html");
  const html = inject(template, {
    customerName: customerName || "Customer",
    orderId: order._id,
    itemsRows: toItemsRows(order.items),
    deliveredAt: deliveredAt || new Date().toLocaleString("en-IN"),
    couponCode: couponCode || process.env.DEFAULT_NEXT_PURCHASE_COUPON || "BLATHEIL10",
    reviewUrl: reviewUrl || process.env.FRONTEND_URL || "https://blatheil.com",
    supportEmail: support.email,
    supportPhone: support.phone,
    supportWhatsapp: support.whatsapp,
    currentYear: new Date().getFullYear(),
  });

  return sendEmail({
    to,
    subject: SUBJECTS.delivered,
    html,
    contextLabel: `order-delivered:${order._id}`,
  });
};

module.exports = {
  sendOrderConfirmationEmail,
  sendOrderCancelledEmail,
  sendOrderDeliveredEmail,
  isEmailTransportConfigured,
  verifyEmailTransporter,
};