// backend/routes/alerts.js
"use strict";
const express        = require("express");
const CaregiverAlert = require("../models/CaregiverAlert");
const { protect }    = require("../middleware/auth");
const emailService   = require("../services/emailService");

const router = express.Router();
router.use(protect);

// GET /api/alerts
router.get("/", async (req, res) => {
  try {
    const alerts = await CaregiverAlert.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch alerts", error: err.message });
  }
});

// PATCH /api/alerts/:id/resolve
router.patch("/:id/resolve", async (req, res) => {
  try {
    const alert = await CaregiverAlert.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { resolved: true },
      { new: true }
    );
    if (!alert) return res.status(404).json({ message: "Alert not found" });
    res.json({ alert });
  } catch (err) {
    res.status(500).json({ message: "Failed to resolve alert", error: err.message });
  }
});

// POST /api/alerts/sos
router.post("/sos", async (req, res) => {
  try {
    const user = req.user;
    if (!user.caregiver?.email) {
      return res.status(400).json({ message: "No caregiver email set. Add a caregiver first." });
    }

    const timestamp = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "medium",
    });

    let emailSent = false;
    try {
      await emailService.sendSOSAlert({ caregiver: user.caregiver, patientName: user.name, timestamp });
      emailSent = true;
    } catch (emailErr) {
      console.warn("SOS email failed:", emailErr.message);
    }

    const alert = await CaregiverAlert.create({
      userId:    user._id,
      type:      "sos",
      message:   `SOS emergency alert triggered by ${user.name} at ${timestamp}`,
      emailSent,
    });

    res.json({ message: "SOS alert sent", alert, emailSent });
  } catch (err) {
    res.status(500).json({ message: "Failed to send SOS alert", error: err.message });
  }
});

module.exports = router;
