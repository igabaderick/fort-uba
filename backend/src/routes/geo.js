/**
 * /geo — proxy for Nominatim + OSRM
 * Fronts all map API calls so:
 *  1. Rate limiting is enforced server-side (1 req/sec Nominatim)
 *  2. No CORS issues in browsers
 *  3. Fort Portal bias is always applied
 *  4. Results are cached briefly to reduce external calls
 */
const express = require("express");
const router = express.Router();
const { searchPlaces, reverseGeocode, getRoadDistance } = require("../services/geo");

// Simple in-memory cache
const cache = new Map();
function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return Promise.resolve(hit.v);
  return fn().then(v => { cache.set(key, { v, t: Date.now() }); return v; });
}

// Rate limiter for Nominatim (1 req/sec)
let lastNominatim = 0;
async function nominatimGate() {
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastNominatim = Date.now();
}

// GET /geo/search?q=Fort+Portal+hospital
router.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);
  const key = "search:" + q.toLowerCase().trim();
  try {
    await nominatimGate();
    const raw = await cached(key, 5 * 60 * 1000, () => searchPlaces(q)); // cache 5 min
    const results = raw.map(p => ({
      placeId: p.place_id,
      displayName: formatName(p),
      fullAddress: p.display_name,
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lon),
    }));
    res.json(results);
  } catch (err) {
    res.json([]);
  }
});

// GET /geo/reverse?lat=0.671&lng=30.274
router.get("/reverse", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });
  const key = `rev:${parseFloat(lat).toFixed(4)},${parseFloat(lng).toFixed(4)}`;
  try {
    await nominatimGate();
    const raw = await cached(key, 10 * 60 * 1000, () => reverseGeocode(lat, lng));
    if (!raw || raw.error) return res.json({ displayName: "Current location", lat: +lat, lng: +lng });
    res.json({ displayName: formatName(raw), fullAddress: raw.display_name, lat: +lat, lng: +lng });
  } catch {
    res.json({ displayName: "Current location", lat: +lat, lng: +lng });
  }
});

// GET /geo/route?fromLat=&fromLng=&toLat=&toLng=&profile=car
router.get("/route", async (req, res) => {
  const { fromLat, fromLng, toLat, toLng, profile = "car" } = req.query;
  if (!fromLat || !toLat) return res.status(400).json({ error: "fromLat, fromLng, toLat, toLng required" });
  const key = `route:${fromLat},${fromLng}-${toLat},${toLng}-${profile}`;
  try {
    const result = await cached(key, 10 * 60 * 1000, () =>
      getRoadDistance(+fromLat, +fromLng, +toLat, +toLng)
    );
    res.json(result || { distanceKm: 0, durationMin: 0 });
  } catch {
    res.json({ distanceKm: 0, durationMin: 0 });
  }
});

// GET /geo/route/geometry?fromLat=&fromLng=&toLat=&toLng=&profile=car
// Returns full route geometry for drawing on map
router.get("/route/geometry", async (req, res) => {
  const { fromLat, fromLng, toLat, toLng, profile = "car" } = req.query;
  if (!fromLat || !toLat) return res.status(400).json({ error: "coordinates required" });

  const osrmProfile = profile === "boda" ? "bike" : "car";
  const key = `geom:${fromLat},${fromLng}-${toLat},${toLng}-${profile}`;

  try {
    const result = await cached(key, 10 * 60 * 1000, async () => {
      const r = await fetch(
        `https://router.project-osrm.org/route/v1/${osrmProfile}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`,
        { headers: { "User-Agent": "FortUBA-Backend/1.0" }, signal: AbortSignal.timeout(8000) }
      );
      const data = await r.json();
      if (data.code !== "Ok" || !data.routes?.length) return null;
      return {
        distanceKm: Math.round((data.routes[0].distance / 1000) * 10) / 10,
        durationMin: Math.round(data.routes[0].duration / 60),
        geometry: data.routes[0].geometry.coordinates, // [[lng, lat], ...]
      };
    });
    res.json(result || { geometry: [], distanceKm: 0, durationMin: 0 });
  } catch {
    res.json({ geometry: [], distanceKm: 0, durationMin: 0 });
  }
});

function formatName(place) {
  const a = place.address || {};
  const parts = [
    a.amenity || a.shop || a.tourism || a.leisure || a.road || a.pedestrian || place.name,
    a.suburb || a.neighbourhood || a.city_district || a.town || a.city,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : (place.display_name || "").split(",")[0];
}

module.exports = router;
