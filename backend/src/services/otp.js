/**
 * OTP service.
 * In dev mode (USE_REAL_SMS=false), OTP is always "1234" and logged to console.
 * In production, wire in Africa's Talking or Twilio here.
 */
const { query } = require("../db/db");

function generateCode() {
  if (process.env.USE_REAL_SMS !== "true") return "1234";
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function sendOtp(phone, userType) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate old codes
  await query(
    "UPDATE otp_codes SET used = true WHERE phone = $1 AND user_type = $2 AND used = false",
    [phone, userType]
  );

  await query(
    "INSERT INTO otp_codes (phone, code, user_type, expires_at) VALUES ($1, $2, $3, $4)",
    [phone, code, userType, expiresAt]
  );

  if (process.env.USE_REAL_SMS !== "true") {
    console.log(`[OTP DEV] Phone: ${phone} | Code: ${code} | Type: ${userType}`);
    return { success: true, dev: true };
  }

  // TODO: integrate Africa's Talking SMS API
  // const response = await fetch("https://api.africastalking.com/version1/messaging", { ... });
  return { success: true };
}

async function verifyOtp(phone, code, userType) {
  const result = await query(
    `SELECT id FROM otp_codes 
     WHERE phone = $1 AND code = $2 AND user_type = $3 
       AND used = false AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [phone, code, userType]
  );

  if (result.rows.length === 0) {
    return { valid: false };
  }

  await query("UPDATE otp_codes SET used = true WHERE id = $1", [result.rows[0].id]);
  return { valid: true };
}

module.exports = { sendOtp, verifyOtp };
