// backend/routes/logs.js
"use strict";
const express       = require("express");
const DoseLog       = require("../models/DoseLog");
const { protect }   = require("../middleware/auth");

const router = express.Router();
router.use(protect);

const nowHHMM = () => {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}`;
};

// GET /api/logs
router.get("/", async (req, res) => {
  try {
    const { date, from, to } = req.query;
    const filter = { userId: req.user._id };

    if (date) {
      filter.date = date;
    } else if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to)   filter.date.$lte = to;
    } else {
      const d = new Date();
      d.setDate(d.getDate() - 60);
      filter.date = { $gte: d.toISOString().split("T")[0] };
    }

    const logs = await DoseLog.find(filter).sort({ date: -1, scheduledTime: 1 });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch logs", error: err.message });
  }
});

// PATCH /api/logs/:id/taken
router.patch("/:id/taken", async (req, res) => {
  try {
    const log = await DoseLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: "taken", actualTime: nowHHMM() },
      { new: true }
    );
    if (!log) return res.status(404).json({ message: "Log not found" });
    res.json({ log });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark taken", error: err.message });
  }
});

// PATCH /api/logs/:id/snooze
router.patch("/:id/snooze", async (req, res) => {
  try {
    const { minutes } = req.body;
    if (!minutes || minutes < 1) return res.status(400).json({ message: "minutes required" });

    const d = new Date();
    d.setMinutes(d.getMinutes() + parseInt(minutes));
    const newTime = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;

    const log = await DoseLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: "snoozed", snoozedUntil: newTime, scheduledTime: newTime },
      { new: true }
    );
    if (!log) return res.status(404).json({ message: "Log not found" });
    res.json({ log });
  } catch (err) {
    res.status(500).json({ message: "Failed to snooze", error: err.message });
  }
});

// PATCH /api/logs/:id/undo
router.patch("/:id/undo", async (req, res) => {
  try {
    const log = await DoseLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: "pending", actualTime: null },
      { new: true }
    );
    if (!log) return res.status(404).json({ message: "Log not found" });
    res.json({ log });
  } catch (err) {
    res.status(500).json({ message: "Failed to undo", error: err.message });
  }
});

// PATCH /api/logs/:id/skip
router.patch("/:id/skip", async (req, res) => {
  try {
    const log = await DoseLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: "missed", skipped: true },
      { new: true }
    );
    if (!log) return res.status(404).json({ message: "Log not found" });
    res.json({ log });
  } catch (err) {
    res.status(500).json({ message: "Failed to skip", error: err.message });
  }
});

// DELETE /api/logs/:id
router.delete("/:id", async (req, res) => {
  try {
    const log = await DoseLog.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!log) return res.status(404).json({ message: "Log not found" });
    res.json({ message: "Log deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete log", error: err.message });
  }
});

module.exports = router;
