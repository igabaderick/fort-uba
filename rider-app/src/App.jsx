/**
 * FORT UBA Rider App
 * UI based on Uber Base Design System:
 * - Full-screen map with floating bottom sheet
 * - Pure black/white palette
 * - 56px primary buttons, pinned at bottom
 * - Bottom sheet with snap points + drag gesture
 * - PIN code OTP, clean list items, snackbar toasts
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import {
  authApi, ridesApi, userApi, geoApi,
  getToken, setToken, clearToken, saveUser, getUser, API_URL,
} from "../../shared/api.js";
import { HomeMap, BookingMap, TrackingMap, AddressSearch } from "./MapComponents.jsx";
import { FP_CENTER, FP_LANDMARKS } from "../../shared/maps.js";
import { T } from "../../shared/ui.js";

const S = T; // alias for brevity

/* ── PRIMITIVE COMPONENTS ─────────────────────────────────────── */

// Full-screen container
const Screen = ({ children, style = {} }) => (
  <div style={{
    position: "fixed", inset: 0, background: S.bgPrimary,
    fontFamily: S.font, color: S.primary, overflowY: "auto",
    WebkitFontSmoothing: "antialiased", ...style,
  }}>{children}</div>
);

// Primary button — full width, black, 56px, Uber spec
const PrimaryBtn = ({ label, onClick, disabled, loading, icon }) => (
  <button onClick={onClick} disabled={disabled || loading}
    style={{
      width: "100%", height: 56, background: disabled || loading ? S.bgTertiary : S.black,
      color: disabled || loading ? S.tertiary : S.white,
      border: "none", borderRadius: S.radiusMd, fontSize: 16, fontWeight: 600,
      fontFamily: S.font, cursor: disabled || loading ? "default" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      transition: `background 0.15s`, letterSpacing: "-0.01em",
    }}>
    {loading ? <Spinner color={S.white} /> : icon}
    {label}
  </button>
);

// Secondary button — grey bg
const SecondaryBtn = ({ label, onClick, icon, style = {} }) => (
  <button onClick={onClick}
    style={{
      width: "100%", height: 56, background: S.bgSecondary, color: S.primary,
      border: "none", borderRadius: S.radiusMd, fontSize: 16, fontWeight: 600,
      fontFamily: S.font, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      ...style,
    }}>
    {icon}{label}
  </button>
);

// Floating icon button (map overlays, back buttons)
const IconBtn = ({ icon, onClick, style = {} }) => (
  <button onClick={onClick}
    style={{
      width: 44, height: 44, borderRadius: S.radiusPill,
      background: S.white, border: "none", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 2px 12px rgba(0,0,0,0.15)", flexShrink: 0, ...style,
    }}>
    {icon}
  </button>
);

// Spinner
const Spinner = ({ color = S.primary, size = 18 }) => (
  <>
    <style>{`@keyframes _spin{to{transform:rotate(360deg)}}`}</style>
    <div style={{
      width: size, height: size, border: `2px solid transparent`,
      borderTopColor: color, borderRadius: "50%",
      animation: "_spin 0.75s linear infinite", flexShrink: 0,
    }} />
  </>
);

// Snackbar toast — slides up from bottom, auto-dismisses
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
      position: "fixed", bottom: 90, left: 16, right: 16, zIndex: 9000,
      background: bg, color: S.white, borderRadius: S.radiusMd,
      padding: "14px 18px", fontSize: 14, fontWeight: 500,
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      animation: `_snack ${S.easeOut} 0.3s`,
    }}>
      <style>{`@keyframes _snack{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}`}</style>
      {msg}
    </div>
  );
}

