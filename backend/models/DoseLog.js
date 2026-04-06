// backend/models/DoseLog.js
"use strict";
const mongoose = require("mongoose");

const doseLogSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "User",
    required: true,
    index:    true,
  },
  medicineId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "Medicine",
    required: true,
  },
  medicineName:  { type: String, required: true },
  dosage:        { type: String, default: "" },
  instructions:  { type: String, default: "" },
  isCritical:    { type: Boolean, default: false },
  scheduledTime: { type: String, required: true },  // "HH:MM"
  actualTime:    { type: String, default: null },
  date:          { type: String, required: true, index: true },  // "YYYY-MM-DD"
  status: {
    type:    String,
    enum:    ["pending", "taken", "missed", "snoozed"],
    default: "pending",
  },
  skipped:      { type: Boolean, default: false },
  snoozedUntil: { type: String, default: null },
}, { timestamps: true });

// Prevent duplicate log for same dose slot
doseLogSchema.index(
  { userId: 1, medicineId: 1, date: 1, scheduledTime: 1 },
  { unique: true }
);

module.exports = mongoose.model("DoseLog", doseLogSchema);
