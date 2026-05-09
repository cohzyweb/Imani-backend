// server.js - Main Express Server for Imani Logistics
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { init } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend")));

// Health check (works before DB init)
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

// Boot: init DB then mount routes
init().then(() => {
  app.use("/api/auth",      require("./routes/auth"));
  app.use("/api/quotes",    require("./routes/quotes"));
  app.use("/api/shipments", require("./routes/shipments"));
  app.use("/api/customers", require("./routes/customers"));
  app.use("/api/tickets",   require("./routes/tickets"));
  app.use("/api/settings",  require("./routes/settings"));
  app.use("/api/dashboard", require("./routes/dashboard"));

  // SPA fallback
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) {
      res.sendFile(path.join(__dirname, "../frontend/index.html"));
    } else {
      res.status(404).json({ error: "Route not found" });
    }
  });

  app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════════╗
  ║      Imani Logistics - Express Server    ║
  ║      http://localhost:${PORT}               ║
  ╚══════════════════════════════════════════╝`);
    console.log("📧 Email:", process.env.GMAIL_USER
      ? `Configured (${process.env.GMAIL_USER}) ✓`
      : "⚠️  Not configured — set GMAIL_USER + GMAIL_PASS in .env");
  });
}).catch(err => {
  console.error("❌ Failed to initialise database:", err);
  process.exit(1);
});

module.exports = app;
