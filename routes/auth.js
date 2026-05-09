const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const dbModule = require("../db");
const getDb = () => dbModule.db;

router.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  try {
    const existing = getDb().prepare("SELECT id FROM admins WHERE email = ?").get(email);
    if (existing) return res.status(400).json({ error: "Email already in use" });
    const passwordHash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    getDb().prepare("INSERT INTO admins (id, email, password_hash) VALUES (?, ?, ?)").run(id, email, passwordHash);
    const token = jwt.sign({ id, email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, admin: { id, email } });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });
  try {
    const admin = getDb().prepare("SELECT * FROM admins WHERE email = ?").get(email);
    if (!admin) return res.status(401).json({ error: "Invalid email or password" });
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });
    const expiresIn = rememberMe ? "30d" : "1d";
    const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, { expiresIn });
    res.json({ token, admin: { id: admin.id, email: admin.email } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  try {
    const admin = getDb().prepare("SELECT id FROM admins WHERE email = ?").get(email);
    if (!admin) return res.json({ message: "If an account exists, a reset email will be sent." });
    const resetToken = jwt.sign({ id: admin.id, type: "password_reset" }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password.html?token=${resetToken}`;
    console.log(`🔑 Password reset link for ${email}: ${resetUrl}`);
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
      });
      await transporter.sendMail({
        from: `"${process.env.FROM_NAME || "Imani Logistics"}" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "Password Reset Request - Imani Logistics",
        html: `
          <p>Hello,</p>
          <p>We received a request to reset your admin password.</p>
          <p><a href="${resetUrl}" style="background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Reset Password</a></p>
          <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        `
      });
    } catch (emailErr) {
      console.error("Could not send password reset email:", emailErr.message);
    }
    res.json({ message: "If an account exists, a reset email will be sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/verify", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ valid: false });
  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    res.json({ valid: true, admin: decoded });
  } catch {
    res.status(401).json({ valid: false });
  }
});

module.exports = router;