// Bottom sheet with drag handle — Uber sheet pattern
function Sheet({ children, snapPoints = [240, 420], initialSnap = 0, style = {} }) {
  const [height, setHeight] = useState(snapPoints[initialSnap]);
  const dragStart = useRef(null);

  function onPointerDown(e) {
    dragStart.current = { y: e.clientY, h: height };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }
  function onPointerMove(e) {
    if (!dragStart.current) return;
    const delta = dragStart.current.y - e.clientY;
    const newH = Math.max(snapPoints[0], Math.min(snapPoints[snapPoints.length - 1], dragStart.current.h + delta));
    setHeight(newH);
  }
  function onPointerUp() {
    dragStart.current = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    // Snap to nearest
    setHeight(h => {
      const nearest = snapPoints.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a);
      return nearest;
    });
  }

  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 0,
      height, background: S.white,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      boxShadow: "0 -4px 20px rgba(0,0,0,0.1)",
      transition: `height ${S.duration} ${S.easeOut}`,
      display: "flex", flexDirection: "column", zIndex: 100, ...style,
    }}>
      {/* Grab handle */}
      <div onPointerDown={onPointerDown}
        style={{ padding: "12px 0 8px", display: "flex", justifyContent: "center",
          cursor: "grab", flexShrink: 0 }}>
        <div style={{ width: 36, height: 4, background: S.bgTertiary, borderRadius: 2 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 32px" }}>
        {children}
      </div>
    </div>
  );
}

// List item row — Uber list-item pattern
const ListItem = ({ icon, label, sublabel, trailing, onClick, style = {} }) => (
  <div onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 0", cursor: onClick ? "pointer" : "default",
      borderBottom: `1px solid ${S.border}`, ...style,
    }}>
    {icon && (
      <div style={{
        width: 40, height: 40, borderRadius: S.radiusPill,
        background: S.bgSecondary, display: "flex",
        alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{icon}</div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: S.primary }}>{label}</div>
      {sublabel && <div style={{ fontSize: 13, color: S.secondary, marginTop: 2 }}>{sublabel}</div>}
    </div>
    {trailing}
  </div>
);

// Section label
const SectionLabel = ({ text }) => (
  <div style={{ fontSize: 13, fontWeight: 700, color: S.secondary,
    textTransform: "uppercase", letterSpacing: "0.06em",
    padding: "18px 0 6px" }}>{text}</div>
);

// Divider
const Divider = () => <div style={{ height: 1, background: S.border, margin: "4px 0" }} />;

// Avatar initials
const Avatar = ({ name = "", size = 44 }) => {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: S.radiusPill,
      background: S.black, color: S.white,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.32, fontWeight: 700, flexShrink: 0,
    }}>{initials || "?"}</div>
  );
};

// Star row
const Stars = ({ count, onRate }) => (
  <div style={{ display: "flex", gap: 8 }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} onClick={() => onRate?.(i)}
        style={{ fontSize: 32, cursor: onRate ? "pointer" : "default",
          color: i <= count ? S.black : S.bgTertiary, transition: "color 0.1s" }}>
        ★
      </span>
    ))}
  </div>
);

// PIN code input — Uber PIN code pattern
function PinInput({ length = 4, value, onChange }) {
  const inputs = useRef([]);
  const digits = value.padEnd(length, "").split("").slice(0, length);

  function handleKey(i, e) {
    if (e.key === "Backspace") {
      const next = value.slice(0, -1);
      onChange(next);
      if (i > 0) inputs.current[i - 1]?.focus();
    } else if (/^\d$/.test(e.key)) {
      const next = (value + e.key).slice(0, length);
      onChange(next);
      if (i < length - 1) inputs.current[i + 1]?.focus();
    }
  }

  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
      {digits.map((d, i) => (
        <input key={i}
          ref={el => inputs.current[i] = el}
          value={d}
          onChange={() => {}}
          onKeyDown={e => handleKey(i, e)}
          inputMode="numeric"
          autoFocus={i === 0}
          style={{
            width: 56, height: 64, textAlign: "center",
            fontSize: 28, fontWeight: 700, fontFamily: S.font,
            border: `2px solid ${d ? S.black : S.border}`,
            borderRadius: S.radiusMd, outline: "none",
            background: S.white, color: S.primary,
            transition: "border-color 0.15s",
          }}
        />
      ))}
    </div>
  );
}

// Floating map overlay pill (status label during ride)
const StatusPill = ({ label }) => (
  <div style={{
    position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
    background: S.white, color: S.primary,
    borderRadius: S.radiusPill, padding: "10px 20px",
    fontSize: 14, fontWeight: 600,
    boxShadow: "0 2px 12px rgba(0,0,0,0.15)", whiteSpace: "nowrap", zIndex: 200,
  }}>{label}</div>
);

