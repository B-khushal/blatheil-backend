const asyncHandler = require("express-async-handler");
const User = require("../models/User");

const { CONTACT_EMAIL } = require("../config/contact");

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  return res.json({
    success: true,
    data: user,
  });
});
const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;

    const updatedUser = await user.save();

    res.json({
      success: true,
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

// @desc    Get all team members (admin, manager, sales_person)
// @route   GET /api/users/team
// @access  Private/Admin
const getTeamMembers = asyncHandler(async (req, res) => {
  const team = await User.find({
    role: { $in: ["admin", "manager", "sales_person"] },
  }).select("-password");

  res.json({
    success: true,
    data: team,
  });
});

// @desc    Create a team member
// @route   POST /api/users/team
// @access  Private/Admin
const createTeamMember = asyncHandler(async (req, res) => {
  const { name, email, role, password } = req.body;

  if (!name || !email || !role || !password) {
    res.status(400);
    throw new Error("Please provide name, email, role, and password");
  }

  const allowedRoles = ["admin", "manager", "sales_person"];
  if (!allowedRoles.includes(role)) {
    res.status(400);
    throw new Error("Invalid team role specified");
  }

  const normalizedEmail = email.toLowerCase().trim();
  const userExists = await User.findOne({ email: normalizedEmail });

  if (userExists) {
    res.status(409);
    throw new Error("User already exists with this email");
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    role,
    mustChangePassword: true,
    isVerified: true,
  });

  res.status(201).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

// @desc    Update a team member
// @route   PUT /api/users/team/:id
// @access  Private/Admin
const updateTeamMember = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Prevent modifying the primary admin email/role
  if (user.email === CONTACT_EMAIL && (req.body.email !== user.email || req.body.role !== "admin")) {
    res.status(400);
    throw new Error("Cannot change email or role of the primary admin");
  }

  // Prevent self-role modification (can't demote oneself)
  if (user._id.toString() === req.user._id.toString() && req.body.role && req.body.role !== user.role) {
    res.status(400);
    throw new Error("You cannot change your own role");
  }

  user.name = req.body.name || user.name;
  if (req.body.email) {
    user.email = req.body.email.toLowerCase().trim();
  }
  if (req.body.role) {
    const allowedRoles = ["admin", "manager", "sales_person"];
    if (!allowedRoles.includes(req.body.role)) {
      res.status(400);
      throw new Error("Invalid role specified");
    }
    user.role = req.body.role;
  }

  const updatedUser = await user.save();

  res.json({
    success: true,
    data: {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    },
  });
});

// @desc    Delete a team member
// @route   DELETE /api/users/team/:id
// @access  Private/Admin
const deleteTeamMember = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  // Prevent self deletion
  if (user._id.toString() === req.user._id.toString()) {
    res.status(400);
    throw new Error("You cannot delete your own account");
  }

  // Prevent deleting the primary admin
  if (user.email === CONTACT_EMAIL) {
    res.status(400);
    throw new Error("Primary admin account cannot be deleted");
  }

  await User.deleteOne({ _id: user._id });

  res.json({
    success: true,
    message: "Team member deleted successfully",
  });
});

module.exports = {
  getProfile,
  updateProfile,
  getTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
};
