/**
 * Seed demo data for development.
 * npm run db:seed
 * WARNING: clears existing data first.
 */
const { pool } = require("./db");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clear
    await client.query("DELETE FROM transactions");
    await client.query("DELETE FROM rides");
    await client.query("DELETE FROM saved_places");
    await client.query("DELETE FROM otp_codes");
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM drivers");
    await client.query("DELETE FROM admins");

    // Admin
    const adminHash = await bcrypt.hash("admin123", 10);
    await client.query(
      `INSERT INTO admins (email, password_hash, name, role) VALUES ($1,$2,$3,$4)`,
      ["admin@fortuba.ug", adminHash, "Fort Portal Admin", "owner"]
    );

    // Riders
    const riders = [
      { phone: "+256700000001", name: "Diana Kyomugisha" },
      { phone: "+256700000002", name: "James Okello" },
      { phone: "+256700000003", name: "Patricia Nakato" },
      { phone: "+256700000004", name: "Samuel Rugaba" },
    ];
    const riderIds = [];
    for (const r of riders) {
      const res = await client.query(
        `INSERT INTO users (phone, name, rating, total_trips) VALUES ($1,$2,$3,$4) RETURNING id`,
        [r.phone, r.name, (4.5 + Math.random() * 0.5).toFixed(2), Math.floor(Math.random() * 50)]
      );
      riderIds.push(res.rows[0].id);
    }

    // Saved places for first rider
    await client.query(
      `INSERT INTO saved_places (user_id, label, address, lat, lng) VALUES ($1,'Home','Kabarole Road, Fort Portal',0.6681,30.2739)`,
      [riderIds[0]]
    );
    await client.query(
      `INSERT INTO saved_places (user_id, label, address, lat, lng) VALUES ($1,'Work','Fort Portal City Centre',0.6728,30.2755)`,
      [riderIds[0]]
    );

    // Drivers
    const drivers = [
      { phone: "+256700000101", name: "Emmanuel Kamugisha", type: "boda", vehicle: "Bajaj Boxer, Red", plate: "UBG 442K", rating: 4.9, trips: 1284, status: "approved", lat: 0.6710, lng: 30.2741 },
      { phone: "+256700000102", name: "Grace Ainembabazi", type: "car", vehicle: "Toyota Fielder, White", plate: "UAX 234D", rating: 4.8, trips: 902, status: "approved", lat: 0.6698, lng: 30.2760 },
      { phone: "+256700000103", name: "Peter Mwesige", type: "car", vehicle: "Toyota Premio, Silver", plate: "UBA 891G", rating: 4.6, trips: 540, status: "approved", lat: 0.6720, lng: 30.2730 },
      { phone: "+256700000104", name: "Moses Tumusiime", type: "boda", vehicle: "Honda CG 125, Blue", plate: "UBF 112M", rating: 4.2, trips: 311, status: "suspended", lat: 0.0, lng: 0.0 },
      { phone: "+256700000105", name: "Ronald Businge", type: "boda", vehicle: "Bajaj Boxer, Black", plate: "UBH 667P", rating: 0, trips: 0, status: "pending", lat: 0.0, lng: 0.0 },
    ];
    const driverIds = [];
    for (const d of drivers) {
      const res = await client.query(
        `INSERT INTO drivers (phone,name,driver_type,vehicle_desc,vehicle_reg,status,rating,total_trips,current_lat,current_lng,is_online,commission_balance,subscription_paid_until)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [d.phone, d.name, d.type, d.vehicle, d.plate, d.status, d.rating, d.trips, d.lat, d.lng,
         d.status === "approved" && d.trips > 0, 0,
         d.status === "approved" ? new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) : null]
      );
      driverIds.push(res.rows[0].id);
    }

    // Some completed rides
    const now = Date.now();
    const completedRides = [
      { rider: riderIds[0], driver: driverIds[0], type: "boda", pickup: "Fort Portal Referral Hospital", dest: "Nyakasura School", fare: 4200, dist: 5.4, commission: 756, earnings: 3444, payment: "cash" },
      { rider: riderIds[1], driver: driverIds[1], type: "car", pickup: "Fort Portal Bus Park", dest: "Mountains of the Moon Hotel", fare: 9500, dist: 4.2, commission: 1710, earnings: 7790, payment: "momo" },
      { rider: riderIds[2], driver: driverIds[0], type: "boda", pickup: "Mpanga Forest", dest: "Fort Portal Town Centre", fare: 3800, dist: 4.8, commission: 684, earnings: 3116, payment: "cash" },
      { rider: riderIds[3], driver: driverIds[2], type: "car", pickup: "Ndali Lodge", dest: "Fort Portal Airport", fare: 11200, dist: 8.1, commission: 2016, earnings: 9184, payment: "momo" },
    ];

    for (let i = 0; i < completedRides.length; i++) {
      const r = completedRides[i];
      const ago = (i + 1) * 35 * 60 * 1000;
      await client.query(
        `INSERT INTO rides (rider_id,driver_id,ride_type,status,pickup_address,dest_address,fare_final,fare_estimate,distance_km,commission,driver_earnings,payment_method,payment_status,rider_rating,driver_rating,requested_at,completed_at)
         VALUES ($1,$2,$3,'completed',$4,$5,$6,$6,$7,$8,$9,$10,'paid',5,5,$11,$12)`,
        [r.rider, r.driver, r.type, r.pickup, r.dest, r.fare, r.dist, r.commission, r.earnings, r.payment,
         new Date(now - ago - 20 * 60000), new Date(now - ago)]
      );
    }

    // Outstanding cash commission debts
    await client.query(
      `UPDATE drivers SET commission_balance = -42000 WHERE id = $1`, [driverIds[3]]
    );

    await client.query("COMMIT");
    console.log("✅ Seed complete.");
    console.log("\nDemo accounts:");
    console.log("  Admin:  admin@fortuba.ug / admin123");
    console.log("  Rider:  +256700000001 (OTP: 1234 in dev mode)");
    console.log("  Driver: +256700000101 (OTP: 1234 in dev mode)");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed error:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
