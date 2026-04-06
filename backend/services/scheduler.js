// backend/services/scheduler.js
"use strict";
const cron           = require("node-cron");
const Medicine       = require("../models/Medicine");
const DoseLog        = require("../models/DoseLog");
const CaregiverAlert = require("../models/CaregiverAlert");
const User           = require("../models/User");
const emailService   = require("./emailService");

const getToday = () => new Date().toISOString().split("T")[0];

// ── Generate dose logs for all active medicines ───────────────
async function generateDailyLogs(date) {
  try {
    const medicines = await Medicine.find({ active: true });
    let created = 0;

    for (const med of medicines) {
      if (med.startDate > date) continue;
      if (med.endDate && med.endDate < date) continue;

      if (med.frequency === "once_weekly") {
        const startDay = new Date(med.startDate).getDay();
        const today    = new Date(date).getDay();
        if (startDay !== today) continue;
      }

      for (const time of med.times) {
        try {
          const existing = await DoseLog.findOne({
            userId: med.userId, medicineId: med._id, date, scheduledTime: time,
          });
          if (!existing) {
            await DoseLog.create({
              userId: med.userId, medicineId: med._id,
              medicineName: med.name, dosage: med.dosage,
              instructions: med.instructions, isCritical: med.isCritical,
              scheduledTime: time, date, status: "pending", actualTime: null,
            });
            created++;
          }
        } catch (dupErr) { /* index already exists — skip */ }
      }
    }
    if (created > 0) console.log(`📅 [Scheduler] Generated ${created} logs for ${date}`);
  } catch (err) {
    console.error("❌ [Scheduler] Log generation error:", err.message);
  }
}

// ── Detect missed doses ───────────────────────────────────────
async function detectMissedDoses() {
  try {
    const today   = getToday();
    const now     = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const pendingLogs = await DoseLog.find({ date: today, status: "pending" });
    const overdue     = pendingLogs.filter(log => {
      const [h, m] = log.scheduledTime.split(":").map(Number);
      return nowMins - (h * 60 + m) >= 30;
    });

    for (const log of overdue) {
      await DoseLog.findByIdAndUpdate(log._id, { status: "missed" });

      const user = await User.findById(log.userId);
      if (!user?.caregiver?.email) continue;

      const recentLogs = await DoseLog.find({
        userId: log.userId, medicineId: log.medicineId,
        status: { $in: ["missed", "taken"] },
      }).sort({ date: -1, scheduledTime: -1 }).limit(5);

      let consecutiveMisses = 0;
      for (const l of recentLogs) {
        if (l.status === "missed") consecutiveMisses++;
        else break;
      }

      const threshold = log.isCritical ? 1 : 2;
      if (consecutiveMisses >= threshold) {
        const recentAlert = await CaregiverAlert.findOne({
          userId: log.userId, medicineId: log.medicineId,
          type: "consecutive_miss", resolved: false,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });
        if (!recentAlert) {
          try {
            await emailService.sendConsecutiveMissAlert({
              caregiver: user.caregiver, patientName: user.name,
              medicineName: log.medicineName, missCount: consecutiveMisses,
            });
            await CaregiverAlert.create({
              userId: log.userId, medicineId: log.medicineId,
              medicineName: log.medicineName, type: "consecutive_miss",
              message: `${user.name} missed ${log.medicineName} ${consecutiveMisses} times consecutively`,
              emailSent: true,
            });
          } catch (emailErr) {
            console.warn("⚠️  Email send failed:", emailErr.message);
            await CaregiverAlert.create({
              userId: log.userId, medicineId: log.medicineId,
              medicineName: log.medicineName, type: "consecutive_miss",
              message: `${user.name} missed ${log.medicineName} ${consecutiveMisses} times consecutively`,
              emailSent: false,
            });
          }
        }
      }
    }
    if (overdue.length > 0) console.log(`⏰ [Scheduler] Marked ${overdue.length} doses as missed`);
  } catch (err) {
    console.error("❌ [Scheduler] Miss detection error:", err.message);
  }
}

// ── Start all cron jobs ───────────────────────────────────────
function startScheduler() {
  generateDailyLogs(getToday());

  cron.schedule("0 0 * * *", () => {
    console.log("🌙 [Scheduler] Generating daily logs...");
    generateDailyLogs(getToday());
  });

  cron.schedule("*/5 * * * *", () => {
    detectMissedDoses();
  });

  console.log("⏱️  Background scheduler started");
}

module.exports = { startScheduler, generateDailyLogs, detectMissedDoses };
