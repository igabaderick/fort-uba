const express = require("express");
const router = express.Router();
const { query } = require("../db/db");
const { authMiddleware } = require("../middleware/auth");

// ── DRIVER: get own profile ───────────────────────────────────────
// GET /drivers/me
router.get("/me", authMiddleware(["driver"]), async (req, res) => {
  const result = await query("SELECT * FROM drivers WHERE id=$1", [req.user.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Driver not found" });
  const driver = result.rows[0];
  delete driver.password_hash;
  res.json({ driver });
});

// ── DRIVER: go online/offline ─────────────────────────────────────
// POST /drivers/availability
router.post("/availability", authMiddleware(["driver"]), async (req, res) => {
  const { online, lat, lng } = req.body;

  const driverRes = await query("SELECT * FROM drivers WHERE id=$1", [req.user.id]);
  if (driverRes.rows.length === 0) return res.status(404).json({ error: "Driver not found" });

  const driver = driverRes.rows[0];
  if (driver.status !== "approved") {
    return res.status(403).json({ error: "Only approved drivers can go online" });
  }

  // Check subscription
  if (online && driver.subscription_paid_until && new Date(driver.subscription_paid_until) < new Date()) {
    return res.status(402).json({ error: "Subscription expired. Please renew to go online." });
  }

  // Check outstanding debt (block if > threshold, e.g. UGX 50,000)
  const DEBT_BLOCK_THRESHOLD = -50000;
  if (online && driver.commission_balance < DEBT_BLOCK_THRESHOLD) {
    return res.status(402).json({ error: `Outstanding balance of UGX ${Math.abs(driver.commission_balance).toLocaleString()} must be settled first.` });
  }

  await query(
    "UPDATE drivers SET is_online=$1, current_lat=$2, current_lng=$3, updated_at=NOW() WHERE id=$4",
    [!!online, lat || driver.current_lat, lng || driver.current_lng, req.user.id]
  );

  if (req.app.get("io")) {
    req.app.get("io").emit("driver_availability_changed", { driverId: req.user.id, online: !!online, lat, lng });
  }
  res.json({ success: true, online: !!online });
});

// ── DRIVER: update location ───────────────────────────────────────
// POST /drivers/location
router.post("/location", authMiddleware(["driver"]), async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

  await query("UPDATE drivers SET current_lat=$1, current_lng=$2, updated_at=NOW() WHERE id=$3", [lat, lng, req.user.id]);

  if (req.app.get("io")) {
    req.app.get("io").emit("driver_location", { driverId: req.user.id, lat, lng });
  }
  res.json({ success: true });
});

// ── DRIVER: earnings summary ──────────────────────────────────────
// GET /drivers/earnings
router.get("/earnings", authMiddleware(["driver"]), async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayRes, weekRes, allRes, activeRide] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(driver_earnings),0) as total, COUNT(*) as count 
       FROM rides WHERE driver_id=$1 AND status='completed' AND completed_at >= $2`,
      [req.user.id, today]
    ),
    query(
      `SELECT COALESCE(SUM(driver_earnings),0) as total, COUNT(*) as count 
       FROM rides WHERE driver_id=$1 AND status='completed' AND completed_at >= NOW() - INTERVAL '7 days'`,
      [req.user.id]
    ),
    query(
      `SELECT COALESCE(SUM(driver_earnings),0) as total, COUNT(*) as count FROM rides WHERE driver_id=$1 AND status='completed'`,
      [req.user.id]
    ),
    query(
      `SELECT * FROM rides WHERE driver_id=$1 AND status NOT IN ('completed','cancelled') ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    ),
  ]);

  const driverRes = await query(
    "SELECT commission_balance, subscription_paid_until, rating FROM drivers WHERE id=$1",
    [req.user.id]
  );

  res.json({
    today: { earnings: parseInt(todayRes.rows[0].total), trips: parseInt(todayRes.rows[0].count) },
    week: { earnings: parseInt(weekRes.rows[0].total), trips: parseInt(weekRes.rows[0].count) },
    all: { earnings: parseInt(allRes.rows[0].total), trips: parseInt(allRes.rows[0].count) },
    commissionBalance: driverRes.rows[0].commission_balance,
    subscriptionPaidUntil: driverRes.rows[0].subscription_paid_until,
    rating: driverRes.rows[0].rating,
    activeRide: activeRide.rows[0] || null,
  });
});

// ── ADMIN: list drivers ───────────────────────────────────────────
// GET /drivers  (admin only)
router.get("/", authMiddleware(["admin"]), async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  let sql = `SELECT d.*, 
    COALESCE((SELECT SUM(driver_earnings) FROM rides WHERE driver_id=d.id AND status='completed' AND completed_at >= NOW()-INTERVAL '7 days'),0) as week_earnings
    FROM drivers d`;
  const params = [];
  if (status) {
    sql += " WHERE d.status = $1";
    params.push(status);
  }
  sql += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(sql, params);
  res.json({ drivers: result.rows });
});

// ── ADMIN: approve/reject/suspend driver ─────────────────────────
// PATCH /drivers/:id/status
router.patch("/:id/status", authMiddleware(["admin"]), async (req, res) => {
  const { status, reason } = req.body;
  const validStatuses = ["approved", "rejected", "suspended", "pending"];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const result = await query(
    "UPDATE drivers SET status=$1, rejection_reason=$2, updated_at=NOW() WHERE id=$3 RETURNING *",
    [status, reason || null, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Driver not found" });

  // Notify driver via socket
  if (req.app.get("io")) {
    req.app.get("io").to(`driver_${req.params.id}`).emit("status_changed", { status, reason });
  }
  res.json({ driver: result.rows[0] });
});

// ── ADMIN: get online drivers for live map ────────────────────────
// GET /drivers/online
router.get("/online", authMiddleware(["admin"]), async (req, res) => {
  const result = await query(
    "SELECT id, name, driver_type, current_lat, current_lng, rating FROM drivers WHERE is_online=true AND status='approved'"
  );
  res.json({ drivers: result.rows });
});

module.exports = router;
