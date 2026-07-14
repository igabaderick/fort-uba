/**
 * Admin Dashboard — Live Map Component
 * OpenStreetMap + Leaflet (free, no API key)
 * Shows all online drivers with real positions
 */
import { useEffect, useRef } from "react";
import { FP_CENTER } from "../../shared/maps.js";

const COLORS = { navy: "#1B2A6B", red: "#E8232A", gold: "#F5A623", green: "#3B6D11" };

export function AdminLiveMap({ height = "100%", drivers = [], activeRides = [] }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const driverMarkersRef = useRef({});

  // Init map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    import("leaflet").then(L => {
      const map = L.map(containerRef.current, {
        center: [FP_CENTER.lat, FP_CENTER.lng],
        zoom: 13,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Fort Portal label
      L.marker([FP_CENTER.lat, FP_CENTER.lng], {
        icon: L.divIcon({
          html: `<div style="background:${COLORS.navy};color:white;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2)">Fort Portal Town</div>`,
          className: "", iconAnchor: [50, 12],
        }),
      }).addTo(map);

      mapRef.current = map;
    });
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Update driver markers when drivers list changes
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then(L => {
      const seen = new Set();

      drivers.forEach(d => {
        if (!d.current_lat || !d.current_lng || +d.current_lat === 0) return;
        seen.add(d.id);

        const emoji = d.driver_type === "car" ? "🚗" : "🏍";
        const isOnTrip = activeRides.some(r => r.driver_id === d.id);
        const bg = isOnTrip ? COLORS.red : COLORS.gold;

        const icon = L.divIcon({
          html: `<div style="background:${bg};border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white" title="${d.name}">${emoji}</div>`,
          iconSize: [30, 30], iconAnchor: [15, 15], className: "",
        });

        if (driverMarkersRef.current[d.id]) {
          driverMarkersRef.current[d.id].setLatLng([+d.current_lat, +d.current_lng]);
          driverMarkersRef.current[d.id].setIcon(icon);
        } else {
          const m = L.marker([+d.current_lat, +d.current_lng], { icon })
            .bindPopup(`<b>${d.name}</b><br>${d.driver_type} · ⭐ ${Number(d.rating || 5).toFixed(1)}<br>${isOnTrip ? "🟡 On trip" : "🟢 Available"}`)
            .addTo(mapRef.current);
          driverMarkersRef.current[d.id] = m;
        }
      });

      // Remove markers for drivers no longer online
      Object.keys(driverMarkersRef.current).forEach(id => {
        if (!seen.has(id)) {
          driverMarkersRef.current[id].remove();
          delete driverMarkersRef.current[id];
        }
      });
    });
  }, [drivers, activeRides]);

  return (
    <div style={{ width: "100%", height, borderRadius: 14, overflow: "hidden" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
