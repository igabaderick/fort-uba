/**
 * FORT UBA — Admin Dashboard
 * Uber Base Design System styling
 */
import { useState, useEffect, useCallback } from "react";
import { authApi, adminApi, driverApi, getToken, setToken, clearToken, saveUser, getUser } from "../../shared/api.js";
import { AdminLiveMap } from "./MapComponents.jsx";
import { T as S } from "../../shared/ui.js";

// ── Shared style helpers ──────────────────────────────────────────
const css = {
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 32px", height: 64, background: S.white,
    borderBottom: `1px solid ${S.border}`, fontFamily: S.font, position: "sticky", top: 0, zIndex: 100,
  },
  sidebar: {
    width: 220, minHeight: "100vh", background: S.white,
    borderRight: `1px solid ${S.border}`, fontFamily: S.font, paddingTop: 24, flexShrink: 0,
  },
  navItem: (active) => ({
    display: "flex", alignItems: "center", gap: 10, padding: "12px 24px",
    cursor: "pointer", fontSize: 14, fontWeight: active ? 600 : 400,
    color: active ? S.primary : S.secondary,
    borderLeft: active ? `3px solid ${S.black}` : "3px solid transparent",
    background: active ? S.bgSecondary : "transparent",
    transition: "all 0.15s", userSelect: "none",
  }),
  card: {
    background: S.white, border: `1px solid ${S.border}`,
    borderRadius: S.radiusLg, padding: 24, fontFamily: S.font,
  },
  statCard: {
    background: S.white, border: `1px solid ${S.border}`,
    borderRadius: S.radiusLg, padding: 24, fontFamily: S.font, minWidth: 180,
  },
  statLabel: { fontSize: 11, fontWeight: 600, color: S.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 },
  statValue: { fontSize: 32, fontWeight: 800, color: S.primary, lineHeight: 1.1 },
  btnPrimary: {
    background: S.black, color: S.white, border: "none",
    borderRadius: S.radiusMd, height: S.btnHeightLg, padding: "0 24px",
    fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: S.font,
    letterSpacing: "-0.01em", transition: "opacity 0.15s",
  },
  btnSecondary: {
    background: S.bgSecondary, color: S.primary, border: `1px solid ${S.border}`,
    borderRadius: S.radiusMd, height: 36, padding: "0 16px",
    fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: S.font,
  },
  btnDanger: {
    background: "#FFF0EE", color: S.negative, border: `1px solid #FFCDD2`,
    borderRadius: S.radiusMd, height: 36, padding: "0 16px",
    fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: S.font,
  },
  input: {
    width: "100%", height: 48, border: `1px solid ${S.border}`, borderRadius: S.radiusMd,
    padding: "0 14px", fontSize: 14, fontFamily: S.font, outline: "none",
    boxSizing: "border-box", background: S.white, color: S.primary,
  },
  tableRow: {
    borderBottom: `1px solid ${S.border}`, display: "grid",
    alignItems: "center", padding: "14px 16px", gap: 12,
  },
};

// ── Badge ─────────────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    active:    { bg: "#E6F4EA", color: "#1E7E34" },
    approved:  { bg: "#E6F4EA", color: "#1E7E34" },
    online:    { bg: "#E6F4EA", color: "#1E7E34" },
    pending:   { bg: "#FFF8E1", color: "#B45309" },
    suspended: { bg: "#FFF0EE", color: S.negative },
    cancelled: { bg: "#FFF0EE", color: S.negative },
    completed: { bg: S.bgSecondary, color: S.secondary },
  };
  const { bg, color } = map[status?.toLowerCase()] || { bg: S.bgSecondary, color: S.secondary };
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: S.radiusPill,
      fontSize: 11, fontWeight: 600, background: bg, color,
      textTransform: "capitalize", letterSpacing: "0.04em",
    }}>{status || "—"}</span>
  );
}

