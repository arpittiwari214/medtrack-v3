// backend/models/User.js
"use strict";
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const caregiverSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, lowercase: true, trim: true },
  relation: { type: String, default: "Family" },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true, minlength: 6, select: true },
  age:       { type: Number, min: 1, max: 120, default: null },
  caregiver: { type: caregiverSchema, default: null },
}, { timestamps: true });

// ─── FIXED for Mongoose 8 ─────────────────────────────────────
// In Mongoose 8, async pre-hooks do NOT receive `next` as a param.
// Using `next` in an async pre-hook causes "next is not a function".
// Solution: remove `next`, use plain return/throw.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare plain password with hashed
userSchema.methods.matchPassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// Strip password from JSON responses
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
