const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { query } = require("../db/db");
const { sendOtp, verifyOtp } = require("../services/otp");

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}

// ── RIDER AUTH ────────────────────────────────────────────

// POST /auth/rider/send-otp
router.post("/rider/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone required" });
  try {
    await sendOtp(phone, "rider");
    res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/rider/verify-otp
router.post("/rider/verify-otp", async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: "Phone and code required" });

  const { valid } = await verifyOtp(phone, code, "rider");
  if (!valid) return res.status(401).json({ error: "Invalid or expired OTP" });

  // Find or create rider
  let result = await query("SELECT * FROM users WHERE phone = $1", [phone]);
  let user;
  const isNew = result.rows.length === 0;

  if (isNew) {
    result = await query(
      "INSERT INTO users (phone) VALUES ($1) RETURNING *",
      [phone]
    );
  }
  user = result.rows[0];

  const token = signToken({ id: user.id, type: "rider", phone: user.phone });
  res.json({ token, user: { id: user.id, phone: user.phone, name: user.name, isNew } });
});

// POST /auth/rider/complete-profile
router.post("/rider/complete-profile", require("../middleware/auth").authMiddleware(["rider"]), async (req, res) => {
  const { name, emergencyContactName, emergencyContactPhone } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  const result = await query(
    "UPDATE users SET name=$1, emergency_contact_name=$2, emergency_contact_phone=$3, updated_at=NOW() WHERE id=$4 RETURNING *",
    [name, emergencyContactName, emergencyContactPhone, req.user.id]
  );
  res.json({ user: result.rows[0] });
});

// ── DRIVER AUTH ────────────────────────────────────────────

// POST /auth/driver/send-otp
router.post("/driver/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Phone required" });
  try {
    await sendOtp(phone, "driver");
    res.json({ success: true, message: "OTP sent" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/driver/verify-otp
router.post("/driver/verify-otp", async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: "Phone and code required" });

  const { valid } = await verifyOtp(phone, code, "driver");
  if (!valid) return res.status(401).json({ error: "Invalid or expired OTP" });

  let result = await query("SELECT * FROM drivers WHERE phone = $1", [phone]);
  let driver;
  const isNew = result.rows.length === 0;

  if (isNew) {
    result = await query(
      "INSERT INTO drivers (phone, name, driver_type, status) VALUES ($1,'',  'boda', 'pending') RETURNING *",
      [phone]
    );
  }
  driver = result.rows[0];

  const token = signToken({ id: driver.id, type: "driver", phone: driver.phone });
  res.json({ token, driver: { id: driver.id, phone: driver.phone, name: driver.name, status: driver.status, isNew } });
});

// POST /auth/driver/register — complete driver application
router.post("/driver/register", require("../middleware/auth").authMiddleware(["driver"]), async (req, res) => {
  const { name, driverType, vehicleReg, vehicleDesc, nationalId, licenseNumber } = req.body;
  if (!name || !driverType) return res.status(400).json({ error: "Name and driver type required" });

  const result = await query(
    `UPDATE drivers SET name=$1, driver_type=$2, vehicle_reg=$3, vehicle_desc=$4,
     national_id=$5, license_number=$6, status='pending', updated_at=NOW()
     WHERE id=$7 RETURNING *`,
    [name, driverType, vehicleReg, vehicleDesc, nationalId, licenseNumber, req.user.id]
  );
  res.json({ driver: result.rows[0] });
});

// ── ADMIN AUTH ────────────────────────────────────────────

// POST /auth/admin/login
router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  const result = await query("SELECT * FROM admins WHERE email = $1 AND is_active = true", [email]);
  if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

  const admin = result.rows[0];
  const match = await bcrypt.compare(password, admin.password_hash);
  if (!match) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ id: admin.id, type: "admin", email: admin.email, role: admin.role });
  res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
});

module.exports = router;
