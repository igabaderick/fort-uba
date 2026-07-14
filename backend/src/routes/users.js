const express = require("express");
const router = express.Router();
const { query } = require("../db/db");
const { authMiddleware } = require("../middleware/auth");

// GET /users/me
router.get("/me", authMiddleware(["rider"]), async (req, res) => {
  const result = await query("SELECT * FROM users WHERE id=$1", [req.user.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
  res.json({ user: result.rows[0] });
});

// PATCH /users/me
router.patch("/me", authMiddleware(["rider"]), async (req, res) => {
  const { name, emergencyContactName, emergencyContactPhone } = req.body;
  const result = await query(
    `UPDATE users SET
       name = COALESCE($1, name),
       emergency_contact_name = COALESCE($2, emergency_contact_name),
       emergency_contact_phone = COALESCE($3, emergency_contact_phone),
       updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [name, emergencyContactName, emergencyContactPhone, req.user.id]
  );
  res.json({ user: result.rows[0] });
});

// GET /users/saved-places
router.get("/saved-places", authMiddleware(["rider"]), async (req, res) => {
  const result = await query("SELECT * FROM saved_places WHERE user_id=$1 ORDER BY created_at ASC", [req.user.id]);
  res.json({ places: result.rows });
});

// POST /users/saved-places
router.post("/saved-places", authMiddleware(["rider"]), async (req, res) => {
  const { label, address, lat, lng } = req.body;
  if (!label || !lat || !lng) return res.status(400).json({ error: "label, lat, lng required" });
  const result = await query(
    "INSERT INTO saved_places (user_id, label, address, lat, lng) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [req.user.id, label, address || "", lat, lng]
  );
  res.status(201).json({ place: result.rows[0] });
});

// DELETE /users/saved-places/:id
router.delete("/saved-places/:id", authMiddleware(["rider"]), async (req, res) => {
  await query("DELETE FROM saved_places WHERE id=$1 AND user_id=$2", [req.params.id, req.user.id]);
  res.json({ success: true });
});

module.exports = router;
