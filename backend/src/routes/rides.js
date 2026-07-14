const express = require("express");
const router = express.Router();
const { query, getClient } = require("../db/db");
const { authMiddleware } = require("../middleware/auth");
const { estimateFarePair, estimateFare, calcCommission, haversineKm } = require("../services/fare");
const { getRoadDistance } = require("../services/geo");

// ── FARE ESTIMATE (pre-booking, no auth required) ─────────────────
// GET /rides/estimate?pickupLat=&pickupLng=&destLat=&destLng=
router.get("/estimate", async (req, res) => {
  const { pickupLat, pickupLng, destLat, destLng } = req.query;
  if (!pickupLat || !destLat) {
    return res.status(400).json({ error: "pickupLat, pickupLng, destLat, destLng required" });
  }
  try {
    const result = await estimateFarePair(+pickupLat, +pickupLng, +destLat, +destLng);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── REQUEST RIDE ──────────────────────────────────────────────────
// POST /rides/request
router.post("/request", authMiddleware(["rider"]), async (req, res) => {
  const { pickupLat, pickupLng, pickupAddress, pickupNote, destLat, destLng, destAddress, rideType, paymentMethod } = req.body;

  if (!pickupLat || !destLat || !rideType) {
    return res.status(400).json({ error: "Pickup, destination and ride type required" });
  }

  try {
    const { distanceKm, durationMin } = await getRoadDistance(+pickupLat, +pickupLng, +destLat, +destLng);
    const fare = await estimateFare(rideType, distanceKm);

    const result = await query(
      `INSERT INTO rides 
       (rider_id, ride_type, status, pickup_lat, pickup_lng, pickup_address, pickup_note,
        dest_lat, dest_lng, dest_address, distance_km, duration_min, fare_estimate, payment_method)
       VALUES ($1,$2,'requested',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [req.user.id, rideType, pickupLat, pickupLng, pickupAddress || "", pickupNote || "",
       destLat, destLng, destAddress || "", Math.round(distanceKm * 10) / 10, durationMin, fare,
       paymentMethod || "cash"]
    );

    const ride = result.rows[0];
    // Emit to socket for dispatch
    if (req.app.get("io")) {
      req.app.get("io").emit("new_ride_request", { rideId: ride.id, rideType, pickupLat, pickupLng, fare });
    }
    res.status(201).json({ ride });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DRIVER: accept ride ───────────────────────────────────────────
// POST /rides/:id/accept
router.post("/:id/accept", authMiddleware(["driver"]), async (req, res) => {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT * FROM rides WHERE id = $1 AND status = 'requested' FOR UPDATE`,
      [req.params.id]
    );
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Ride no longer available" });
    }

    // Check driver is approved and online
    const driverRes = await client.query(
      "SELECT * FROM drivers WHERE id = $1 AND status = 'approved' AND is_online = true",
      [req.user.id]
    );
    if (driverRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Driver not eligible to accept rides" });
    }

    const updated = await client.query(
      `UPDATE rides SET driver_id=$1, status='accepted', accepted_at=NOW() WHERE id=$2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    await client.query("COMMIT");

    const ride = updated.rows[0];
    if (req.app.get("io")) {
      req.app.get("io").to(`rider_${ride.rider_id}`).emit("ride_accepted", { ride, driver: driverRes.rows[0] });
    }
    res.json({ ride });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── DRIVER: update status ─────────────────────────────────────────
// POST /rides/:id/status
// body: { status: 'driver_arriving' | 'driver_arrived' | 'in_progress' | 'completed' }
router.post("/:id/status", authMiddleware(["driver"]), async (req, res) => {
  const { status } = req.body;
  const validTransitions = {
    accepted: ["driver_arriving"],
    driver_arriving: ["driver_arrived"],
    driver_arrived: ["in_progress"],
    in_progress: ["completed"],
  };

  const rideRes = await query("SELECT * FROM rides WHERE id=$1 AND driver_id=$2", [req.params.id, req.user.id]);
  if (rideRes.rows.length === 0) return res.status(404).json({ error: "Ride not found" });

  const ride = rideRes.rows[0];
  if (!validTransitions[ride.status]?.includes(status)) {
    return res.status(400).json({ error: `Cannot transition from ${ride.status} to ${status}` });
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    let extra = "";
    const params = [status, req.params.id];

    if (status === "in_progress") extra = ", pickup_at = NOW()";
    if (status === "completed") {
      const commission = await calcCommission(ride.fare_estimate);
      const earnings = ride.fare_estimate - commission;

      // Finalize ride
      await client.query(
        `UPDATE rides SET status='completed', fare_final=$1, commission=$2, driver_earnings=$3,
         completed_at=NOW() WHERE id=$4`,
        [ride.fare_estimate, commission, earnings, ride.id]
      );

      // Record transaction
      const driverRes = await client.query("SELECT commission_balance FROM drivers WHERE id=$1", [req.user.id]);
      const balBefore = driverRes.rows[0].commission_balance;
      let balAfter = balBefore;

      if (ride.payment_method === "cash") {
        // Cash: driver owes commission to FORT UBA
        balAfter = balBefore - commission;
        await client.query(
          "INSERT INTO transactions (driver_id,ride_id,type,amount,balance_before,balance_after,status) VALUES ($1,$2,'commission_cash',$3,$4,$5,'completed')",
          [req.user.id, ride.id, commission, balBefore, balAfter]
        );
        await client.query("UPDATE drivers SET commission_balance=$1 WHERE id=$2", [balAfter, req.user.id]);
      } else {
        // MoMo: commission deducted digitally (balance unchanged for now)
        await client.query(
          "INSERT INTO transactions (driver_id,ride_id,type,amount,balance_before,balance_after,status) VALUES ($1,$2,'commission_momo',$3,$4,$5,'completed')",
          [req.user.id, ride.id, commission, balBefore, balBefore]
        );
      }

      // Update driver + rider trip counts
      await client.query("UPDATE drivers SET total_trips=total_trips+1 WHERE id=$1", [req.user.id]);
      await client.query("UPDATE users SET total_trips=total_trips+1 WHERE id=$1", [ride.rider_id]);

      await client.query("COMMIT");
      const finalRide = (await query("SELECT * FROM rides WHERE id=$1", [ride.id])).rows[0];

      if (req.app.get("io")) {
        req.app.get("io").to(`rider_${ride.rider_id}`).emit("ride_completed", { ride: finalRide });
      }
      return res.json({ ride: finalRide, commission, earnings });
    }

    const updated = await client.query(
      `UPDATE rides SET status=$1${extra} WHERE id=$2 RETURNING *`, params
    );
    await client.query("COMMIT");

    if (req.app.get("io")) {
      req.app.get("io").to(`rider_${ride.rider_id}`).emit("ride_status", { status, rideId: ride.id });
    }
    res.json({ ride: updated.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── CANCEL RIDE ───────────────────────────────────────────────────
// POST /rides/:id/cancel
router.post("/:id/cancel", authMiddleware(["rider", "driver"]), async (req, res) => {
  const { reason } = req.body;
  const userType = req.user.type;

  const rideRes = await query("SELECT * FROM rides WHERE id=$1", [req.params.id]);
  if (rideRes.rows.length === 0) return res.status(404).json({ error: "Ride not found" });

  const ride = rideRes.rows[0];
  const cancelableStatuses = ["requested", "matching", "accepted", "driver_arriving"];
  if (!cancelableStatuses.includes(ride.status)) {
    return res.status(400).json({ error: "Ride cannot be cancelled at this stage" });
  }

  const updated = await query(
    `UPDATE rides SET status='cancelled', cancelled_by=$1, cancel_reason=$2, cancelled_at=NOW() WHERE id=$3 RETURNING *`,
    [userType, reason || "", req.params.id]
  );

  if (req.app.get("io")) {
    const notifyId = userType === "rider" ? `driver_${ride.driver_id}` : `rider_${ride.rider_id}`;
    if (ride.driver_id || ride.rider_id) {
      req.app.get("io").to(notifyId).emit("ride_cancelled", { rideId: ride.id, by: userType });
    }
  }
  res.json({ ride: updated.rows[0] });
});

// ── RATE RIDE ─────────────────────────────────────────────────────
// POST /rides/:id/rate
router.post("/:id/rate", authMiddleware(["rider", "driver"]), async (req, res) => {
  const { rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating 1-5 required" });

  const userType = req.user.type;
  const field = userType === "rider" ? "driver_rating" : "rider_rating";
  const commentField = userType === "rider" ? "rider_comment" : "driver_comment";

  await query(`UPDATE rides SET ${field}=$1, ${commentField}=$2 WHERE id=$3`, [rating, comment || "", req.params.id]);

  // Update average rating
  if (userType === "rider") {
    await query(
      `UPDATE drivers SET rating = (SELECT ROUND(AVG(driver_rating),2) FROM rides WHERE driver_id = drivers.id AND driver_rating IS NOT NULL) WHERE id = (SELECT driver_id FROM rides WHERE id=$1)`,
      [req.params.id]
    );
  } else {
    await query(
      `UPDATE users SET rating = (SELECT ROUND(AVG(rider_rating),2) FROM rides WHERE rider_id = users.id AND rider_rating IS NOT NULL) WHERE id = (SELECT rider_id FROM rides WHERE id=$1)`,
      [req.params.id]
    );
  }
  res.json({ success: true });
});

// ── GET RIDE ──────────────────────────────────────────────────────
// GET /rides/:id
router.get("/:id", authMiddleware(), async (req, res) => {
  const result = await query(
    `SELECT r.*, 
       u.name as rider_name, u.phone as rider_phone, u.rating as rider_rating_avg,
       d.name as driver_name, d.phone as driver_phone, d.vehicle_desc, d.vehicle_reg,
       d.rating as driver_rating_avg, d.current_lat as driver_lat, d.current_lng as driver_lng
     FROM rides r
     LEFT JOIN users u ON u.id = r.rider_id
     LEFT JOIN drivers d ON d.id = r.driver_id
     WHERE r.id = $1`,
    [req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "Ride not found" });
  res.json({ ride: result.rows[0] });
});

// ── RIDER: get my rides ───────────────────────────────────────────
// GET /rides/my/history
router.get("/my/history", authMiddleware(["rider"]), async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const result = await query(
    `SELECT r.*, d.name as driver_name, d.vehicle_desc, d.vehicle_reg
     FROM rides r LEFT JOIN drivers d ON d.id = r.driver_id
     WHERE r.rider_id = $1 ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
    [req.user.id, limit, offset]
  );
  res.json({ rides: result.rows });
});

// ── RIDER: active ride ────────────────────────────────────────────
// GET /rides/my/active
router.get("/my/active", authMiddleware(["rider"]), async (req, res) => {
  const result = await query(
    `SELECT r.*, d.name as driver_name, d.vehicle_desc, d.vehicle_reg, d.current_lat as driver_lat, d.current_lng as driver_lng, d.rating as driver_rating_avg, d.total_trips as driver_total_trips
     FROM rides r LEFT JOIN drivers d ON d.id = r.driver_id
     WHERE r.rider_id = $1 AND r.status NOT IN ('completed','cancelled')
     ORDER BY r.created_at DESC LIMIT 1`,
    [req.user.id]
  );
  res.json({ ride: result.rows[0] || null });
});

// ── DRIVER: active/pending rides ─────────────────────────────────
// GET /rides/driver/active
router.get("/driver/active", authMiddleware(["driver"]), async (req, res) => {
  const result = await query(
    `SELECT r.*, u.name as rider_name, u.phone as rider_phone, u.rating as rider_rating_avg
     FROM rides r LEFT JOIN users u ON u.id = r.rider_id
     WHERE r.driver_id = $1 AND r.status NOT IN ('completed','cancelled')
     ORDER BY r.created_at DESC LIMIT 1`,
    [req.user.id]
  );
  res.json({ ride: result.rows[0] || null });
});

module.exports = router;