// Back button overlay (floats over map)
const BackBtn = ({ onClick }) => (
  <div style={{ position: "absolute", top: 16, left: 16, zIndex: 200 }}>
    <IconBtn onClick={onClick} icon={
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke={S.primary} strokeWidth="2.5" strokeLinecap="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    }/>
  </div>
);

// Thin section divider for sheet content
const SheetDivider = () => (
  <div style={{ height: 1, background: S.border, margin: "8px -20px" }} />
);

function fmt(n) { return "UGX " + Number(n || 0).toLocaleString(); }

/* ── ICONS (minimal, Uber-style strokes) ──────────────────────── */
const Ic = {
  pin:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>,
  home:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9z"/></svg>,
  work:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="8" width="18" height="11" rx="1.5"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  search:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>,
  history:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  clock:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  moped:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6" cy="18" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="M8.5 18h6M11 18l1.5-6h3.5l1.5 3M12.5 12l-2-4H7"/></svg>,
  car:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 16V11l2-4h12l2 4v5"/><circle cx="7.5" cy="16.5" r="1.7"/><circle cx="16.5" cy="16.5" r="1.7"/></svg>,
  phone:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 3h3l1.5 4.5L8 9.5a12 12 0 0 0 6.5 6.5l2-2.5L21 15v3a2 2 0 0 1-2 2C10.7 20 4 13.3 4 5a2 2 0 0 1 2-2z"/></svg>,
  chat:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 5h16v11H8l-4 4V5z"/></svg>,
  shield:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/></svg>,
  check:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12l5 5 9-10"/></svg>,
  chevronR: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>,
  x:        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>,
  dot:      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="10"/></svg>,
  person:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>,
  logout:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
};

/* ── AUTH: PHONE ENTRY ────────────────────────────────────────── */
function PhoneScreen({ onDone }) {
  const [phone, setPhone] = useState("+256");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (phone.length < 10) return setErr("Enter a valid phone number");
    setLoading(true); setErr("");
    try { await authApi.rider.sendOtp(phone); onDone(phone); }
    catch (e) { setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <Screen style={{ background: S.black }}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "flex-end", padding: 24, paddingBottom: 48 }}>
        {/* Logo */}
        <div style={{ position: "absolute", top: 60, left: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: S.white, letterSpacing: "-0.03em" }}>
            FORT <span style={{ color: S.brandAccent }}>UBA</span>
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
            Rides in Fort Portal, Uganda
          </div>
        </div>

        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: S.white,
            marginBottom: 6, letterSpacing: "-0.02em" }}>
            What's your number?
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
            We'll send a verification code — works with MTN & Airtel
          </div>
          <input value={phone} onChange={e => setPhone(e.target.value)}
            type="tel" autoFocus
            style={{
              width: "100%", height: 56, padding: "0 16px",
              background: "rgba(255,255,255,0.1)", border: `2px solid ${err ? S.bgNegative : "rgba(255,255,255,0.15)"}`,
              borderRadius: S.radiusMd, fontSize: 18, fontWeight: 600,
              color: S.white, fontFamily: S.font, outline: "none", boxSizing: "border-box",
              marginBottom: 6,
            }} />
          {err && <div style={{ fontSize: 13, color: "#FF6B6B", marginBottom: 12 }}>{err}</div>}
          <div style={{ marginTop: 16 }}>
            <PrimaryBtn label={loading ? "" : "Continue"} loading={loading} onClick={submit}
              style={{ background: S.white, color: S.black }} />
          </div>
        </div>
      </div>
    </Screen>
  );
}

/* ── AUTH: OTP VERIFICATION ───────────────────────────────────── */
function OtpScreen({ phone, onBack, onDone }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (code.length < 4) return setErr("Enter the 4-digit code");
    setLoading(true); setErr("");
    try {
      const res = await authApi.rider.verifyOtp(phone, code);
      setToken(res.token); saveUser(res.user); onDone(res.user);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }

  return (
    <Screen>
      <div style={{ padding: "60px 24px 24px", display: "flex", flexDirection: "column",
        height: "100%", boxSizing: "border-box" }}>
        <IconBtn onClick={onBack} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={S.primary} strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        } style={{ alignSelf: "flex-start", marginBottom: 32 }} />

        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>
          Enter your code
        </div>
        <div style={{ fontSize: 14, color: S.secondary, marginBottom: 36 }}>
          Sent to {phone}
          <span style={{ display: "block", fontSize: 12, color: S.tertiary, marginTop: 4 }}>
            Dev mode: use 1234
          </span>
        </div>

        <PinInput length={4} value={code} onChange={setCode} />

        {err && <div style={{ fontSize: 13, color: S.negative, textAlign: "center", marginTop: 16 }}>{err}</div>}

        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          <PrimaryBtn label="Verify" loading={loading} onClick={submit}
            disabled={code.length < 4} />
        </div>
      </div>
    </Screen>
  );
}

