const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const Order = require("../models/Order");
const User = require("../models/User");

const emailServicePath = require.resolve("../services/emailService");
const orderControllerPath = require.resolve("../controllers/orderController");

const emailService = require(emailServicePath);
const originalCancelledEmailFn = emailService.sendOrderCancelledEmail;
const originalDeliveredEmailFn = emailService.sendOrderDeliveredEmail;
const originalOrderFindById = Order.findById;
const originalUserFindById = User.findById;

const buildApp = (updateOrderStatus) => {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    req.user = { _id: "admin-user-id", role: "admin" };
    next();
  });

  app.put("/orders/:id/status", updateOrderStatus);

  app.use((error, req, res, next) => {
    res.status(500).json({ success: false, message: error.message });
  });

  return app;
};

const loadUpdateOrderStatusWithEmailMocks = (cancelledMock, deliveredMock) => {
  emailService.sendOrderCancelledEmail = cancelledMock;
  emailService.sendOrderDeliveredEmail = deliveredMock;

  delete require.cache[orderControllerPath];
  const { updateOrderStatus } = require(orderControllerPath);
  return updateOrderStatus;
};

test.afterEach(() => {
  emailService.sendOrderCancelledEmail = originalCancelledEmailFn;
  emailService.sendOrderDeliveredEmail = originalDeliveredEmailFn;
  Order.findById = originalOrderFindById;
  User.findById = originalUserFindById;
  delete require.cache[orderControllerPath];
});

test("PUT /orders/:id/status sends cancellation email on cancelled transition", async () => {
  let cancelledCalls = 0;
  let deliveredCalls = 0;

  const mockOrder = {
    _id: "order-1",
    userId: "user-1",
    status: "processing",
    paymentStatus: "Paid",
    items: [],
    save: async function save() {
      return this;
    },
  };

  Order.findById = () => ({
    populate: async () => mockOrder,
  });

  User.findById = () => ({
    select: async () => ({ name: "Test User", email: "test@example.com" }),
  });

  const updateOrderStatus = loadUpdateOrderStatusWithEmailMocks(
    async () => {
      cancelledCalls += 1;
      return { success: true };
    },
    async () => {
      deliveredCalls += 1;
      return { success: true };
    }
  );

  const app = buildApp(updateOrderStatus);

  const response = await request(app)
    .put("/orders/order-1/status")
    .send({ status: "cancelled", cancellationReason: "Customer request" });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(cancelledCalls, 1);
  assert.equal(deliveredCalls, 0);
});

test("PUT /orders/:id/status sends delivered email on delivered transition", async () => {
  let cancelledCalls = 0;
  let deliveredCalls = 0;

  const mockOrder = {
    _id: "order-2",
    userId: "user-2",
    status: "shipped",
    paymentStatus: "Paid",
    items: [],
    deliveredAt: null,
    save: async function save() {
      return this;
    },
  };

  Order.findById = () => ({
    populate: async () => mockOrder,
  });

  User.findById = () => ({
    select: async () => ({ name: "Test User", email: "test@example.com" }),
  });

  const updateOrderStatus = loadUpdateOrderStatusWithEmailMocks(
    async () => {
      cancelledCalls += 1;
      return { success: true };
    },
    async () => {
      deliveredCalls += 1;
      return { success: true };
    }
  );

  const app = buildApp(updateOrderStatus);

  const response = await request(app).put("/orders/order-2/status").send({ status: "delivered" });

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(cancelledCalls, 0);
  assert.equal(deliveredCalls, 1);
});
