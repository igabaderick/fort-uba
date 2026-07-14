/**
 * Rider App — Map Components
 * Uses Leaflet + OpenStreetMap (free, no API key)
 * Routes via OSRM, geocoding via Nominatim (proxied through backend)
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { geoApi, ridesApi } from "../../shared/api.js";
import { FP_CENTER, FP_LANDMARKS } from "../../shared/maps.js";

const COLORS = {
  navy: "#1B2A6B", red: "#E8232A", gold: "#F5A623",
  bg: "#F7F7F5", card: "#FFFFFF", text: "#1A1A1A",
  textSub: "#6B6B68", border: "#E7E5E0", green: "#3B6D11",
};

// ── BASE MAP HOOK ──────────────────────────────────────────────────
export function useLeafletMap(containerRef, center, zoom = 14) {
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    import("leaflet").then(L => {
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        center: [center?.lat || FP_CENTER.lat, center?.lng || FP_CENTER.lng],
        zoom,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
    });
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  return mapRef;
}

// ── HOME MAP — shows rider location with pulsing dot ──────────────
export function HomeMap({ height, riderPos }) {
  const containerRef = useRef(null);
  const mapRef = useLeafletMap(containerRef, riderPos || FP_CENTER, 14);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !riderPos) return;
    import("leaflet").then(L => {
      if (markerRef.current) markerRef.current.remove();
      const icon = L.divIcon({
        html: `<div style="position:relative;width:20px;height:20px">
          <div style="position:absolute;inset:0;border-radius:50%;background:${COLORS.navy};opacity:0.3;animation:ripple 2s ease-out infinite"></div>
          <div style="position:absolute;inset:4px;border-radius:50%;background:${COLORS.navy};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>
        </div>`,
        iconSize: [20, 20], iconAnchor: [10, 10], className: "",
      });
      markerRef.current = L.marker([riderPos.lat, riderPos.lng], { icon }).addTo(mapRef.current);
      mapRef.current.setView([riderPos.lat, riderPos.lng], 14, { animate: true });
    });
  }, [riderPos]);

  return (
    <>
      <style>{`@keyframes ripple{0%{transform:scale(1);opacity:0.3}100%{transform:scale(3);opacity:0}}`}</style>
      <div ref={containerRef} style={{ width: "100%", height }} />
    </>
  );
}

// ── BOOKING MAP — pickup pin + destination pin + route line ─────────
export function BookingMap({ height, pickup, destination, rideType, onRouteInfo }) {
  const containerRef = useRef(null);
  const mapRef = useLeafletMap(containerRef, pickup || FP_CENTER, 14);
  const pickupMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const routePolyRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then(L => {
      // Pickup marker
      if (pickupMarkerRef.current) pickupMarkerRef.current.remove();
      if (pickup) {
        const icon = L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${COLORS.navy};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7], className: "",
        });
        pickupMarkerRef.current = L.marker([pickup.lat, pickup.lng], { icon }).addTo(mapRef.current);
      }

      // Destination marker
      if (destMarkerRef.current) destMarkerRef.current.remove();
      if (destination) {
        const icon = L.divIcon({
          html: `<div style="background:${COLORS.red};color:white;border-radius:50% 50% 50% 0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(0,0,0,0.3);border:2px solid white"><span style="transform:rotate(45deg)">📍</span></div>`,
          iconSize: [28, 28], iconAnchor: [14, 28], className: "",
        });
        destMarkerRef.current = L.marker([destination.lat, destination.lng], { icon }).addTo(mapRef.current);
      }

      // Route line
      if (routePolyRef.current) routePolyRef.current.remove();
      if (pickup && destination) {
        // Fetch real OSRM route via backend proxy
        geoApi.routeGeometry(pickup.lat, pickup.lng, destination.lat, destination.lng, rideType || "car")
          .then(data => {
            if (data.geometry?.length && mapRef.current) {
              const latlngs = data.geometry.map(([lng, lat]) => [lat, lng]);
              routePolyRef.current = L.polyline(latlngs, {
                color: COLORS.navy, weight: 4, opacity: 0.75,
                lineJoin: "round", lineCap: "round",
              }).addTo(mapRef.current);

              // Fit map to show full route
              const bounds = L.latLngBounds([[pickup.lat, pickup.lng], [destination.lat, destination.lng]]);
              mapRef.current.fitBounds(bounds, { padding: [50, 50] });

              if (onRouteInfo) onRouteInfo({ distanceKm: data.distanceKm, durationMin: data.durationMin });
            }
          }).catch(() => {
            // Fallback: dashed line pickup → destination
            routePolyRef.current = L.polyline(
              [[pickup.lat, pickup.lng], [destination.lat, destination.lng]],
              { color: COLORS.navy, weight: 3, opacity: 0.5, dashArray: "8,8" }
            ).addTo(mapRef.current);
          });
      }
    });
  }, [pickup, destination, rideType]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}

// ── TRACKING MAP — live driver position moving toward destination ───
export function TrackingMap({ height, driverPos, pickupPos, destPos, rideType }) {
  const containerRef = useRef(null);
  const mapRef = useLeafletMap(containerRef, driverPos || FP_CENTER, 15);
  const driverMarkerRef = useRef(null);
  const routePolyRef = useRef(null);

  // Draw initial route once
  useEffect(() => {
    if (!mapRef.current || !pickupPos || !destPos) return;
    import("leaflet").then(L => {
      if (routePolyRef.current) routePolyRef.current.remove();
      // Background route (grey)
      geoApi.routeGeometry(pickupPos.lat, pickupPos.lng, destPos.lat, destPos.lng, rideType || "car")
        .then(data => {
          if (data.geometry?.length && mapRef.current) {
            const latlngs = data.geometry.map(([lng, lat]) => [lat, lng]);
            routePolyRef.current = L.polyline(latlngs, { color: "#ccc", weight: 5, opacity: 0.6 }).addTo(mapRef.current);
            // Destination pin
            const destIcon = L.divIcon({
              html: `<div style="background:${COLORS.red};color:white;border-radius:50% 50% 50% 0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;transform:rotate(-45deg);box-shadow:0 3px 10px rgba(0,0,0,0.3);border:2px solid white"><span style="transform:rotate(45deg)">📍</span></div>`,
              iconSize: [28, 28], iconAnchor: [14, 28], className: "",
            });
            L.marker([destPos.lat, destPos.lng], { icon: destIcon }).addTo(mapRef.current);
          }
        }).catch(() => {});
    });
  }, [pickupPos, destPos]);

  // Update driver marker position smoothly
  useEffect(() => {
    if (!mapRef.current || !driverPos) return;
    import("leaflet").then(L => {
      const emoji = rideType === "boda" ? "🏍" : "🚗";
      const icon = L.divIcon({
        html: `<div style="background:${COLORS.gold};border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 3px 10px rgba(0,0,0,0.35);border:2px solid white">${emoji}</div>`,
        iconSize: [34, 34], iconAnchor: [17, 17], className: "",
      });
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([driverPos.lat, driverPos.lng]);
      } else {
        driverMarkerRef.current = L.marker([driverPos.lat, driverPos.lng], { icon }).addTo(mapRef.current);
      }
      mapRef.current.setView([driverPos.lat, driverPos.lng], 15, { animate: true, duration: 1 });
    });
  }, [driverPos]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}

// ── ADDRESS SEARCH INPUT ───────────────────────────────────────────
export function AddressSearch({ value, onChange, onSelect, placeholder, style = {} }) {
  const [query, setQuery] = useState(value || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q || q.trim().length < 2) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await geoApi.search(q);
        setResults(data);
        setShowResults(true);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 400);
  }, []);

  function handleChange(e) {
    const v = e.target.value;
    setQuery(v);
    if (onChange) onChange(v);
    search(v);
  }

  function handleSelect(place) {
    setQuery(place.displayName);
    setShowResults(false);
    if (onSelect) onSelect(place);
  }

  // Show Fort Portal landmarks if input is empty and focused
  const suggestions = results.length > 0 ? results : (showResults && !query ? FP_LANDMARKS : []);

  return (
    <div style={{ position: "relative", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "11px 14px" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.textSub} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => { if (!query) setShowResults(true); }}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder={placeholder || "Search for a place or landmark…"}
          style={{ border: "none", outline: "none", fontSize: 13.5, flex: 1, background: "transparent", color: COLORS.text }}
        />
        {loading && <div style={{ width: 12, height: 12, border: `2px solid ${COLORS.border}`, borderTopColor: COLORS.navy, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {showResults && suggestions.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 1000, maxHeight: 240, overflowY: "auto", marginTop: 4 }}>
          {!query && <div style={{ padding: "8px 14px", fontSize: 11, color: COLORS.textSub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fort Portal landmarks</div>}
          {suggestions.map((p, i) => (
            <div
              key={p.placeId || i}
              onMouseDown={() => handleSelect(p)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderTop: i > 0 ? `1px solid ${COLORS.border}` : "none", cursor: "pointer" }}
              onMouseOver={e => e.currentTarget.style.background = COLORS.bg}
              onMouseOut={e => e.currentTarget.style.background = "transparent"}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2" strokeLinecap="round"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>{p.displayName}</div>
                {p.fullAddress && <div style={{ fontSize: 11, color: COLORS.textSub, marginTop: 1 }}>{p.fullAddress?.split(",").slice(0, 3).join(", ")}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