/* ── AUTH: PROFILE SETUP ──────────────────────────────────────── */
function ProfileSetupScreen({ user, onDone }) {
  const [name, setName] = useState("");
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await authApi.rider.completeProfile({ name, emergencyContactName: ecName, emergencyContactPhone: ecPhone });
      const u = { ...user, name }; saveUser(u); onDone(u);
    } catch {} finally { setLoading(false); }
  }

  const inputStyle = {
    width: "100%", height: 56, padding: "0 16px",
    border: `1px solid ${S.border}`, borderRadius: S.radiusMd,
    fontSize: 16, fontFamily: S.font, outline: "none",
    background: S.white, color: S.primary, boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: S.secondary, marginBottom: 6 };

  return (
    <Screen>
      <div style={{ padding: "60px 24px 32px", display: "flex",
        flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em" }}>
          Set up your profile
        </div>
        <div style={{ fontSize: 14, color: S.secondary, marginBottom: 32 }}>
          Just a few details to get you started
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={labelStyle}>Your name *</div>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle}
              placeholder="Diana Kyomugisha" autoFocus />
          </div>
          <div>
            <div style={labelStyle}>Emergency contact name</div>
            <input value={ecName} onChange={e => setEcName(e.target.value)} style={inputStyle}
              placeholder="Optional" />
          </div>
          <div>
            <div style={labelStyle}>Emergency contact phone</div>
            <input value={ecPhone} onChange={e => setEcPhone(e.target.value)} style={inputStyle}
              placeholder="+256 700 000 000" />
          </div>
        </div>

        <div style={{ marginTop: "auto", paddingTop: 24 }}>
          <PrimaryBtn label="Get started" loading={loading} onClick={submit}
            disabled={!name.trim()} />
        </div>
      </div>
    </Screen>
  );
}

/* ── HOME SCREEN — map full screen, sheet floats over ─────────── */
function HomeScreen({ user, onBook, onHistory, onLogout }) {
  const [places, setPlaces] = useState([]);
  const [pos, setPos] = useState(FP_CENTER);
  const [snack, setSnack] = useState("");

  useEffect(() => {
    userApi.savedPlaces().then(r => setPlaces(r.places)).catch(() => {});
    navigator.geolocation?.getCurrentPosition(
      p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}
    );
  }, []);

  return (
    <Screen>
      {/* Full-screen map */}
      <HomeMap height="100%" riderPos={pos} />

      {/* Top bar floating over map */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0,
        padding: "52px 16px 16px", display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", zIndex: 200 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: S.black,
          background: S.white, borderRadius: S.radiusMd, padding: "8px 14px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.1)", letterSpacing: "-0.02em" }}>
          FORT<span style={{ color: S.brandAccent }}>UBA</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <IconBtn onClick={onHistory} icon={Ic.history} />
          <IconBtn onClick={onLogout} icon={Ic.logout} />
        </div>
      </div>

      {/* Bottom Sheet */}
      <Sheet snapPoints={[200, 380]} initialSnap={0}>
        {/* "Where to?" tap target — Uber's main CTA */}
        <div onClick={onBook}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            background: S.bgSecondary, borderRadius: S.radiusMd,
            padding: "16px 18px", cursor: "pointer", marginBottom: 4,
          }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%",
            background: S.black, flexShrink: 0 }} />
          <span style={{ fontSize: 16, fontWeight: 500, color: S.secondary }}>
            Where to?
          </span>
        </div>

        {/* Saved places */}
        {places.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {places.slice(0, 2).map(p => (
              <div key={p.id} onClick={() => onBook(p)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 10,
                  background: S.bgSecondary, borderRadius: S.radiusMd,
                  padding: "12px 14px", cursor: "pointer",
                }}>
                <div style={{ width: 32, height: 32, borderRadius: S.radiusPill,
                  background: S.bgTertiary, display: "flex",
                  alignItems: "center", justifyContent: "center", color: S.primary }}>
                  {p.label === "Home" ? Ic.home : Ic.work}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: S.secondary }}>{p.address?.split(",")[0] || "Saved"}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <SectionLabel text="Popular nearby" />
        {FP_LANDMARKS.slice(0, 4).map(p => (
          <ListItem key={p.displayName}
            icon={<span style={{ color: S.primary }}>{Ic.pin}</span>}
            label={p.displayName}
            trailing={<span style={{ color: S.tertiary }}>{Ic.chevronR}</span>}
            onClick={() => onBook({ address: p.displayName, lat: p.lat, lng: p.lng })}
          />
        ))}
      </Sheet>

      <Snackbar msg={snack} onDone={() => setSnack("")} />
    </Screen>
  );
}

