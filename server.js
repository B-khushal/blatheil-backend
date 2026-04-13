// Load environment variables FIRST, before any other requires
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const cartRoutes = require("./routes/cartRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const contactRoutes = require("./routes/contactRoutes");
const shiprocketRoutes = require("./routes/shiprocketRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const adminWebsiteRoutes = require("./routes/adminWebsiteRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const offerRoutes = require("./routes/offerRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const bootstrapAdmin = require("./utils/bootstrapAdmin");
const { isEmailTransportConfigured } = require("./services/emailService");
const { isGoogleAuthConfigured } = require("./controllers/authController");

const app = express();

const fallbackFrontendOrigins = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:8000",
];

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const corsAllowedOrigins = allowedOrigins.length > 0 ? allowedOrigins : fallbackFrontendOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS: Origin not allowed"));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

app.use("/api", limiter);

app.get("/api/health", (req, res) => {
  res.json({ success: true, data: { status: "ok" } });
});

app.get("/api/health/readiness", (req, res) => {
  const emailTransportReady = isEmailTransportConfigured();
  const googleAuthReady = isGoogleAuthConfigured();
  const ready = emailTransportReady && googleAuthReady;

  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      status: ready ? "ready" : "degraded",
      checks: {
        emailTransportReady,
        googleAuthReady,
      },
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/shiprocket", shiprocketRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin/website-content", adminWebsiteRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/reviews", reviewRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await bootstrapAdmin();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