// ── Login Screen ──────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await authApi.admin.login(email, password);
      setToken(res.token);
      saveUser(res.user);
      onLogin(res.user);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: S.bgSecondary, fontFamily: S.font,
    }}>
      <div style={{ ...css.card, width: 380, padding: 40 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>FORT UBA</div>
        <div style={{ fontSize: 13, color: S.secondary, marginBottom: 32 }}>Admin Dashboard</div>
        {error && (
          <div style={{ background: "#FFF0EE", color: S.negative, borderRadius: S.radiusMd, padding: "10px 14px", fontSize: 13, marginBottom: 20 }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: S.secondary, marginBottom: 6 }}>Email</div>
            <input style={css.input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@fortuba.com" required />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: S.secondary, marginBottom: 6 }}>Password</div>
            <input style={css.input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" disabled={loading} style={{ ...css.btnPrimary, width: "100%", marginTop: 8, opacity: loading ? 0.6 : 1 }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [volume, setVolume] = useState([]);
  const [pendingDrivers, setPendingDrivers] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    adminApi.stats().then(setStats).catch(() => {});
    adminApi.rideVolume().then(d => setVolume(d.data || d || [])).catch(() => {});
    driverApi.list("pending").then(d => setPendingDrivers(d.drivers || d || [])).catch(() => {});
  }, []);

  async function handleDriver(id, action) {
    try {
      await driverApi.updateStatus(id, action);
      setPendingDrivers(p => p.filter(d => d.id !== id));
      setMsg(`Driver ${action}`);
      setTimeout(() => setMsg(""), 2500);
    } catch (e) { setMsg(e.message); }
  }

  const maxVol = Math.max(...volume.map(v => v.count || 0), 1);
  const statDefs = [
    { label: "Revenue today", value: stats ? `UGX ${Number(stats.revenue_today || 0).toLocaleString()}` : "—" },
    { label: "Active drivers", value: stats?.active_drivers ?? "—" },
    { label: "Rides today", value: stats?.rides_today ?? "—" },
    { label: "Pending approvals", value: stats?.pending_approvals ?? pendingDrivers.length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {msg && <div style={{ background: "#E6F4EA", color: "#1E7E34", padding: "10px 16px", borderRadius: S.radiusMd, fontSize: 13 }}>{msg}</div>}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {statDefs.map(s => (
          <div key={s.label} style={css.statCard}>
            <div style={css.statLabel}>{s.label}</div>
            <div style={css.statValue}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={css.card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Ride volume — last 7 days</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 100 }}>
          {volume.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 10, color: S.secondary }}>{v.count || 0}</div>
              <div style={{ width: "100%", background: S.black, borderRadius: "3px 3px 0 0", height: Math.round(((v.count || 0) / maxVol) * 80) || 4 }} />
              <div style={{ fontSize: 10, color: S.tertiary, whiteSpace: "nowrap" }}>
                {v.day ? new Date(v.day).toLocaleDateString("en", { weekday: "short" }) : `D${i + 1}`}
              </div>
            </div>
          ))}
          {volume.length === 0 && <div style={{ color: S.tertiary, fontSize: 13 }}>No data</div>}
        </div>
      </div>

      {/* Ride type split */}
      {stats && (
        <div style={css.card}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Ride type split</div>
          {[{ label: "Boda (Moto)", val: stats.boda_pct || 60 }, { label: "Car", val: stats.car_pct || 40 }].map(rt => (
            <div key={rt.label} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span>{rt.label}</span><span style={{ fontWeight: 600 }}>{rt.val}%</span>
              </div>
              <div style={{ height: 8, background: S.bgTertiary, borderRadius: S.radiusPill }}>
                <div style={{ height: "100%", width: `${rt.val}%`, background: S.black, borderRadius: S.radiusPill }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending approvals */}
      <div style={css.card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Pending driver approvals</div>
        {pendingDrivers.length === 0
          ? <div style={{ color: S.tertiary, fontSize: 13 }}>No pending approvals</div>
          : pendingDrivers.map(d => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${S.border}` }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: S.tertiary }}>{d.phone} · {d.driver_type}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={css.btnSecondary} onClick={() => handleDriver(d.id, "approved")}>Approve</button>
                <button style={css.btnDanger} onClick={() => handleDriver(d.id, "suspended")}>Reject</button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Live Rides Tab ────────────────────────────────────────────────
function LiveRidesTab() {
  const [rides, setRides] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const fetchData = useCallback(() => {
    adminApi.liveRides().then(d => setRides(d.rides || d || [])).catch(() => {});
    driverApi.online().then(d => setDrivers(d.drivers || d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 8000);
    return () => clearInterval(t);
  }, [fetchData]);

  return (
    <div style={{ display: "flex", gap: 20, height: "calc(100vh - 130px)" }}>
      {/* Map */}
      <div style={{ flex: 1, borderRadius: S.radiusLg, overflow: "hidden", border: `1px solid ${S.border}` }}>
        <AdminLiveMap height="100%" drivers={drivers} activeRides={rides} />
      </div>

      {/* Ride list */}
      <div style={{ width: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: S.secondary, paddingBottom: 8 }}>
          {rides.length} active ride{rides.length !== 1 ? "s" : ""}
        </div>
        {rides.length === 0 && <div style={{ ...css.card, color: S.tertiary, fontSize: 13 }}>No active rides</div>}
        {rides.map(r => (
          <div key={r.id} style={css.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>#{r.id}</div>
              <Badge status={r.status} />
            </div>
            <div style={{ fontSize: 12, color: S.secondary, marginBottom: 4 }}>
              <span style={{ fontWeight: 500 }}>Rider:</span> {r.rider_name || "—"}
            </div>
            <div style={{ fontSize: 12, color: S.secondary, marginBottom: 4 }}>
              <span style={{ fontWeight: 500 }}>Driver:</span> {r.driver_name || "—"}
            </div>
            <div style={{ fontSize: 12, color: S.tertiary, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${S.border}` }}>
              {r.pickup_address || "Pickup"} → {r.dest_address || "Destination"}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8 }}>
              UGX {Number(r.fare || 0).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Drivers Tab ───────────────────────────────────────────────────
const DRIVER_FILTERS = ["all", "pending", "approved", "suspended"];

function DriversTab() {
  const [filter, setFilter] = useState("all");
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    driverApi.list(filter === "all" ? undefined : filter)
      .then(d => setDrivers(d.drivers || d || []))
      .catch(() => setDrivers([]))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(id, status) {
    try {
      await driverApi.updateStatus(id, status);
      setMsg(`Driver ${status}`);
      setTimeout(() => setMsg(""), 2500);
      load();
    } catch (e) { setMsg(e.message); }
  }

  const cols = "2fr 1.5fr 1fr 1fr 1fr 1.5fr";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {msg && <div style={{ background: "#E6F4EA", color: "#1E7E34", padding: "10px 16px", borderRadius: S.radiusMd, fontSize: 13 }}>{msg}</div>}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, background: S.bgSecondary, padding: 4, borderRadius: S.radiusMd, width: "fit-content" }}>
        {DRIVER_FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? S.white : "transparent",
            border: filter === f ? `1px solid ${S.border}` : "1px solid transparent",
            borderRadius: S.radiusSm, padding: "6px 16px", fontSize: 13,
            fontWeight: filter === f ? 600 : 400, cursor: "pointer",
            color: filter === f ? S.primary : S.secondary, fontFamily: S.font,
            textTransform: "capitalize", transition: "all 0.15s",
          }}>{f}</button>
        ))}
      </div>

      {/* Table */}
      <div style={css.card}>
        {/* Header */}
        <div style={{ ...css.tableRow, gridTemplateColumns: cols, background: S.bgSecondary, borderRadius: S.radiusSm }}>
          {["Name", "Phone", "Type", "Rating", "Status", "Actions"].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: S.tertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
          ))}
        </div>
        {loading && <div style={{ padding: 24, color: S.tertiary, fontSize: 13 }}>Loading…</div>}
        {!loading && drivers.length === 0 && <div style={{ padding: 24, color: S.tertiary, fontSize: 13 }}>No drivers found</div>}
        {!loading && drivers.map(d => (
          <div key={d.id} style={{ ...css.tableRow, gridTemplateColumns: cols }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{d.name}</div>
              <div style={{ fontSize: 11, color: S.tertiary }}>{d.vehicle_plate || "—"}</div>
            </div>
            <div style={{ fontSize: 13, color: S.secondary }}>{d.phone}</div>
            <div style={{ fontSize: 13, color: S.secondary, textTransform: "capitalize" }}>{d.driver_type || "—"}</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>⭐ {Number(d.rating || 5).toFixed(1)}</div>
            <Badge status={d.status} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {d.status === "pending" && (
                <button style={css.btnSecondary} onClick={() => handleAction(d.id, "approved")}>Approve</button>
              )}
              {d.status === "approved" && (
                <button style={css.btnDanger} onClick={() => handleAction(d.id, "suspended")}>Suspend</button>
              )}
              {d.status === "suspended" && (
                <button style={css.btnSecondary} onClick={() => handleAction(d.id, "approved")}>Reinstate</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Finance Tab ───────────────────────────────────────────────────
function FinanceTab() {
  const [finance, setFinance] = useState(null);

  useEffect(() => {
    adminApi.finance().then(setFinance).catch(() => {});
  }, []);

  const statDefs = finance ? [
    { label: "Total revenue", value: `UGX ${Number(finance.total_revenue || 0).toLocaleString()}` },
    { label: "Platform commission", value: `UGX ${Number(finance.platform_commission || 0).toLocaleString()}` },
    { label: "Outstanding cash", value: `UGX ${Number(finance.outstanding_cash || 0).toLocaleString()}` },
  ] : [];

  const balances = finance?.outstanding_balances || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {!finance && [0, 1, 2].map(i => (
          <div key={i} style={css.statCard}>
            <div style={{ ...css.statLabel }}>Loading…</div>
            <div style={{ ...css.statValue, color: S.disabled }}>—</div>
          </div>
        ))}
        {statDefs.map(s => (
          <div key={s.label} style={css.statCard}>
            <div style={css.statLabel}>{s.label}</div>
            <div style={css.statValue}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Outstanding cash balances */}
      <div style={css.card}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Outstanding cash balances</div>
        {balances.length === 0
          ? <div style={{ color: S.tertiary, fontSize: 13 }}>{finance ? "No outstanding balances" : "Loading…"}</div>
          : (
            <>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, padding: "8px 0", borderBottom: `1px solid ${S.border}` }}>
                {["Driver", "Cash collected", "Owed to platform"].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: S.tertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
                ))}
              </div>
              {balances.map((b, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, padding: "14px 0", borderBottom: `1px solid ${S.border}` }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{b.driver_name || "—"}</div>
                    <div style={{ fontSize: 11, color: S.tertiary }}>{b.phone || ""}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>UGX {Number(b.cash_collected || 0).toLocaleString()}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.negative }}>
                    UGX {Number(b.owed || 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </>
          )}
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────
function SettingsTab() {
  const [form, setForm] = useState({
    boda_base_fare: "", boda_per_km: "", boda_per_min: "",
    car_base_fare: "", car_per_km: "", car_per_min: "",
    platform_commission_pct: "",
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    adminApi.pricing().then(d => {
      const p = d.pricing || d;
      setForm({
        boda_base_fare: p.boda_base_fare ?? "",
        boda_per_km: p.boda_per_km ?? "",
        boda_per_min: p.boda_per_min ?? "",
        car_base_fare: p.car_base_fare ?? "",
        car_per_km: p.car_per_km ?? "",
        car_per_min: p.car_per_min ?? "",
        platform_commission_pct: p.platform_commission_pct ?? "",
      });
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setMsg("");
    try {
      await adminApi.updatePricing(form);
      setMsg("Settings saved successfully");
    } catch (err) {
      setMsg(err.message || "Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3000);
    }
  }

  const field = (label, key, unit = "UGX") => (
    <div key={key}>
      <div style={{ fontSize: 12, fontWeight: 600, color: S.secondary, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <span style={{
          height: 48, display: "flex", alignItems: "center", padding: "0 12px",
          background: S.bgSecondary, border: `1px solid ${S.border}`, borderRight: "none",
          borderRadius: `${S.radiusMd}px 0 0 ${S.radiusMd}px`, fontSize: 13, color: S.tertiary, fontFamily: S.font,
        }}>{unit}</span>
        <input
          style={{ ...css.input, borderRadius: `0 ${S.radiusMd}px ${S.radiusMd}px 0`, flex: 1, width: "auto" }}
          type="number" value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          disabled={!loaded} placeholder="0"
        />
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 600 }}>
      {msg && (
        <div style={{
          background: msg.includes("failed") ? "#FFF0EE" : "#E6F4EA",
          color: msg.includes("failed") ? S.negative : "#1E7E34",
          padding: "10px 16px", borderRadius: S.radiusMd, fontSize: 13, marginBottom: 20,
        }}>{msg}</div>
      )}
      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={css.card}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Boda (Motorcycle) pricing</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {field("Base fare", "boda_base_fare")}
            {field("Per kilometre", "boda_per_km")}
            {field("Per minute", "boda_per_min")}
          </div>
        </div>

        <div style={css.card}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Car pricing</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {field("Base fare", "car_base_fare")}
            {field("Per kilometre", "car_per_km")}
            {field("Per minute", "car_per_min")}
          </div>
        </div>

        <div style={css.card}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Platform settings</div>
          {field("Commission percentage", "platform_commission_pct", "%")}
        </div>

        <button type="submit" disabled={saving || !loaded} style={{ ...css.btnPrimary, width: "100%", opacity: (saving || !loaded) ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}

// ── Admin Dashboard shell ─────────────────────────────────────────
const TABS = [
  { id: "overview",  label: "Overview",   icon: "◈" },
  { id: "live",      label: "Live rides", icon: "⬤" },
  { id: "drivers",   label: "Drivers",    icon: "👤" },
  { id: "finance",   label: "Finance",    icon: "₿" },
  { id: "settings",  label: "Settings",   icon: "⚙" },
];

function AdminDashboard({ user, onLogout }) {
  const [tab, setTab] = useState("overview");

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: S.font, background: S.bgSecondary }}>
      {/* Sidebar */}
      <nav style={css.sidebar}>
        <div style={{ padding: "0 24px 24px", borderBottom: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.03em" }}>FORT UBA</div>
          <div style={{ fontSize: 11, color: S.tertiary, marginTop: 2 }}>Admin</div>
        </div>
        <div style={{ marginTop: 12 }}>
          {TABS.map(t => (
            <div key={t.id} style={css.navItem(tab === t.id)} onClick={() => setTab(t.id)}>
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span>{t.label}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto", padding: "24px", borderTop: `1px solid ${S.border}`, position: "absolute", bottom: 0, width: 220, boxSizing: "border-box" }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{user?.name || user?.email || "Admin"}</div>
          <div style={{ fontSize: 11, color: S.tertiary, marginBottom: 12 }}>{user?.email || ""}</div>
          <button onClick={onLogout} style={{ ...css.btnSecondary, width: "100%", height: 36 }}>Sign out</button>
        </div>
      </nav>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Top bar */}
        <header style={css.topBar}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {TABS.find(t => t.id === tab)?.label}
          </div>
          <div style={{ fontSize: 12, color: S.tertiary }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </div>
        </header>

        {/* Tab content */}
        <main style={{ flex: 1, padding: tab === "live" ? "20px 24px" : 32, overflow: "auto" }}>
          {tab === "overview"  && <OverviewTab />}
          {tab === "live"      && <LiveRidesTab />}
          {tab === "drivers"   && <DriversTab />}
          {tab === "finance"   && <FinanceTab />}
          {tab === "settings"  && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => getToken() ? getUser() : null);

  function handleLogin(u) {
    setUser(u);
  }

  function handleLogout() {
    clearToken();
    setUser(null);
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />;
  return <AdminDashboard user={user} onLogout={handleLogout} />;
}
