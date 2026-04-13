const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const isGoogleAuthConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID);

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const setAuthCookie = (res, token) => {
  res.cookie("auth_token", token, cookieOptions);
};

const issueAuthResponse = (res, user) => {
  const token = generateToken(user._id, user.role);
  setAuthCookie(res, token);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      provider: user.provider,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
    },
    token,
  };
};

const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "name, email and password are required",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "User already exists",
    });
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    role: "user",
    provider: "local",
    isVerified: true,
  });

  return res.status(201).json({
    success: true,
    data: issueAuthResponse(res, user),
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "email and password are required",
    });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  if (user.provider === "google" && !user.password) {
    return res.status(400).json({
      success: false,
      message: "This account uses Google Sign-In. Please continue with Google.",
    });
  }

  if (!(await user.matchPassword(password))) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }

  return res.json({
    success: true,
    data: issueAuthResponse(res, user),
  });
});

const getCsrfToken = asyncHandler(async (req, res) => {
  const csrfToken = crypto.randomBytes(32).toString("hex");
  res.cookie("csrf_token", csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 1000,
  });

  res.json({
    success: true,
    data: { csrfToken },
  });
});

const googleAuth = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  const csrfHeader = req.headers["x-csrf-token"];
  const csrfCookie = req.cookies?.csrf_token;

  if (!credential) {
    return res.status(400).json({
      success: false,
      message: "Google credential is required",
    });
  }

  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    return res.status(403).json({
      success: false,
      message: "CSRF validation failed",
    });
  }

  if (!isGoogleAuthConfigured()) {
    return res.status(500).json({
      success: false,
      message: "Google auth is not configured",
    });
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  const email = payload?.email?.toLowerCase().trim();
  const emailVerified = Boolean(payload?.email_verified);

  if (!email || !emailVerified) {
    return res.status(400).json({
      success: false,
      message: "Google account email is not verified",
    });
  }

  let user = await User.findOne({ email });

  if (user) {
    if (!user.googleId) {
      user.googleId = payload.sub;
    }

    user.name = user.name || payload.name || "Blatheil User";
    user.profileImage = payload.picture || user.profileImage;
    user.provider = "google";
    user.isVerified = true;
    await user.save();
  } else {
    user = await User.create({
      name: payload.name || "Blatheil User",
      email,
      googleId: payload.sub,
      profileImage: payload.picture,
      provider: "google",
      isVerified: true,
      role: "user",
      mustChangePassword: false,
    });
  }

  return res.json({
    success: true,
    data: issueAuthResponse(res, user),
  });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie("auth_token", cookieOptions);
  res.json({ success: true, data: { message: "Logged out" } });
});

const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "oldPassword and newPassword are required",
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 6 characters",
    });
  }

  const user = await User.findById(req.user._id);

  if (!user || !(await user.matchPassword(oldPassword))) {
    return res.status(401).json({
      success: false,
      message: "Old password is incorrect",
    });
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();

  return res.json({
    success: true,
    data: {
      message: "Password changed successfully",
    },
  });
});

module.exports = {
  signup,
  login,
  changePassword,
  googleAuth,
  getCsrfToken,
  logout,
  isGoogleAuthConfigured,
};
