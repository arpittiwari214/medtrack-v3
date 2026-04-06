// backend/server.js
"use strict";

// ── Load .env FIRST ───────────────────────────────────────────
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express  = require("express");
const cors     = require("cors");
const connectDB = require("./config/db");

const app  = express();
const PORT = parseInt(process.env.PORT || "5000", 10);

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods:     ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ───────────────────────────────────────────────────
app.use("/api/auth",      require("./routes/auth"));
app.use("/api/medicines", require("./routes/medicines"));
app.use("/api/logs",      require("./routes/logs"));
app.use("/api/alerts",    require("./routes/alerts"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), env: process.env.NODE_ENV });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

// Global error handler — MUST have 4 params
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error("Unhandled error:", err.stack || err.message);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────
async function start() {
  // Validate required env vars
  const required = ["MONGODB_URI", "JWT_SECRET"];
  const missing  = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`❌ Missing env vars: ${missing.join(", ")}`);
    console.error("   Copy .env.example to .env and fill in the values");
    process.exit(1);
  }

  await connectDB();

  // Email (optional — app works without it)
  const { verifyConnection } = require("./services/emailService");
  await verifyConnection();

  // Scheduler
  const { startScheduler } = require("./services/scheduler");
  startScheduler();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 MedTrack API  →  http://localhost:${PORT}/api/health`);
    console.log(`🌐 Accepting requests from: ${process.env.FRONTEND_URL || "http://localhost:5173"}\n`);
  });
}

start().catch(err => {
  console.error("❌ Fatal startup error:", err.message);
  process.exit(1);
});
