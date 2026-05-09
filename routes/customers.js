const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const dbModule = require("../db");
const getDb = () => dbModule.db;
const auth = require("../middleware/auth");

router.get("/", auth, (req, res) => {
  const customers = getDb().prepare("SELECT * FROM customers ORDER BY created_at DESC").all();
  res.json(customers);
});

router.post("/", auth, (req, res) => {
  const { name, email, phone, status } = req.body;
  if (!name || !email) return res.status(400).json({ error: "name and email are required" });
  const id = uuidv4();
  getDb().prepare("INSERT INTO customers (id, name, email, phone, status, shipments) VALUES (?, ?, ?, ?, ?, 0)").run(id, name, email, phone || "", status || "Active");
  res.status(201).json(getDb().prepare("SELECT * FROM customers WHERE id = ?").get(id));
});

router.patch("/:id", auth, (req, res) => {
  const { status } = req.body;
  const result = getDb().prepare("UPDATE customers SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Customer not found" });
  res.json(getDb().prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id));
});

router.delete("/:id", auth, (req, res) => {
  const result = getDb().prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Customer not found" });
  res.json({ success: true });
});

module.exports = router;