/* ── BOOKING SCREEN ───────────────────────────────────────────── */
function BookingScreen({ prefill, onBack, onConfirm }) {
  const [destText, setDestText] = useState(prefill?.address || prefill?.displayName || "");
  const [destCoords, setDestCoords] = useState(prefill?.lat ? { lat: prefill.lat, lng: prefill.lng } : null);
  const [rideType, setRideType] = useState("boda");
  const [payment, setPayment] = useState("cash");
  const [estimate, setEstimate] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [pos, setPos] = useState(FP_CENTER);
  const [pickupLabel, setPickupLabel] = useState("Current location");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(p => {
      const c = { lat: p.coords.latitude, lng: p.coords.longitude };
      setPos(c);
      geoApi.reverse(c.lat, c.lng).then(r => r.displayName && setPickupLabel(r.displayName)).catch(() => {});
    }, () => {});
  }, []);

  useEffect(() => {
    if (!destCoords) return;
    ridesApi.estimate(pos.lat, pos.lng, destCoords.lat, destCoords.lng)
      .then(r => setEstimate(r)).catch(() => {});
  }, [destCoords, pos.lat, pos.lng]);

  async function confirm() {
    if (!destCoords) return setErr("Select a destination");
    setLoading(true); setErr("");
    try {
      const res = await ridesApi.request({
        pickupLat: pos.lat, pickupLng: pos.lng, pickupAddress: pickupLabel,
        destLat: destCoords.lat, destLng: destCoords.lng, destAddress: destText,
        rideType, paymentMethod: payment,
      });
      onConfirm(res.ride);
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  }

  const rides = [
    { id: "boda", name: "Boda boda", icon: Ic.moped, desc: "Motorcycle · 1 rider", eta: "~3 min" },
    { id: "car",  name: "Car",       icon: Ic.car,   desc: "Up to 4 riders",       eta: "~6 min" },
  ];

  return (
    <Screen>
      {/* Full-screen map with route */}
      <BookingMap height="100%" pickup={pos} destination={destCoords}
        rideType={rideType} onRouteInfo={setRouteInfo} />

      <BackBtn onClick={onBack} />

      {/* Bottom sheet — address inputs + ride options */}
      <Sheet snapPoints={[380, 520]} initialSnap={0}>
        {/* Pickup + Destination */}
        <div style={{ background: S.bgSecondary, borderRadius: S.radiusMd,
          padding: "4px 0", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%",
              background: S.black, flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: S.secondary, flex: 1 }}>{pickupLabel}</span>
          </div>
          <div style={{ height: 1, background: S.border, margin: "0 16px" }} />
          <div style={{ padding: "4px 8px 4px" }}>
            <AddressSearch value={destText} onChange={setDestText}
              onSelect={p => { setDestText(p.displayName); setDestCoords({ lat: p.lat, lng: p.lng }); }}
              placeholder="Where to?" />
          </div>
        </div>

        {/* Route info pill */}
        {routeInfo && (
          <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: S.secondary }}>
              📏 {routeInfo.distanceKm} km
            </span>
            <span style={{ fontSize: 13, color: S.secondary }}>
              ⏱ ~{routeInfo.durationMin} min
            </span>
          </div>
        )}

        {err && <div style={{ fontSize: 13, color: S.negative, marginBottom: 12 }}>{err}</div>}

        {/* Ride type selector */}
        {rides.map(r => (
          <div key={r.id} onClick={() => setRideType(r.id)}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "16px 14px", borderRadius: S.radiusMd, cursor: "pointer",
              border: `2px solid ${rideType === r.id ? S.black : S.border}`,
              background: rideType === r.id ? S.bgSecondary : S.white,
              marginBottom: 10, transition: "border-color 0.15s",
            }}>
            <div style={{ color: S.primary }}>{r.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 12, color: S.secondary, marginTop: 2 }}>
                {r.eta} · {r.desc}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {estimate ? fmt(r.id === "boda" ? estimate.boda : estimate.car) : "—"}
              </div>
              {estimate && <div style={{ fontSize: 11, color: S.tertiary }}>{estimate.distanceKm} km road</div>}
            </div>
          </div>
        ))}

        {/* Payment toggle */}
        <div onClick={() => setPayment(p => p === "cash" ? "momo" : "cash")}
          style={{ display: "flex", justifyContent: "space-between",
            alignItems: "center", padding: "12px 0", cursor: "pointer" }}>
          <span style={{ fontSize: 14, color: S.secondary }}>Payment</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>
              {payment === "momo" ? "Mobile Money" : "Cash"}
            </span>
            <span style={{ fontSize: 12, color: S.brand, fontWeight: 600 }}>Change</span>
          </div>
        </div>

        <div style={{ paddingTop: 8 }}>
          <PrimaryBtn
            label={loading ? "" : `Confirm ${rideType === "boda" ? "Boda" : "Car"}${estimate ? " · " + fmt(rideType === "boda" ? estimate.boda : estimate.car) : ""}`}
            loading={loading}
            disabled={!destCoords}
            onClick={confirm}
          />
        </div>
      </Sheet>
    </Screen>
  );
}

