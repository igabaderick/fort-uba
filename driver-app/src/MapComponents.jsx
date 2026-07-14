/**
 * Driver App — Map Components
 * OpenStreetMap + Leaflet (free, no API key)
 * Routes via OSRM proxied through backend
 */
import { useEffect, useRef } from "react";
import { geoApi } from "../../shared/api.js";
import { FP_CENTER } from "../../shared/maps.js";

const COLORS = { navy: "#1B2A6B", red: "#E8232A", gold: "#F5A623", green: "#3B6D11" };

function useMap(containerRef, center, zoom = 14) {
  const mapRef = useRef(null);
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    import("leaflet").then(L => {
      const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true,
        center: [center?.lat || FP_CENTER.lat, center?.lng || FP_CENTER.lng], zoom });
      L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
    });
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);
  return mapRef;
}

// ── DRIVER IDLE MAP — shows driver's own location ─────────────────
export function DriverIdleMap({ height, driverPos }) {
  const containerRef = useRef(null);
  const mapRef = useMap(containerRef, driverPos || FP_CENTER, 14);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !driverPos) return;
    import("leaflet").then(L => {
      if (markerRef.current) markerRef.current.remove();
      const icon = L.divIcon({
        html: `<div style="position:relative;width:24px;height:24px">
          <div style="position:absolute;inset:0;border-radius:50%;background:${COLORS.gold};opacity:0.3;animation:ripple 2s ease-out infinite"></div>
          <div style="position:absolute;inset:4px;border-radius:50%;background:${COLORS.navy};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>
        </div>`,
        iconSize: [24, 24], iconAnchor: [12, 12], className: "",
      });
      markerRef.current = L.marker([driverPos.lat, driverPos.lng], { icon }).addTo(mapRef.current);
      mapRef.current.setView([driverPos.lat, driverPos.lng], 14, { animate: true });
    });
  }, [driverPos]);

  return (
    <>
      <style>{`@keyframes ripple{0%{transform:scale(1);opacity:0.3}100%{transform:scale(3.5);opacity:0}}`}</style>
      <div ref={containerRef} style={{ width: "100%", height }} />
    </>
  );
}

// ── TRIP MAP — pickup + destination + route ────────────────────────
export function TripMap({ height, driverPos, pickupPos, destPos, rideType, tripStatus }) {
  const containerRef = useRef(null);
  const mapRef = useMap(containerRef, driverPos || FP_CENTER, 14);
  const driverMarkerRef = useRef(null);
  const routePolyRef = useRef(null);
  const pickupMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);

  // Draw route when trip starts or status changes
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then(L => {
      if (routePolyRef.current) routePolyRef.current.remove();
      if (pickupMarkerRef.current) pickupMarkerRef.current.remove();
      if (destMarkerRef.current) destMarkerRef.current.remove();

      const from = (tripStatus === "in_progress" && driverPos) ? driverPos : driverPos;
      const to = tripStatus === "in_progress" ? destPos : pickupPos;

      if (from && to) {
        geoApi.routeGeometry(from.lat, from.lng, to.lat, to.lng, rideType || "car")
          .then(data => {
            if (data.geometry?.length && mapRef.current) {
              const latlngs = data.geometry.map(([lng, lat]) => [lat, lng]);
              routePolyRef.current = L.polyline(latlngs, {
                color: COLORS.navy, weight: 4, opacity: 0.8, lineJoin: "round",
              }).addTo(mapRef.current);
              mapRef.current.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
            }
          }).catch(() => {});
      }

      // Pickup marker
      if (pickupPos) {
        const icon = L.divIcon({
          html: `<div style="background:${COLORS.navy};color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white">P</div>`,
          iconSize: [22, 22], iconAnchor: [11, 11], className: "",
        });
        pickupMarkerRef.current = L.marker([pickupPos.lat, pickupPos.lng], { icon }).addTo(mapRef.current);
      }
      // Destination marker
      if (destPos) {
        const icon = L.divIcon({
          html: `<div style="background:${COLORS.red};color:white;border-radius:50% 50% 50% 0;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:13px;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white"><span style="transform:rotate(45deg)">📍</span></div>`,
          iconSize: [26, 26], iconAnchor: [13, 26], className: "",
        });
        destMarkerRef.current = L.marker([destPos.lat, destPos.lng], { icon }).addTo(mapRef.current);
      }
    });
  }, [pickupPos, destPos, tripStatus]);

  // Live driver position update
  useEffect(() => {
    if (!mapRef.current || !driverPos) return;
    import("leaflet").then(L => {
      const emoji = rideType === "boda" ? "🏍" : "🚗";
      const icon = L.divIcon({
        html: `<div style="background:${COLORS.gold};border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 3px 10px rgba(0,0,0,0.3);border:2px solid white">${emoji}</div>`,
        iconSize: [32, 32], iconAnchor: [16, 16], className: "",
      });
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setLatLng([driverPos.lat, driverPos.lng]);
        driverMarkerRef.current.setIcon(icon);
      } else {
        driverMarkerRef.current = L.marker([driverPos.lat, driverPos.lng], { icon }).addTo(mapRef.current);
      }
      mapRef.current.setView([driverPos.lat, driverPos.lng], 15, { animate: true, duration: 1 });
    });
  }, [driverPos]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
