/**
 * FORT UBA Driver App — Uber Base Design System
 * Full-screen map, floating sheet, pure black/white palette
 */
import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import {
  authApi, ridesApi, driverApi,
  getToken, setToken, clearToken, saveUser, getUser, API_URL,
} from "../../shared/api.js";
import { DriverIdleMap, TripMap } from "./MapComponents.jsx";
import { FP_CENTER } from "../../shared/maps.js";
import { T as S } from "../../shared/ui.js";

/* ── PRIMITIVES ────────────────────────────────────────────────── */
const Screen = ({ children, style = {} }) => (
  <div style={{ position: "fixed", inset: 0, background: S.bgPrimary,
    fontFamily: S.font, color: S.primary, WebkitFontSmoothing: "antialiased", ...style }}>
    {children}
  </div>
);

const PrimaryBtn = ({ label, onClick, disabled, loading }) => (
  <button onClick={onClick} disabled={disabled || loading}
    style={{
      width: "100%", height: S.btnHeightLg,
      background: disabled || loading ? S.bgTertiary : S.black,
      color: disabled || loading ? S.tertiary : S.white,
      border: "none", borderRadius: S.radiusMd,
      fontSize: 16, fontWeight: 600, fontFamily: S.font,
      cursor: disabled || loading ? "default" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    }}>
    {loading ? <Spinner color={S.white} /> : label}
  </button>
);

const SecondaryBtn = ({ label, onClick, icon, style = {} }) => (
  <button onClick={onClick}
    style={{
      width: "100%", height: 48, background: S.bgSecondary, color: S.primary,
      border: "none", borderRadius: S.radiusMd,
      fontSize: 15, fontWeight: 600, fontFamily: S.font, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8, ...style,
    }}>
    {icon}{label}
  </button>
);

const IconBtn = ({ icon, onClick, style = {} }) => (
  <button onClick={onClick}
    style={{
      width: 44, height: 44, borderRadius: S.radiusPill,
      background: S.white, border: "none", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 12px rgba(0,0,0,0.15)", flexShrink: 0, ...style,
    }}>{icon}</button>
);

const Spinner = ({ color = S.primary, size = 20 }) => (
  <>
    <style>{`@keyframes dspin{to{transform:rotate(360deg)}}`}</style>
    <div style={{ width: size, height: size, border: `2px solid transparent`,
      borderTopColor: color, borderRadius: "50%",
      animation: "dspin 0.75s linear infinite" }} />
  </>
);

function Snackbar({ msg, type = "neutral", onDone }) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  const bg = type === "error" ? S.bgNegative : type === "positive" ? S.bgPositive : S.black;
  return (
    <div style={{
      position: "fixed", bottom: 110, left: 16, right: 16, zIndex: 9000,
      background: bg, color: S.white, borderRadius: S.radiusMd,
      padding: "14px 18px", fontSize: 14, fontWeight: 500,
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
    }}>{msg}</div>
  );
}

function Sheet({ children, height = 280, style = {} }) {
  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0, height,
      background: S.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
      display: "flex", flexDirection: "column", zIndex: 100,
      padding: "8px 20px 40px", boxSizing: "border-box", overflowY: "auto", ...style,
    }}>
      <div style={{ width: 36, height: 4, background: S.bgTertiary,
        borderRadius: 2, margin: "4px auto 16px" }} />
      {children}
    </div>
  );
}

const ListItem = ({ icon, label, sublabel, trailing }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14,
    padding: "14px 0", borderBottom: `1px solid ${S.border}` }}>
    {icon && <div style={{ width: 40, height: 40, borderRadius: S.radiusPill,
      background: S.bgSecondary, display: "flex", alignItems: "center",
      justifyContent: "center", flexShrink: 0 }}>{icon}</div>}
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 15, fontWeight: 500 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 13, color: S.secondary, marginTop: 2 }}>{sublabel}</div>}
    </div>
    {trailing}
  </div>
);

