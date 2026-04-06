// backend/routes/medicines.js
"use strict";
const express         = require("express");
const Medicine        = require("../models/Medicine");
const DoseLog         = require("../models/DoseLog");
const { protect }     = require("../middleware/auth");
const { generateDailyLogs } = require("../services/scheduler");

const router  = express.Router();
const getToday = () => new Date().toISOString().split("T")[0];

router.use(protect);

// GET /api/medicines
router.get("/", async (req, res) => {
  try {
    const medicines = await Medicine.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ medicines });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch medicines", error: err.message });
  }
});

// POST /api/medicines
router.post("/", async (req, res) => {
  try {
    const { name, dosage, frequency, times, startDate, endDate, instructions, isCritical } = req.body;

    if (!name?.trim() || !dosage?.trim() || !frequency || !times?.length) {
      return res.status(400).json({ message: "Name, dosage, frequency and times are required" });
    }

    // Duplicate check — same name + same sorted times for this user
    const sortedNew = [...times].sort().join(",");
    const existing  = await Medicine.find({ userId: req.user._id, name: name.trim(), active: true });
    const isDup     = existing.some(m => [...m.times].sort().join(",") === sortedNew);
    if (isDup) {
      return res.status(409).json({ message: `"${name}" with the same schedule already exists` });
    }

    const medicine = await Medicine.create({
      userId:       req.user._id,
      name:         name.trim(),
      dosage:       dosage.trim(),
      frequency,
      times,
      startDate:    startDate || getToday(),
      endDate:      endDate || null,
      instructions: instructions?.trim() || "",
      isCritical:   isCritical || false,
    });

    await generateDailyLogs(getToday());
    res.status(201).json({ medicine });
  } catch (err) {
    res.status(500).json({ message: "Failed to add medicine", error: err.message });
  }
});

// PATCH /api/medicines/:id
router.patch("/:id", async (req, res) => {
  try {
    const medicine = await Medicine.findOne({ _id: req.params.id, userId: req.user._id });
    if (!medicine) return res.status(404).json({ message: "Medicine not found" });

    const { name, dosage, frequency, times, startDate, endDate, instructions, isCritical } = req.body;

    // Duplicate check (excluding this medicine)
    if (name || times) {
      const newName  = (name || medicine.name).trim();
      const newTimes = [...(times || medicine.times)].sort().join(",");
      const others   = await Medicine.find({ userId: req.user._id, active: true, _id: { $ne: medicine._id } });
      const isDup    = others.some(m =>
        m.name.trim().toLowerCase() === newName.toLowerCase() &&
        [...m.times].sort().join(",") === newTimes
      );
      if (isDup) return res.status(409).json({ message: `"${newName}" with that schedule already exists` });
    }

    const update = {};
    if (name         !== undefined) update.name         = name.trim();
    if (dosage       !== undefined) update.dosage       = dosage.trim();
    if (frequency    !== undefined) update.frequency    = frequency;
    if (times        !== undefined) update.times        = times;
    if (startDate    !== undefined) update.startDate    = startDate;
    if (endDate      !== undefined) update.endDate      = endDate || null;
    if (instructions !== undefined) update.instructions = instructions.trim();
    if (isCritical   !== undefined) update.isCritical   = isCritical;

    const updated = await Medicine.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ medicine: updated });
  } catch (err) {
    res.status(500).json({ message: "Failed to update medicine", error: err.message });
  }
});

// DELETE /api/medicines/:id
router.delete("/:id", async (req, res) => {
  try {
    const medicine = await Medicine.findOne({ _id: req.params.id, userId: req.user._id });
    if (!medicine) return res.status(404).json({ message: "Medicine not found" });
    await DoseLog.deleteMany({ userId: req.user._id, medicineId: req.params.id });
    await Medicine.findByIdAndDelete(req.params.id);
    res.json({ message: "Medicine and all logs deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete medicine", error: err.message });
  }
});

// PATCH /api/medicines/:id/complete
router.patch("/:id/complete", async (req, res) => {
  try {
    const medicine = await Medicine.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { active: false },
      { new: true }
    );
    if (!medicine) return res.status(404).json({ message: "Medicine not found" });
    await DoseLog.deleteMany({ userId: req.user._id, medicineId: req.params.id, status: "pending" });
    res.json({ medicine });
  } catch (err) {
    res.status(500).json({ message: "Failed to complete medicine", error: err.message });
  }
});

module.exports = router;
