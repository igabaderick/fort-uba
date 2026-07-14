/**
 * Run this with: npm run db:migrate
 * Reads schema.sql and applies it to the configured DATABASE_URL.
 * Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT DO NOTHING).
 */
const fs = require("fs");
const path = require("path");
const { pool } = require("./db");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  try {
    console.log("Running migrations...");
    await pool.query(sql);
    console.log("✅ Migrations complete.");
  } catch (err) {
    // PostGIS may not be installed; skip that extension gracefully
    if (err.message.includes("postgis")) {
      console.warn("⚠️  PostGIS not available — skipping. Basic lat/lng will be used.");
      const sqlNoGis = sql.replace(
        "CREATE EXTENSION IF NOT EXISTS \"postgis\";",
        "-- PostGIS skipped"
      );
      await pool.query(sqlNoGis);
      console.log("✅ Migrations complete (without PostGIS).");
    } else {
      console.error("❌ Migration error:", err.message);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

migrate();
