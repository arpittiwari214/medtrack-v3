// backend/models/Medicine.js
"use strict";
const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "User",
    required: true,
    index:    true,
  },
  name:         { type: String, required: true, trim: true },
  dosage:       { type: String, required: true, trim: true },
  frequency: {
    type: String,
    enum: ["once_daily", "twice_daily", "thrice_daily", "once_weekly", "custom"],
    required: true,
  },
  times:        { type: [String], required: true },  // ["08:00", "21:00"]
  startDate:    { type: String, required: true },    // "YYYY-MM-DD"
  endDate:      { type: String, default: null },
  instructions: { type: String, default: "", trim: true },
  active:       { type: Boolean, default: true },
  isCritical:   { type: Boolean, default: false },
}, { timestamps: true });

medicineSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model("Medicine", medicineSchema);