const Avatar = ({ name = "", size = 48 }) => (
  <div style={{
    width: size, height: size, borderRadius: S.radiusPill,
    background: S.black, color: S.white,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.32, fontWeight: 700, flexShrink: 0,
  }}>
    {name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?"}
  </div>
);

const StatusPill = ({ label }) => (
  <div style={{
    position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
    background: S.white, color: S.primary, borderRadius: S.radiusPill,
    padding: "10px 20px", fontSize: 14, fontWeight: 600,
    boxShadow: "0 2px 12px rgba(0,0,0,0.15)", whiteSpace: "nowrap", zIndex: 200,
  }}>{label}</div>
);

const fmt = n => "UGX " + Number(n || 0).toLocaleString();

const Ic = {
  power:   <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v10"/><path d="M6.5 6a8 8 0 1 0 11 0"/></svg>,
  moped:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6" cy="18" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.5 18h6M11 18l1.5-6h3.5l1.5 3M12.5 12l-2-4H7"/></svg>,
  car:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 16V11l2-4h12l2 4v5"/><circle cx="7.5" cy="16.5" r="1.7"/><circle cx="16.5" cy="16.5" r="1.7"/></svg>,
  pin:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/></svg>,
  dot:     <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="10"/></svg>,
  phone:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 3h3l1.5 4.5L8 9.5a12 12 0 0 0 6.5 6.5l2-2.5L21 15v3a2 2 0 0 1-2 2C10.7 20 4 13.3 4 5a2 2 0 0 1 2-2z"/></svg>,
  chat:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 5h16v11H8l-4 4V5z"/></svg>,
  check:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12l5 5 9-10"/></svg>,
  x:       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>,
  logout:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  wallet:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M15 14h3"/></svg>,
  trend:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 16l5-5 4 4 7-8"/></svg>,
  back:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>,
};

/* ── AUTH ──────────────────────────────────────────────────────── */
function PhoneScreen({ onDone }) {
  const [phone, setPhone] = useState("+256");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  async function submit() {
    setLoading(true); setErr("");
    try { await authApi.driver.sendOtp(phone); onDone(phone); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
  }
  return (
    <Screen style={{ background: S.black }}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "flex-end", padding: "24px 24px 48px" }}>
        <div style={{ position: "absolute", top: 60, left: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>
            FORT <span style={{ color: S.brandAccent }}>UBA</span>
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Driver</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: S.white, marginBottom: 6 }}>
          Enter your number
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 20 }}>
          Dev mode: OTP is 1234
        </div>
        <input value={phone} onChange={e => setPhone(e.target.value)} type="tel"
          style={{ width: "100%", height: 56, padding: "0 16px",
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: S.radiusMd, fontSize: 18, fontWeight: 600,
            color: S.white, fontFamily: S.font, outline: "none",
            boxSizing: "border-box", marginBottom: 16 }} />
        {err && <div style={{ color: "#FF6B6B", fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button onClick={submit} disabled={loading}
          style={{ width: "100%", height: 56, background: S.white, color: S.black,
            border: "none", borderRadius: S.radiusMd, fontSize: 16, fontWeight: 600,
            fontFamily: S.font, cursor: "pointer" }}>
          {loading ? "Sending…" : "Continue"}
        </button>
      </div>
    </Screen>
  );
}

function OtpScreen({ phone, onBack, onDone }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const inputs = useRef([]);
  const digits = code.padEnd(4, "").split("").slice(0, 4);

  function handleKey(i, e) {
    if (e.key === "Backspace") {
      const next = code.slice(0, -1); setCode(next);
      if (i > 0) inputs.current[i-1]?.focus();
    } else if (/^\d$/.test(e.key)) {
      const next = (code + e.key).slice(0, 4); setCode(next);
      if (i < 3) inputs.current[i+1]?.focus();
      if (next.length === 4) verify(next);
    }
  }
  async function verify(c) {
    setLoading(true); setErr("");
    try {
      const res = await authApi.driver.verifyOtp(phone, c || code);
      setToken(res.token); saveUser(res.driver); onDone(res.driver);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <Screen>
      <div style={{ padding: "52px 24px", display: "flex", flexDirection: "column",
        height: "100%", boxSizing: "border-box" }}>
        <IconBtn onClick={onBack} icon={Ic.back}
          style={{ alignSelf: "flex-start", marginBottom: 32 }} />
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Enter your code</div>
        <div style={{ fontSize: 14, color: S.secondary, marginBottom: 32 }}>Sent to {phone}</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
          {digits.map((d, i) => (
            <input key={i} ref={el => inputs.current[i] = el}
              value={d} onChange={() => {}} onKeyDown={e => handleKey(i, e)}
              inputMode="numeric" autoFocus={i === 0}
              style={{ width: 60, height: 68, textAlign: "center", fontSize: 28,
                fontWeight: 700, fontFamily: S.font,
                border: `2px solid ${d ? S.black : S.border}`,
                borderRadius: S.radiusMd, outline: "none", color: S.primary }} />
          ))}
        </div>
        {err && <div style={{ color: S.negative, fontSize: 13, textAlign: "center" }}>{err}</div>}
        <div style={{ marginTop: "auto" }}>
          <PrimaryBtn label="Verify" loading={loading} disabled={code.length < 4}
            onClick={() => verify(code)} />
        </div>
      </div>
    </Screen>
  );
}

function RegisterScreen({ driver, onDone }) {
  const [form, setForm] = useState({ name: "", driverType: "boda", vehicleReg: "", vehicleDesc: "", nationalId: "", licenseNumber: "" });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit() {
    setLoading(true);
    try { const res = await authApi.driver.register(form); saveUser(res.driver); onDone(res.driver); }
    catch {} finally { setLoading(false); }
  }

  const inputStyle = { width: "100%", height: 52, padding: "0 14px",
    border: `1px solid ${S.border}`, borderRadius: S.radiusMd,
    fontSize: 15, fontFamily: S.font, outline: "none",
    color: S.primary, boxSizing: "border-box" };

  return (
    <Screen style={{ overflowY: "auto" }}>
      <div style={{ padding: "52px 24px 40px" }}>
        <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Driver application</div>
        <div style={{ fontSize: 14, color: S.secondary, marginBottom: 24 }}>
          Reviewed by FORT UBA within 24 hours
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {["boda", "car"].map(t => (
            <button key={t} onClick={() => set("driverType", t)}
              style={{ flex: 1, height: 52, borderRadius: S.radiusMd,
                border: `2px solid ${form.driverType === t ? S.black : S.border}`,
                background: form.driverType === t ? S.black : S.white,
                color: form.driverType === t ? S.white : S.primary,
                fontWeight: 600, fontSize: 15, cursor: "pointer", fontFamily: S.font }}>
              {t === "boda" ? "🏍 Boda" : "🚗 Car"}
            </button>
          ))}
        </div>

        {[["Full name *", "name"], ["Vehicle plate *", "vehicleReg"],
          ["Vehicle (e.g. Bajaj Boxer, Red)", "vehicleDesc"],
          ["National ID number", "nationalId"],
          ["Driving permit number", "licenseNumber"]].map(([lbl, key]) => (
          <div key={key} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: S.secondary, marginBottom: 6 }}>{lbl}</div>
            <input value={form[key]} onChange={e => set(key, e.target.value)} style={inputStyle} />
          </div>
        ))}

        <div style={{ marginTop: 8 }}>
          <PrimaryBtn label="Submit application" loading={loading}
            disabled={!form.name || !form.vehicleReg} onClick={submit} />
        </div>
      </div>
    </Screen>
  );
}