/* ── ACTIVE RIDE SCREEN ───────────────────────────────────────── */
function ActiveRideScreen({ ride, onComplete, onCancel }) {
  const [current, setCurrent] = useState(ride);
  const [driverPos, setDriverPos] = useState(null);
  const [rating, setRating] = useState(0);
  const [ratingDone, setRatingDone] = useState(false);

  useEffect(() => {
    const socket = io(API_URL, { auth: { token: getToken() } });
    socket.on("ride_accepted", ({ ride: r, driver }) =>
      setCurrent(p => ({ ...p, ...r, driver_name: driver?.name, vehicle_desc: driver?.vehicle_desc,
        vehicle_reg: driver?.vehicle_reg, driver_rating_avg: driver?.rating, driver_total_trips: driver?.total_trips }))
    );
    socket.on("ride_status", ({ status }) => setCurrent(p => ({ ...p, status })));
    socket.on("ride_completed", ({ ride: r }) => setCurrent(p => ({ ...p, ...r, status: "completed" })));
    socket.on("ride_cancelled", () => setCurrent(p => ({ ...p, status: "cancelled" })));
    socket.on("driver_location", ({ driverId, lat, lng }) => {
      setCurrent(c => { if (c.driver_id === driverId) setDriverPos({ lat, lng }); return c; });
    });
    const poll = setInterval(async () => {
      try {
        const res = await ridesApi.myActive();
        if (res.ride) {
          setCurrent(res.ride);
          if (res.ride.driver_lat) setDriverPos({ lat: +res.ride.driver_lat, lng: +res.ride.driver_lng });
        }
      } catch {}
    }, 5000);
    return () => { socket.disconnect(); clearInterval(poll); };
  }, []);

  async function submitRating(stars) {
    setRating(stars);
    try { await ridesApi.rate(current.id, stars); } catch {}
    setRatingDone(true);
    setTimeout(onComplete, 2000);
  }
  async function cancel() {
    try { await ridesApi.cancel(current.id, "Rider cancelled"); onCancel(); } catch {}
  }

  const statusLabels = {
    requested: "Finding your driver…",
    matching: "Matching you with a driver…",
    accepted: "Driver on the way",
    driver_arriving: "Driver arriving",
    driver_arrived: "Driver is here",
    in_progress: "Trip in progress",
  };

  const pickupPos = current.pickup_lat ? { lat: +current.pickup_lat, lng: +current.pickup_lng } : null;
  const destPos   = current.dest_lat   ? { lat: +current.dest_lat,   lng: +current.dest_lng   } : null;

  /* ── TRIP COMPLETE ── */
  if (current.status === "completed") return (
    <Screen style={{ padding: "60px 24px 48px", display: "flex",
      flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div style={{ width: 64, height: 64, borderRadius: S.radiusPill,
        background: S.bgSecondary, display: "flex", alignItems: "center",
        justifyContent: "center", marginBottom: 20, color: S.primary }}>
        {Ic.check}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 6, letterSpacing: "-0.02em" }}>
        You've arrived
      </div>
      <div style={{ fontSize: 14, color: S.secondary, marginBottom: 32 }}>
        {current.dest_address}
      </div>

      <div style={{ width: "100%", background: S.bgSecondary, borderRadius: S.radiusLg,
        padding: 20, marginBottom: 32 }}>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em" }}>
          {fmt(current.fare_final || current.fare_estimate)}
        </div>
        <div style={{ fontSize: 13, color: S.secondary, marginTop: 4 }}>
          {current.payment_method === "momo" ? "Paid via Mobile Money" : "Cash payment"}
        </div>
      </div>

      {!ratingDone && (
        <div style={{ width: "100%", marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            How was {current.driver_name}?
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Stars count={rating} onRate={submitRating} />
          </div>
        </div>
      )}
      {ratingDone && (
        <div style={{ fontSize: 14, color: S.positive, fontWeight: 600, marginBottom: 24 }}>
          ✓ Thanks for rating!
        </div>
      )}

      <div style={{ width: "100%", marginTop: "auto" }}>
        <PrimaryBtn label="Done" onClick={onComplete} />
      </div>
    </Screen>
  );

  /* ── CANCELLED ── */
  if (current.status === "cancelled") return (
    <Screen style={{ padding: "60px 24px 48px", display: "flex",
      flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✕</div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Ride cancelled</div>
      <div style={{ fontSize: 14, color: S.secondary, marginBottom: 40 }}>
        {current.cancelled_by === "driver"
          ? "Your driver cancelled. We'll find you another."
          : "Your ride has been cancelled."}
      </div>
      <div style={{ width: "100%" }}>
        <PrimaryBtn label="Back to home" onClick={onCancel} />
      </div>
    </Screen>
  );

  /* ── ACTIVE / TRACKING ── */
  return (
    <Screen>
      <TrackingMap height="100%" driverPos={driverPos || pickupPos}
        pickupPos={pickupPos} destPos={destPos} rideType={current.ride_type} />

      <StatusPill label={statusLabels[current.status] || current.status} />

      <Sheet snapPoints={[180, 340]} initialSnap={0}>
        {/* Waiting for driver */}
        {(current.status === "requested" || current.status === "matching") && (
          <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
            <Spinner size={28} />
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 16 }}>
              Finding your driver
            </div>
            <div style={{ fontSize: 13, color: S.secondary, marginTop: 6, marginBottom: 24 }}>
              Matching you with a nearby {current.ride_type}
            </div>
            <SecondaryBtn label="Cancel" onClick={cancel} />
          </div>
        )}

        {/* Driver assigned */}
        {!["requested", "matching"].includes(current.status) && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 16 }}>
              <Avatar name={current.driver_name} size={52} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{current.driver_name}</div>
                <div style={{ fontSize: 13, color: S.secondary }}>
                  ⭐ {Number(current.driver_rating_avg || 5).toFixed(1)}
                  <span style={{ marginLeft: 8 }}>{current.vehicle_reg}</span>
                </div>
                <div style={{ fontSize: 12, color: S.tertiary }}>{current.vehicle_desc}</div>
              </div>
            </div>

            <SheetDivider />

            <div style={{ display: "flex", gap: 10, paddingTop: 16 }}>
              <SecondaryBtn label="Call" icon={<span style={{ marginRight: 4 }}>{Ic.phone}</span>}
                style={{ flex: 1, height: 48, fontSize: 14 }} />
              <SecondaryBtn label="Chat" icon={<span style={{ marginRight: 4 }}>{Ic.chat}</span>}
                style={{ flex: 1, height: 48, fontSize: 14 }} />
            </div>

            {/* Safety notice */}
            <div style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", background: S.bgSecondary,
              borderRadius: S.radiusMd, marginTop: 12 }}>
              <span style={{ color: S.primary, flexShrink: 0 }}>{Ic.shield}</span>
              <span style={{ fontSize: 12, color: S.secondary }}>
                Trip shared with your emergency contact
              </span>
            </div>

            {["accepted", "driver_arriving"].includes(current.status) && (
              <div style={{ marginTop: 12 }}>
                <SecondaryBtn label="Cancel ride" onClick={cancel} />
              </div>
            )}
          </>
        )}
      </Sheet>
    </Screen>
  );
}

