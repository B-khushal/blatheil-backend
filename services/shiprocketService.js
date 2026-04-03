const SHIPROCKET_BASE_URL =
  process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external";

const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

const tokenCache = {
  token: null,
  expiresAt: 0,
};

const getTokenExpiryFromJwt = (token) => {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const payload = JSON.parse(Buffer.from(payloadPart, "base64").toString("utf8"));
    if (!payload.exp) return null;
    return payload.exp * 1000;
  } catch (error) {
    return null;
  }
};

const getShiprocketConfig = () => {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new Error("Shiprocket credentials are not configured");
  }

  return { email, password };
};

const safeJson = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text };
  }
};

const shiprocketRequest = async (
  endpoint,
  { method = "GET", body, auth = true, retryOnUnauthorized = true } = {}
) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const token = await loginToShiprocket();
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${SHIPROCKET_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await safeJson(response);

  if (
    response.status === 401 &&
    auth &&
    retryOnUnauthorized &&
    endpoint !== "/auth/login"
  ) {
    tokenCache.token = null;
    tokenCache.expiresAt = 0;
    return shiprocketRequest(endpoint, {
      method,
      body,
      auth,
      retryOnUnauthorized: false,
    });
  }

  if (!response.ok) {
    const shiprocketMessage =
      payload?.message ||
      payload?.error ||
      payload?.errors?.join(", ") ||
      `Shiprocket API failed with status ${response.status}`;

    throw new Error(shiprocketMessage);
  }

  return payload;
};

const loginToShiprocket = async (forceRefresh = false) => {
  const now = Date.now();

  if (
    !forceRefresh &&
    tokenCache.token &&
    tokenCache.expiresAt - TOKEN_REFRESH_BUFFER_MS > now
  ) {
    return tokenCache.token;
  }

  const { email, password } = getShiprocketConfig();

  const payload = await shiprocketRequest("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
    retryOnUnauthorized: false,
  });

  const token = payload?.token;
  if (!token) {
    throw new Error("Shiprocket token was not returned");
  }

  const tokenExpiry = getTokenExpiryFromJwt(token);
  tokenCache.token = token;
  tokenCache.expiresAt = tokenExpiry || Date.now() + 8 * 60 * 60 * 1000;

  return tokenCache.token;
};

const toTitleCase = (value) =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const parseShippingAddress = (shippingAddress = "") => {
  const parts = shippingAddress
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const pincodeMatch = shippingAddress.match(/\b\d{6}\b/);

  return {
    addressLine1: parts[0] || shippingAddress || "Address not provided",
    addressLine2: parts.slice(1, 3).join(", ") || "",
    city: parts[parts.length - 3] || process.env.SHIPROCKET_DEFAULT_CITY || "Mumbai",
    state: parts[parts.length - 2] || process.env.SHIPROCKET_DEFAULT_STATE || "Maharashtra",
    country: process.env.SHIPROCKET_DEFAULT_COUNTRY || "India",
    pincode: pincodeMatch?.[0] || process.env.SHIPROCKET_DEFAULT_PINCODE || "400001",
  };
};

const createShiprocketOrder = async (orderData) => {
  const { order, user } = orderData;

  const parsedAddress = parseShippingAddress(order.shippingAddress);
  const customerName = (user?.name || "Customer").trim();
  const [firstName, ...lastNameParts] = customerName.split(" ");

  const payload = {
    order_id: order._id.toString(),
    order_date: new Date(order.createdAt || Date.now()).toISOString().slice(0, 19).replace("T", " "),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
    channel_id: process.env.SHIPROCKET_CHANNEL_ID || "",
    comment: "Order from Blatheil",
    billing_customer_name: firstName || "Customer",
    billing_last_name: lastNameParts.join(" ") || "",
    billing_address: parsedAddress.addressLine1,
    billing_address_2: parsedAddress.addressLine2,
    billing_city: parsedAddress.city,
    billing_pincode: parsedAddress.pincode,
    billing_state: parsedAddress.state,
    billing_country: parsedAddress.country,
    billing_email: user?.email || process.env.SHIPROCKET_FALLBACK_EMAIL || "customer@blatheil.com",
    billing_phone: order.phone,
    shipping_is_billing: true,
    order_items: order.items.map((item) => ({
      name: item.productId?.name || "Product",
      sku: item.productId?._id?.toString() || item.productId?.toString() || "SKU",
      units: item.quantity,
      selling_price: Number(item.productId?.price || 0),
      discount: "",
      tax: "",
      hsn: "",
    })),
    payment_method: "Prepaid",
    shipping_charges: 0,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: 0,
    sub_total: Number(order.totalPrice || 0),
    length: Number(process.env.SHIPROCKET_PACKAGE_LENGTH || 20),
    breadth: Number(process.env.SHIPROCKET_PACKAGE_BREADTH || 20),
    height: Number(process.env.SHIPROCKET_PACKAGE_HEIGHT || 10),
    weight: Number(process.env.SHIPROCKET_PACKAGE_WEIGHT || 0.5),
  };

  const response = await shiprocketRequest("/orders/create/adhoc", {
    method: "POST",
    body: payload,
  });

  return {
    raw: response,
    shiprocket_order_id:
      response?.order_id?.toString() || response?.order?.toString() || null,
    shipment_id:
      response?.shipment_id?.toString() ||
      response?.shipment_details?.shipment_id?.toString() ||
      null,
    status: toTitleCase(response?.status || "Processing"),
  };
};

const assignCourier = async (shipment_id) => {
  const response = await shiprocketRequest("/courier/assign/awb", {
    method: "POST",
    body: {
      shipment_id,
      courier_id: process.env.SHIPROCKET_COURIER_ID || undefined,
      is_self_ship: 0,
    },
  });

  const awbCode =
    response?.response?.data?.awb_code ||
    response?.awb_code ||
    response?.response?.awb_code ||
    null;

  const courierName =
    response?.response?.data?.courier_name ||
    response?.courier_name ||
    response?.response?.data?.courier_company_id?.toString() ||
    null;

  return {
    raw: response,
    awb_code: awbCode ? String(awbCode) : null,
    courier_name: courierName,
  };
};

const generatePickup = async (shipment_id) => {
  return shiprocketRequest("/courier/generate/pickup", {
    method: "POST",
    body: {
      shipment_id: [Number(shipment_id)],
    },
  });
};

const trackShipment = async (awb_code) => {
  const response = await shiprocketRequest(`/courier/track/awb/${encodeURIComponent(awb_code)}`);

  const trackingData =
    response?.tracking_data ||
    response?.data ||
    response;

  return {
    raw: response,
    awb_code,
    courier_name:
      trackingData?.shipment_track?.[0]?.courier_name ||
      trackingData?.track_url_provider ||
      null,
    current_status:
      trackingData?.shipment_track?.[0]?.current_status ||
      trackingData?.shipment_status ||
      trackingData?.shipment_track_activities?.[0]?.activity ||
      "Pending",
    etd:
      trackingData?.etd ||
      trackingData?.shipment_track?.[0]?.edd ||
      null,
    tracking_url:
      trackingData?.track_url ||
      trackingData?.track_url_provider ||
      (process.env.SHIPROCKET_TRACKING_BASE_URL
        ? `${process.env.SHIPROCKET_TRACKING_BASE_URL}${encodeURIComponent(awb_code)}`
        : null),
    activities: trackingData?.shipment_track_activities || [],
  };
};

module.exports = {
  loginToShiprocket,
  createShiprocketOrder,
  assignCourier,
  generatePickup,
  trackShipment,
};
