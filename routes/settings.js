const express = require("express");
const router = express.Router();
const dbModule = require("../db");
const getDb = () => dbModule.db;
const auth = require("../middleware/auth");

router.get("/", auth, (req, res) => {
  const rows = getDb().prepare("SELECT key, value FROM settings").all();
  const settings = {};
  rows.forEach(({ key, value }) => {
    if (value === "true") settings[key] = true;
    else if (value === "false") settings[key] = false;
    else settings[key] = value;
  });
  res.json(settings);
});

router.patch("/", auth, (req, res) => {
  const updates = req.body;
  const upsert = getDb().prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  for (const [key, value] of Object.entries(updates)) {
    upsert.run(key, String(value));
  }
  const rows = getDb().prepare("SELECT key, value FROM settings").all();
  const settings = {};
  rows.forEach(({ key, value }) => {
    if (value === "true") settings[key] = true;
    else if (value === "false") settings[key] = false;
    else settings[key] = value;
  });
  res.json(settings);
});

module.exports = router;