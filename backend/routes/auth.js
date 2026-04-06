// backend/routes/auth.js
"use strict";
const express       = require("express");
const jwt           = require("jsonwebtoken");
const User          = require("../models/User");
const { protect }   = require("../middleware/auth");

const router = express.Router();

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, age } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const user  = await User.create({
      name:     name.trim(),
      email:    email.toLowerCase().trim(),
      password,
      age:      age ? parseInt(age) : null,
    });

    const token = signToken(user._id);
    res.status(201).json({ token, user });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Signup failed", error: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user._id);
    res.json({ token, user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed", error: err.message });
  }
});

// GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ message: "Failed to get profile", error: err.message });
  }
});

// PATCH /api/auth/caregiver
router.patch("/caregiver", protect, async (req, res) => {
  try {
    const { name, email, relation } = req.body;
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ message: "Caregiver name and email are required" });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { caregiver: { name: name.trim(), email: email.toLowerCase().trim(), relation: relation?.trim() || "Family" } },
      { new: true }
    );
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Failed to update caregiver", error: err.message });
  }
});

// PATCH /api/auth/profile
router.patch("/profile", protect, async (req, res) => {
  try {
    const { name, age } = req.body;
    const update = {};
    if (name?.trim()) update.name = name.trim();
    if (age)          update.age  = parseInt(age);
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Profile update failed", error: err.message });
  }
});

module.exports = router;
