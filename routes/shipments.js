const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const dbModule = require("../db");
const getDb = () => dbModule.db;
const auth = require("../middleware/auth");
const { sendNewShipmentAlert } = require("../emailService");

function generateTrackingId() {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(100000 + Math.random() * 900000);
  return `IGL-UK-${y}${m}${d}-${random}`;
}

router.get("/", auth, (req, res) => {
  const shipments = getDb().prepare("SELECT * FROM shipments ORDER BY created_at DESC").all();
  res.json(shipments);
});

router.get("/:id", auth, (req, res) => {
  const s = getDb().prepare("SELECT * FROM shipments WHERE id = ?").get(req.params.id);
  if (!s) return res.status(404).json({ error: "Shipment not found" });
  res.json(s);
});

router.post("/", auth, async (req, res) => {
  const { customerName, route, shipmentType, estimatedDelivery } = req.body;
  if (!customerName || !route || !estimatedDelivery)
    return res.status(400).json({ error: "customerName, route, and estimatedDelivery are required" });
  const id = uuidv4();
  const trackingId = generateTrackingId();
  getDb().prepare(`
    INSERT INTO shipments (id, tracking_id, customer_name, route, shipment_type, estimated_delivery, status)
    VALUES (?, ?, ?, ?, ?, ?, 'In Transit')
  `).run(id, trackingId, customerName, route, shipmentType || "Standard", estimatedDelivery);
  const shipment = getDb().prepare("SELECT * FROM shipments WHERE id = ?").get(id);
  sendNewShipmentAlert(shipment).catch(e => console.error("Shipment alert error:", e.message));
  res.status(201).json(shipment);
});

router.patch("/:id", auth, (req, res) => {
  const { status } = req.body;
  const result = getDb().prepare("UPDATE shipments SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Shipment not found" });
  res.json(getDb().prepare("SELECT * FROM shipments WHERE id = ?").get(req.params.id));
});

router.delete("/:id", auth, (req, res) => {
  const result = getDb().prepare("DELETE FROM shipments WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Shipment not found" });
  res.json({ success: true });
});

module.exports = router;