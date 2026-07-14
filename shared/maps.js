/**
 * FORT UBA — Free Maps Constants & Landmarks
 *
 * All map services are 100% free, no API keys required:
 *   - OpenStreetMap (HOT style) — tile rendering
 *   - Nominatim  — geocoding & address search  (proxied via /geo backend)
 *   - OSRM       — routing & road distances    (proxied via /geo backend)
 *
 * This file exports only data constants. All network calls go through
 * the backend geo proxy (geoApi in shared/api.js) to centralise rate
 * limiting and caching.
 * Leaflet helpers live in each app's MapComponents.jsx.
 */

// ── Fort Portal, Uganda ────────────────────────────────────────────
export const FP_CENTER = { lat: 0.6710, lng: 30.2742 };

// ── Tile layer options (all free, no key) ─────────────────────────
export const TILE_LAYERS = {
  // HOT Humanitarian style — excellent detail for Uganda, recommended
  hot: {
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · HOT',
  },
  // Standard OSM
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  // CartoDB light — clean minimal style
  carto: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '© OpenStreetMap contributors © <a href="https://carto.com/">CARTO</a>',
  },
};

// Default: HOT style looks best for Fort Portal
export const DEFAULT_TILE = TILE_LAYERS.hot;

// ── Fort Portal landmarks (quick-pick suggestions) ─────────────────
export const FP_LANDMARKS = [
  { displayName: "Fort Portal Town Centre",          lat: 0.6728, lng: 30.2755 },
  { displayName: "Fort Portal Referral Hospital",    lat: 0.6695, lng: 30.2812 },
  { displayName: "Nyakasura School",                 lat: 0.6612, lng: 30.2694 },
  { displayName: "Fort Portal Bus Park",             lat: 0.6718, lng: 30.2741 },
  { displayName: "Mountains of the Moon University", lat: 0.6653, lng: 30.2697 },
  { displayName: "Rwenzori International Hotel",     lat: 0.6724, lng: 30.2749 },
  { displayName: "Mpanga Forest Reserve",            lat: 0.6281, lng: 30.3047 },
  { displayName: "Fort Portal Airport",              lat: 0.6534, lng: 30.2481 },
  { displayName: "Kabarole District HQ",             lat: 0.6721, lng: 30.2758 },
  { displayName: "St. Paul's Cathedral Fort Portal", lat: 0.6715, lng: 30.2746 },
];
