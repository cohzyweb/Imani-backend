const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const dbModule = require("../db");
const getDb = () => dbModule.db;
const auth = require("../middleware/auth");
const { sendQuoteStatusEmail, sendNewQuoteAlert } = require("../emailService");

router.post("/", async (req, res) => {
  const body = req.body;
  const id = uuidv4();
  const trackingNumber = `IGL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  getDb().prepare(`
    INSERT INTO quotes (
      id, full_name, email, company, phone,
      shipment_type, service, pickup_location, delivery_location,
      weight, dimensions, cargo, additional_services,
      packing_responsibility, materials_needed, furniture_disassembly,
      fragile_items, floor_levels, elevator, parking,
      walking_distance, access_issues, on_site_supervisor, extra_help,
      appliance_help, box_count, bulky_items, timing, storage,
      status, tracking_number
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)
  `).run(
    id,
    body.fullName || body.full_name || "",
    body.email || "",
    body.company || "",
    body.phone || "",
    body.shipmentType || body.shipment_type || "",
    body.service || "",
    body.pickupLocation || body.pickup_location || "",
    body.deliveryLocation || body.delivery_location || "",
    body.weight || "",
    body.dimensions || "",
    body.cargo || "",
    JSON.stringify(body.additionalServices || []),
    body.packingResponsibility || "",
    body.materialsNeeded || "",
    body.furnitureDisassembly || "",
    body.fragileItems || "",
    body.floorLevels || "",
    body.elevator || "",
    body.parking || "",
    body.walkingDistance || "",
    body.accessIssues || "",
    body.onSiteSupervisor || "",
    body.extraHelp || "",
    body.applianceHelp || "",
    body.boxCount || "",
    body.bulkyItems || "",
    body.timing || "",
    body.storage || "",
    trackingNumber
  );

  const quote = getDb().prepare("SELECT * FROM quotes WHERE id = ?").get(id);
  sendNewQuoteAlert(quote).catch(e => console.error("Admin alert error:", e.message));
  res.status(201).json({ success: true, id, trackingNumber });
});

router.get("/", auth, (req, res) => {
  const quotes = getDb().prepare("SELECT * FROM quotes ORDER BY created_at DESC").all();
  res.json(quotes);
});

router.get("/track/:trackingNumber", (req, res) => {
  const quote = getDb().prepare("SELECT * FROM quotes WHERE tracking_number = ?").get(req.params.trackingNumber);
  if (!quote) return res.status(404).json({ error: "Tracking number not found" });
  res.json({
    trackingNumber: quote.tracking_number,
    status: quote.status,
    pickupLocation: quote.pickup_location,
    deliveryLocation: quote.delivery_location,
    estimatedTime: quote.estimated_time,
    total: quote.total,
    shipmentType: quote.shipment_type
  });
});

router.get("/:id", (req, res) => {
  const quote = getDb().prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.id);
  if (!quote) return res.status(404).json({ error: "Quote not found" });
  res.json(quote);
});

router.patch("/:id", auth, async (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const existing = getDb().prepare("SELECT * FROM quotes WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Quote not found" });
  const previousStatus = existing.status;
  getDb().prepare(`
    UPDATE quotes SET
      base_price = COALESCE(?, base_price),
      vat = COALESCE(?, vat),
      total = COALESCE(?, total),
      status = COALESCE(?, status),
      estimated_time = COALESCE(?, estimated_time),
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    body.basePrice ?? body.base_price ?? null,
    body.vat ?? null,
    body.total ?? null,
    body.status ?? null,
    body.estimatedTime ?? body.estimated_time ?? null,
    body.notes ?? null,
    id
  );
  const updated = getDb().prepare("SELECT * FROM quotes WHERE id = ?").get(id);
  if (body.status && body.status !== previousStatus) {
    sendQuoteStatusEmail(updated).catch(e => console.error("Quote email error:", e.message));
  }
  res.json(updated);
});

router.delete("/:id", auth, (req, res) => {
  const result = getDb().prepare("DELETE FROM quotes WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Quote not found" });
  res.json({ success: true });
});

module.exports = router;