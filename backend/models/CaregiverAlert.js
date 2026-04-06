// backend/models/CaregiverAlert.js
"use strict";
const mongoose = require("mongoose");

const caregiverAlertSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      "User",
    required: true,
    index:    true,
  },
  medicineId: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     "Medicine",
    default: null,
  },
  medicineName: { type: String, default: "" },
  type: {
    type:     String,
    enum:     ["missed_dose", "sos", "consecutive_miss"],
    required: true,
  },
  message:   { type: String, required: true },
  emailSent: { type: Boolean, default: false },
  resolved:  { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("CaregiverAlert", caregiverAlertSchema);
