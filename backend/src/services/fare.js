const { query } = require("../db/db");
const { getRoadDistance, haversineKm } = require("./geo");

let cachedPricing = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 1000;

async function getPricing() {
  if (cachedPricing && Date.now() - cacheTime < CACHE_TTL) return cachedPricing;
  const res = await query("SELECT * FROM pricing ORDER BY updated_at DESC LIMIT 1");
  cachedPricing = res.rows[0];
  cacheTime = Date.now();
  return cachedPricing;
}

function invalidateCache() { cachedPricing = null; }

/**
 * Estimate fare using real road distance from OSRM.
 * Falls back to Haversine × 1.3 if OSRM is unreachable.
 */
async function estimateFare(rideType, distanceKm) {
  const pricing = await getPricing();
  if (rideType === "boda") return Math.round(pricing.boda_base_fare + pricing.boda_per_km * distanceKm);
  if (rideType === "car")  return Math.round(pricing.car_base_fare  + pricing.car_per_km  * distanceKm);
  throw new Error("Unknown ride type: " + rideType);
}

/**
 * Get road distance from OSRM then estimate both boda + car fares.
 * Returns { boda, car, distanceKm, durationMin, source }
 */
async function estimateFarePair(fromLat, fromLng, toLat, toLng) {
  const { distanceKm, durationMin, source } = await getRoadDistance(fromLat, fromLng, toLat, toLng);
  const [boda, car] = await Promise.all([
    estimateFare("boda", distanceKm),
    estimateFare("car",  distanceKm),
  ]);
  return { boda, car, distanceKm, durationMin, source };
}

async function calcCommission(fare) {
  const pricing = await getPricing();
  return Math.round(fare * pricing.commission_rate);
}

module.exports = { getPricing, estimateFare, estimateFarePair, calcCommission, haversineKm, invalidateCache };
