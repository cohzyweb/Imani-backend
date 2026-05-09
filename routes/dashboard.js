const express = require("express");
const router = express.Router();
const dbModule = require("../db");
const getDb = () => dbModule.db;
const auth = require("../middleware/auth");
const { generateInvoicePDF } = require("../emailService");

router.get("/stats", auth, (req, res) => {
  const totalShipments = getDb().prepare("SELECT COUNT(*) as count FROM shipments").get().count;
  const pendingQuotes = getDb().prepare("SELECT COUNT(*) as count FROM quotes WHERE status = 'pending'").get().count;
  const activeCustomers = getDb().prepare("SELECT COUNT(*) as count FROM customers").get().count;
  const revenueRow = getDb().prepare("SELECT COALESCE(SUM(total), 0) as total FROM quotes WHERE status = 'approved'").get();
  const monthlyRevenue = revenueRow ? revenueRow.total : 0;
  const recentQuotes = getDb().prepare("SELECT * FROM quotes ORDER BY created_at DESC LIMIT 5").all();
  res.json({ totalShipments, pendingQuotes, activeCustomers, monthlyRevenue, recentQuotes });
});

router.get("/invoice/:quoteId", auth, async (req, res) => {
  const quote = getDb().prepare("SELECT * FROM quotes WHERE id = ?").get(req.params.quoteId);
  if (!quote) return res.status(404).json({ error: "Quote not found" });
  try {
    const pdfBuffer = await generateInvoicePDF(quote);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Imani-Invoice-${quote.id}.pdf"`,
      "Content-Length": pdfBuffer.length
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Invoice generation error:", err);
    res.status(500).json({ error: "Could not generate invoice" });
  }
});

module.exports = router;