// backend/services/emailService.js
"use strict";
const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST   || "smtp.gmail.com",
      port:   parseInt(process.env.EMAIL_PORT || "587", 10),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

const FROM = () =>
  `"${process.env.EMAIL_FROM_NAME || "MedTrack"}" <${process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER}>`;

// ── Missed dose alert ─────────────────────────────────────────
async function sendMissedDoseAlert({ caregiver, patientName, medicineName, scheduledTime, date }) {
  const subject = `⚠️ MedTrack: ${patientName} missed ${medicineName}`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #E2E8F0;border-radius:12px;">
      <h2 style="color:#1B2B4B;">Missed Dose Alert</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#64748B;border-bottom:1px solid #F1F5F9;">Patient</td><td style="padding:8px 0;font-weight:600;color:#1B2B4B;">${patientName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748B;border-bottom:1px solid #F1F5F9;">Medicine</td><td style="padding:8px 0;font-weight:600;color:#1B2B4B;">${medicineName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748B;">Scheduled</td><td style="padding:8px 0;font-weight:600;color:#DC2626;">${scheduledTime} on ${date}</td></tr>
      </table>
      <p style="margin-top:16px;color:#64748B;">Please check in with ${patientName} as soon as possible.</p>
    </div>`;
  await getTransporter().sendMail({ from: FROM(), to: caregiver.email, subject, html });
}

// ── Consecutive miss alert ────────────────────────────────────
async function sendConsecutiveMissAlert({ caregiver, patientName, medicineName, missCount }) {
  const subject = `🚨 MedTrack: ${patientName} missed ${medicineName} ${missCount} times in a row`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:2px solid #FECACA;border-radius:12px;background:#FEF2F2;">
      <h2 style="color:#991B1B;">Consecutive Miss Alert 🚨</h2>
      <p style="color:#7F1D1D;"><strong>${patientName}</strong> has missed <strong>${medicineName}</strong> <strong>${missCount} times in a row</strong>. Immediate attention may be required.</p>
    </div>`;
  await getTransporter().sendMail({ from: FROM(), to: caregiver.email, subject, html });
}

// ── SOS alert ─────────────────────────────────────────────────
async function sendSOSAlert({ caregiver, patientName, timestamp }) {
  const subject = `🆘 EMERGENCY: ${patientName} triggered SOS`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;border:3px solid #DC2626;border-radius:12px;background:#FEF2F2;">
      <h1 style="color:#DC2626;">🆘 EMERGENCY ALERT</h1>
      <p style="font-size:16px;color:#1B2B4B;"><strong>${patientName}</strong> has triggered an emergency SOS alert.</p>
      <p style="color:#64748B;">Time: ${timestamp}</p>
      <p style="color:#7F1D1D;font-weight:700;">Please respond immediately.</p>
    </div>`;
  await getTransporter().sendMail({ from: FROM(), to: caregiver.email, subject, html });
}

// ── Verify SMTP connection ────────────────────────────────────
async function verifyConnection() {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("⚠️  Email credentials not set — email alerts will be skipped");
      return false;
    }
    await getTransporter().verify();
    console.log("✅ Email service ready");
    return true;
  } catch (err) {
    console.warn("⚠️  Email service error:", err.message);
    return false;
  }
}

module.exports = { sendMissedDoseAlert, sendConsecutiveMissAlert, sendSOSAlert, verifyConnection };
