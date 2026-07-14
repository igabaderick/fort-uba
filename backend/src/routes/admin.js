const express = require("express");
const router = express.Router();
const { query } = require("../db/db");
const { authMiddleware } = require("../middleware/auth");
const { invalidateCache } = require("../services/fare");

const adminOnly = authMiddleware(["admin"]);

// ── OVERVIEW STATS ────────────────────────────────────────────────
// GET /admin/stats
router.get("/stats", adminOnly, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [todayRides, yesterdayRides, activeDrivers, pendingApprovals, revenue, pendingDebt] = await Promise.all([
    query("SELECT COUNT(*) FROM rides WHERE created_at >= $1 AND status != 'cancelled'", [today]),
    query("SELECT COUNT(*) FROM rides WHERE created_at >= $1 AND created_at < $2 AND status != 'cancelled'", [yesterday, today]),
    query("SELECT COUNT(*) FROM drivers WHERE is_online=true AND status='approved'"),
    query("SELECT COUNT(*) FROM drivers WHERE status='pending'"),
    query("SELECT COALESCE(SUM(commission),0) as total FROM rides WHERE completed_at >= $1", [today]),
    query("SELECT COALESCE(SUM(ABS(commission_balance)),0) as total FROM drivers WHERE commission_balance < 0"),
  ]);

  const todayCount = parseInt(todayRides.rows[0].count);
  const yesterdayCount = parseInt(yesterdayRides.rows[0].count);
  const rideDelta = yesterdayCount > 0 ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100) : null;

  res.json({
    ridesToday: todayCount,
    ridesYesterday: yesterdayCount,
    rideDeltaPct: rideDelta,
    activeDrivers: parseInt(activeDrivers.rows[0].count),
    pendingApprovals: parseInt(pendingApprovals.rows[0].count),
    revenueToday: parseInt(revenue.rows[0].total),
    outstandingDebt: parseInt(pendingDebt.rows[0].total),
  });
});

// ── RIDE VOLUME (last 7 days) ─────────────────────────────────────
// GET /admin/ride-volume
router.get("/ride-volume", adminOnly, async (req, res) => {
  const result = await query(
    `SELECT DATE(created_at) as date, COUNT(*) as count, 
       SUM(CASE WHEN ride_type='boda' THEN 1 ELSE 0 END) as boda,
       SUM(CASE WHEN ride_type='car' THEN 1 ELSE 0 END) as car
     FROM rides 
     WHERE created_at >= NOW() - INTERVAL '7 days' AND status != 'cancelled'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );
  res.json({ days: result.rows });
});

// ── LIVE RIDES ────────────────────────────────────────────────────
// GET /admin/live-rides
router.get("/live-rides", adminOnly, async (req, res) => {
  const result = await query(
    `SELECT r.id, r.status, r.ride_type, r.fare_estimate, r.pickup_address, r.dest_address,
       u.name as rider_name, d.name as driver_name, d.current_lat, d.current_lng,
       r.requested_at
     FROM rides r
     LEFT JOIN users u ON u.id = r.rider_id
     LEFT JOIN drivers d ON d.id = r.driver_id
     WHERE r.status NOT IN ('completed','cancelled')
     ORDER BY r.requested_at DESC`
  );
  res.json({ rides: result.rows });
});

// ── RIDE HISTORY ──────────────────────────────────────────────────
// GET /admin/rides?status=&limit=&offset=&search=
router.get("/rides", adminOnly, async (req, res) => {
  const { status, limit = 50, offset = 0, search } = req.query;
  let conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(u.name ILIKE $${params.length} OR d.name ILIKE $${params.length} OR r.pickup_address ILIKE $${params.length})`);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const result = await query(
    `SELECT r.*, u.name as rider_name, d.name as driver_name
     FROM rides r
     LEFT JOIN users u ON u.id = r.rider_id
     LEFT JOIN drivers d ON d.id = r.driver_id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  res.json({ rides: result.rows });
});

// ── FINANCE ───────────────────────────────────────────────────────
// GET /admin/finance
router.get("/finance", adminOnly, async (req, res) => {
  const [monthly, subscriptions, debtors] = await Promise.all([
    query(
      `SELECT 
         COALESCE(SUM(CASE WHEN payment_method='momo' THEN commission ELSE 0 END),0) as commission_momo,
         COALESCE(SUM(CASE WHEN payment_method='cash' THEN commission ELSE 0 END),0) as commission_cash
       FROM rides WHERE status='completed' AND completed_at >= DATE_TRUNC('month', NOW())`
    ),
    query(
      `SELECT COUNT(*) as active FROM drivers 
       WHERE subscription_paid_until IS NOT NULL AND subscription_paid_until > NOW()`
    ),
    query(
      `SELECT id, name, phone, driver_type, commission_balance 
       FROM drivers WHERE commission_balance < 0 ORDER BY commission_balance ASC`
    ),
  ]);

  res.json({
    commissionMomo: parseInt(monthly.rows[0].commission_momo),
    commissionCash: parseInt(monthly.rows[0].commission_cash),
    activeSubscriptions: parseInt(subscriptions.rows[0].active),
    debtors: debtors.rows,
  });
});

// ── PRICING ───────────────────────────────────────────────────────
// GET /admin/pricing
router.get("/pricing", adminOnly, async (req, res) => {
  const result = await query("SELECT * FROM pricing ORDER BY updated_at DESC LIMIT 1");
  res.json({ pricing: result.rows[0] });
});

// PUT /admin/pricing
router.put("/pricing", adminOnly, async (req, res) => {
  const { bodaBaseFare, bodaPerKm, carBaseFare, carPerKm, commissionRate, subscriptionWeekly, cancellationFee } = req.body;

  const result = await query(
    `UPDATE pricing SET
       boda_base_fare = COALESCE($1, boda_base_fare),
       boda_per_km = COALESCE($2, boda_per_km),
       car_base_fare = COALESCE($3, car_base_fare),
       car_per_km = COALESCE($4, car_per_km),
       commission_rate = COALESCE($5, commission_rate),
       subscription_weekly = COALESCE($6, subscription_weekly),
       cancellation_fee = COALESCE($7, cancellation_fee),
       updated_at = NOW(), updated_by = $8
     RETURNING *`,
    [bodaBaseFare, bodaPerKm, carBaseFare, carPerKm, commissionRate, subscriptionWeekly, cancellationFee, req.user.id]
  );

  invalidateCache();
  res.json({ pricing: result.rows[0] });
});

// ── PUSH NOTIFICATION (stub) ──────────────────────────────────────
// POST /admin/announce
router.post("/announce", adminOnly, async (req, res) => {
  const { target, message } = req.body; // target: 'riders' | 'drivers' | 'all'
  if (!message) return res.status(400).json({ error: "Message required" });

  if (req.app.get("io")) {
    const event = "announcement";
    if (target === "riders" || target === "all") req.app.get("io").to("riders").emit(event, { message });
    if (target === "drivers" || target === "all") req.app.get("io").to("drivers").emit(event, { message });
  }
  res.json({ success: true });
});

module.exports = router;