/* ── HISTORY SCREEN ───────────────────────────────────────────── */
function HistoryScreen({ onBack }) {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    ridesApi.myHistory().then(r => setRides(r.rides)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <Screen>
      <div style={{ padding: "52px 20px 20px", borderBottom: `1px solid ${S.border}`,
        display: "flex", alignItems: "center", gap: 14 }}>
        <IconBtn onClick={onBack} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={S.primary} strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        } />
        <span style={{ fontSize: 18, fontWeight: 700 }}>Your trips</span>
      </div>

      <div style={{ padding: "0 20px" }}>
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
            <Spinner size={28} />
          </div>
        )}
        {!loading && rides.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: S.secondary }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛵</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>No trips yet</div>
            <div style={{ fontSize: 14, marginTop: 6 }}>Your ride history will appear here</div>
          </div>
        )}
        {rides.map(r => (
          <ListItem key={r.id}
            icon={r.ride_type === "boda" ? Ic.moped : Ic.car}
            label={`${r.pickup_address?.split(",")[0]} → ${r.dest_address?.split(",")[0]}`}
            sublabel={`${r.status} · ${r.driver_name || "—"}`}
            trailing={
              <div style={{ textAlign: "right" }}>
                {r.status === "completed" && (
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(r.fare_final)}</div>
                )}
                <div style={{ fontSize: 11, color: S.tertiary }}>
                  {new Date(r.created_at).toLocaleDateString()}
                </div>
              </div>
            }
          />
        ))}
      </div>
    </Screen>
  );
}