function PendingScreen({ onRefresh, onLogout }) {
  return (
    <Screen style={{ display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>⏳</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Application under review</div>
      <div style={{ fontSize: 14, color: S.secondary, marginBottom: 40, maxWidth: 280 }}>
        FORT UBA is reviewing your documents. You'll be notified once approved.
      </div>
      <SecondaryBtn label="Check status" onClick={onRefresh} style={{ maxWidth: 280 }} />
      <button onClick={onLogout} style={{ marginTop: 16, background: "none", border: "none",
        fontSize: 14, color: S.secondary, cursor: "pointer", fontFamily: S.font }}>
        Sign out
      </button>
    </Screen>
  );
}

function SuspendedScreen({ onLogout }) {
  return (
    <Screen style={{ display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Account suspended</div>
      <div style={{ fontSize: 14, color: S.secondary, marginBottom: 40 }}>
        Contact FORT UBA support to resolve this.
      </div>
      <SecondaryBtn label="Sign out" onClick={onLogout} style={{ maxWidth: 280 }} />
    </Screen>
  );
}

/* ── MAIN DRIVER DASHBOARD ─────────────────────────────────────── */
function Dashboard({ driver, onLogout }) {
  const [online, setOnline] = useState(false);
  const [earnings, setEarnings] = useState(null);
  const [incomingRide, setIncomingRide] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [countdown, setCountdown] = useState(12);
  const [snack, setSnack] = useState({ msg: "", type: "neutral" });
  const posRef = useRef(FP_CENTER);

  const toast = (msg, type = "neutral") => setSnack({ msg, type });

  useEffect(() => {
    driverApi.earnings().then(r => setEarnings(r)).catch(() => {});
    ridesApi.driverActive().then(r => { if (r.ride) setActiveRide(r.ride); }).catch(() => {});
    navigator.geolocation?.watchPosition(p => {
      posRef.current = { lat: p.coords.latitude, lng: p.coords.longitude };
      if (online) driverApi.updateLocation(p.coords.latitude, p.coords.longitude).catch(() => {});
    }, () => {}, { enableHighAccuracy: true });
  }, []);

  useEffect(() => {
    const socket = io(API_URL, { auth: { token: getToken() } });
    socket.on("new_ride_request", data => {
      if (online && !activeRide && !incomingRide) { setIncomingRide(data); setCountdown(12); }
    });
    socket.on("status_changed", ({ status }) => {
      if (status === "approved") toast("Your account has been approved!", "positive");
    });
    return () => socket.disconnect();
  }, [online, activeRide, incomingRide]);

  useEffect(() => {
    if (!incomingRide) return;
    if (countdown <= 0) { setIncomingRide(null); setCountdown(12); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [incomingRide, countdown]);

  async function toggleOnline() {
    try {
      await driverApi.setAvailability(!online, posRef.current.lat, posRef.current.lng);
      setOnline(v => !v);
      toast(!online ? "You're online — waiting for trips" : "You're offline", "neutral");
    } catch (e) { toast(e.message, "error"); }
  }

  async function acceptRide() {
    if (!incomingRide) return;
    try {
      const res = await ridesApi.accept(incomingRide.rideId);
      setActiveRide(res.ride); setIncomingRide(null);
    } catch (e) { toast(e.message, "error"); setIncomingRide(null); }
  }

  async function updateTripStatus(status) {
    try {
      const res = await ridesApi.updateStatus(activeRide.id, status);
      if (status === "completed") {
        setActiveRide(null); setOnline(true);
        driverApi.earnings().then(r => setEarnings(r)).catch(() => {});
        toast(`Trip done! You earned ${fmt(res.earnings)}`, "positive");
      } else {
        setActiveRide(res.ride);
      }
    } catch (e) { toast(e.message, "error"); }
  }

  const nextAction = {
    accepted: { status: "driver_arriving", label: "Start navigation to pickup" },
    driver_arriving: { status: "driver_arrived", label: "I've arrived at pickup" },
    driver_arrived: { status: "in_progress", label: "Start trip" },
    in_progress: { status: "completed", label: "Complete trip" },
  };

  const statusLabel = {
    accepted: "Head to pickup",
    driver_arriving: "En route to pickup",
    driver_arrived: "Waiting at pickup",
    in_progress: "Trip in progress",
  };

  return (
    <Screen>
      {/* Full-screen map */}
      {activeRide ? (
        <TripMap height="100%" driverPos={posRef.current}
          pickupPos={activeRide.pickup_lat ? { lat: +activeRide.pickup_lat, lng: +activeRide.pickup_lng } : null}
          destPos={activeRide.dest_lat ? { lat: +activeRide.dest_lat, lng: +activeRide.dest_lng } : null}
          rideType={activeRide.ride_type} tripStatus={activeRide.status} />
      ) : (
        <DriverIdleMap height="100%" driverPos={posRef.current} />
      )}

      {/* Top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0,
        padding: "52px 16px 16px", display: "flex",
        justifyContent: "space-between", alignItems: "flex-start", zIndex: 200 }}>
        <div style={{ background: S.white, borderRadius: S.radiusMd,
          padding: "8px 14px", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>
            FORT<span style={{ color: S.brandAccent }}>UBA</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: S.tertiary, marginLeft: 6 }}>DRIVER</span>
          </div>
        </div>
        <IconBtn onClick={onLogout} icon={Ic.logout} />
      </div>

      {/* Active trip status pill */}
      {activeRide && <StatusPill label={statusLabel[activeRide.status] || activeRide.status} />}

      {/* Online indicator pill (when waiting) */}
      {online && !activeRide && !incomingRide && (
        <div style={{ position: "absolute", top: 16, left: "50%",
          transform: "translateX(-50%)", zIndex: 200,
          background: S.white, borderRadius: S.radiusPill,
          padding: "10px 18px", fontSize: 14, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%",
            background: S.bgPositive }} />
          Online · waiting for trips
        </div>
      )}

      {/* ── INCOMING RIDE SHEET ── */}
      {incomingRide && !activeRide && (
        <Sheet height={320}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>New trip request</div>
            {/* Countdown ring */}
            <div style={{ width: 44, height: 44, borderRadius: "50%",
              border: `3px solid ${S.black}`, display: "flex",
              alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700 }}>{countdown}</div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", padding: "12px 0", borderTop: `1px solid ${S.border}`,
            borderBottom: `1px solid ${S.border}`, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: S.secondary }}>Estimated fare</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(incomingRide.fare)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: S.secondary }}>Ride type</div>
              <div style={{ fontSize: 15, fontWeight: 600, textTransform: "capitalize" }}>
                {incomingRide.rideType}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <SecondaryBtn label="Decline" onClick={() => { setIncomingRide(null); setCountdown(12); }}
              style={{ flex: 1 }} />
            <PrimaryBtn label="Accept" onClick={acceptRide} style={{ flex: 2 }} />
          </div>
        </Sheet>
      )}

      {/* ── ACTIVE TRIP SHEET ── */}
      {activeRide && !incomingRide && (
        <Sheet height={260}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <Avatar name={activeRide.rider_name} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{activeRide.rider_name}</div>
              <div style={{ fontSize: 13, color: S.secondary }}>
                {activeRide.pickup_address?.split(",")[0]} → {activeRide.dest_address?.split(",")[0]}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{fmt(activeRide.fare_estimate)}</div>
              <div style={{ fontSize: 12, color: S.tertiary }}>fare</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <SecondaryBtn label="Call" icon={Ic.phone} style={{ flex: 1, height: 44, fontSize: 14 }} />
            <SecondaryBtn label="Chat" icon={Ic.chat} style={{ flex: 1, height: 44, fontSize: 14 }} />
          </div>
          {nextAction[activeRide.status] && (
            <PrimaryBtn label={nextAction[activeRide.status].label}
              onClick={() => updateTripStatus(nextAction[activeRide.status].status)} />
          )}
        </Sheet>
      )}

      {/* ── IDLE / ONLINE TOGGLE SHEET ── */}
      {!activeRide && !incomingRide && (
        <Sheet height={280}>
          {/* Earnings row */}
          <div style={{ display: "flex", gap: 1, marginBottom: 20 }}>
            {[
              ["Today", fmt(earnings?.today?.earnings), `${earnings?.today?.trips || 0} trips`],
              ["This week", fmt(earnings?.week?.earnings), `${earnings?.week?.trips || 0} trips`],
              ["Rating", `⭐ ${Number(earnings?.rating || 5).toFixed(1)}`, "all time"],
            ].map(([label, val, sub]) => (
              <div key={label} style={{ flex: 1, padding: "12px 0",
                borderRight: `1px solid ${S.border}`, paddingRight: 12,
                "&:last-child": { borderRight: "none" } }}>
                <div style={{ fontSize: 11, color: S.tertiary, textTransform: "uppercase",
                  letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{val}</div>
                <div style={{ fontSize: 11, color: S.secondary }}>{sub}</div>
              </div>
            ))}
          </div>

          {earnings?.commissionBalance < 0 && (
            <div style={{ background: `${S.bgNegative}15`, border: `1px solid ${S.bgNegative}40`,
              borderRadius: S.radiusMd, padding: "10px 14px", marginBottom: 14,
              fontSize: 13, color: S.negative }}>
              ⚠ Outstanding balance: {fmt(Math.abs(earnings.commissionBalance))} — settle to stay online
            </div>
          )}

          {/* Big go online/offline button */}
          <button onClick={toggleOnline}
            style={{
              width: "100%", height: 56, borderRadius: S.radiusMd,
              background: online ? S.bgSecondary : S.black,
              color: online ? S.primary : S.white,
              border: online ? `1px solid ${S.border}` : "none",
              fontSize: 16, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 12, fontFamily: S.font, transition: "all 0.2s",
            }}>
            <span style={{ color: "inherit" }}>{Ic.power}</span>
            {online ? "Go offline" : "Go online"}
          </button>
        </Sheet>
      )}

      <Snackbar msg={snack.msg} type={snack.type} onDone={() => setSnack({ msg: "", type: "neutral" })} />
    </Screen>
  );
}

/* ── ROOT ───────────────────────────────────────────────────────── */
export default function App() {
  const [screen, setScreen] = useState("loading");
  const [driver, setDriver] = useState(null);
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const token = getToken(), saved = getUser();
    if (token && saved) {
      driverApi.me().then(r => { setDriver(r.driver); saveUser(r.driver); setScreen("dashboard"); })
        .catch(() => { setDriver(saved); setScreen("dashboard"); });
    } else { setScreen("phone"); }
  }, []);

  async function refreshDriver() {
    try { const r = await driverApi.me(); setDriver(r.driver); saveUser(r.driver); } catch {}
  }

  if (screen === "loading") return (
    <div style={{ background: S.black, height: "100dvh", fontFamily: S.font,
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner color={S.white} size={32} />
    </div>
  );
  if (screen === "phone")   return <PhoneScreen onDone={p => { setPhone(p); setScreen("otp"); }} />;
  if (screen === "otp")     return <OtpScreen phone={phone} onBack={() => setScreen("phone")}
    onDone={d => { setDriver(d); setScreen(d.isNew || !d.name ? "register" : "dashboard"); }} />;
  if (screen === "register") return <RegisterScreen driver={driver}
    onDone={d => { setDriver(d); setScreen("dashboard"); }} />;
  if (!driver) return null;
  if (driver.status === "pending") return <PendingScreen
    onRefresh={refreshDriver}
    onLogout={() => { clearToken(); setScreen("phone"); }} />;
  if (["suspended", "rejected"].includes(driver.status)) return <SuspendedScreen
    onLogout={() => { clearToken(); setScreen("phone"); }} />;
  return <Dashboard driver={driver} onLogout={() => { clearToken(); setDriver(null); setScreen("phone"); }} />;
}
