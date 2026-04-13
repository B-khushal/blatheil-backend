const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

const authRoutes = require("../routes/authRoutes");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRoutes);
  return app;
};

test("POST /api/auth/google rejects when credential is missing", async () => {
  const app = buildApp();

  const response = await request(app).post("/api/auth/google").send({});

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /Missing required fields: credential/i);
});

test("POST /api/auth/google rejects on CSRF token mismatch", async () => {
  const app = buildApp();

  const response = await request(app)
    .post("/api/auth/google")
    .set("Cookie", ["csrf_token=cookie-token"])
    .set("X-CSRF-Token", "header-token")
    .send({ credential: "fake-google-id-token" });

  assert.equal(response.status, 403);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /CSRF validation failed/i);
});