/* ── ROOT APP ─────────────────────────────────────────────────── */
export default function App() {
  const [screen, setScreen] = useState("loading");
  const [user, setUser] = useState(null);
  const [phone, setPhone] = useState("");
  const [activeRide, setActiveRide] = useState(null);
  const [prefill, setPrefill] = useState(null);

  useEffect(() => {
    const token = getToken(), saved = getUser();
    if (token && saved) {
      setUser(saved);
      ridesApi.myActive()
        .then(r => { if (r.ride) setActiveRide(r.ride); setScreen("home"); })
        .catch(() => setScreen("home"));
    } else {
      setScreen("phone");
    }
  }, []);

  if (screen === "loading") return (
    <div style={{ background: S.black, height: "100dvh", fontFamily: S.font,
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner color={S.white} size={32} />
    </div>
  );

  if (screen === "phone") return <PhoneScreen onDone={p => { setPhone(p); setScreen("otp"); }} />;
  if (screen === "otp")   return <OtpScreen phone={phone} onBack={() => setScreen("phone")}
    onDone={u => { setUser(u); setScreen(u.isNew ? "profile" : "home"); }} />;
  if (screen === "profile") return <ProfileSetupScreen user={user}
    onDone={u => { setUser(u); setScreen("home"); }} />;
  if (screen === "history") return <HistoryScreen onBack={() => setScreen("home")} />;
  if (screen === "booking") return <BookingScreen prefill={prefill}
    onBack={() => setScreen("home")}
    onConfirm={r => { setActiveRide(r); setScreen("active"); }} />;
  if (screen === "active" && activeRide) return <ActiveRideScreen ride={activeRide}
    onComplete={() => { setActiveRide(null); setScreen("home"); }}
    onCancel={() => { setActiveRide(null); setScreen("home"); }} />;

  return <HomeScreen user={user}
    onBook={dest => { setPrefill(dest || null); setScreen("booking"); }}
    onHistory={() => setScreen("history")}
    onLogout={() => { clearToken(); setUser(null); setScreen("phone"); }} />;
}
