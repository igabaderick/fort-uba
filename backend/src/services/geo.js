/**
 * FORT UBA — Backend geo service
 * Wraps OSRM and Nominatim for server-side use.
 * Used for accurate road distance when calculating fares.
 */

const OSRM_BASE = "https://router.project-osrm.org";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const HEADERS = { "User-Agent": "FortUBA-Backend/1.0" };

/**
 * Get road distance + duration from OSRM.
 * Falls back to Haversine × 1.3 if OSRM is unreachable.
 */
async function getRoadDistance(fromLat, fromLng, toLat, toLng) {
  try {
    const res = await fetch(
      `${OSRM_BASE}/route/v1/car/${fromLng},${fromLat};${toLng},${toLat}?overview=false`,
      { headers: HEADERS, signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.length) {
      return {
        distanceKm: Math.round((data.routes[0].distance / 1000) * 10) / 10,
        durationMin: Math.round(data.routes[0].duration / 60),
        source: "osrm",
      };
    }
  } catch (err) {
    console.warn("[geo] OSRM unavailable, falling back to Haversine:", err.message);
  }
  // Fallback: Haversine straight-line × road factor
  const straight = haversineKm(fromLat, fromLng, toLat, toLng);
  return {
    distanceKm: Math.round(straight * 1.3 * 10) / 10,
    durationMin: Math.round((straight * 1.3) / 20 * 60), // ~20km/h average
    source: "haversine_fallback",
  };
}

/**
 * Search places via Nominatim (proxied through backend to control rate limits).
 */
async function searchPlaces(query) {
  try {
    const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(query + " Fort Portal Uganda")}&countrycodes=ug&viewbox=30.15,0.55,30.42,0.80&bounded=0&limit=6&format=json&addressdetails=1`;
    const res = await fetch(url, { headers: { ...HEADERS, "Accept-Language": "en" }, signal: AbortSignal.timeout(5000) });
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Reverse geocode via Nominatim.
 */
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { ...HEADERS, "Accept-Language": "en" }, signal: AbortSignal.timeout(5000) }
    );
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Haversine fallback distance.
 */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { getRoadDistance, searchPlaces, reverseGeocode, haversineKm };
