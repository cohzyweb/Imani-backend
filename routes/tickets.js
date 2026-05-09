const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const dbModule = require("../db");
const getDb = () => dbModule.db;
const auth = require("../middleware/auth");

router.get("/", auth, (req, res) => {
  const tickets = getDb().prepare("SELECT * FROM tickets ORDER BY created_at DESC").all();
  res.json(tickets.map(t => ({ ...t, aiEscalation: t.ai_escalation === 1 })));
});

router.get("/:id", auth, (req, res) => {
  const ticket = getDb().prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json({ ...ticket, aiEscalation: ticket.ai_escalation === 1 });
});

router.post("/", auth, (req, res) => {
  const { customerName, subject, message, sentiment, priority, aiEscalation } = req.body;
  const id = uuidv4();
  const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
  getDb().prepare(`
    INSERT INTO tickets (id, ticket_id, customer_name, subject, message, sentiment, priority, status, ai_escalation)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Open', ?)
  `).run(id, ticketId, customerName || "", subject || "", message || "", sentiment || "Neutral", priority || "Medium", aiEscalation ? 1 : 0);
  res.status(201).json(getDb().prepare("SELECT * FROM tickets WHERE id = ?").get(id));
});

router.patch("/:id", auth, (req, res) => {
  const { status } = req.body;
  const result = getDb().prepare("UPDATE tickets SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Ticket not found" });
  res.json(getDb().prepare("SELECT * FROM tickets WHERE id = ?").get(req.params.id));
});

module.exports = router;