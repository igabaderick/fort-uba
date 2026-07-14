/**
 * FORT UBA — shared API client
 * Used by all three frontend apps to talk to the backend.
 * Handles auth headers, token storage, and Socket.io connection.
 */

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
// On production this will be set to your Railway backend URL via VITE_API_URL env var

// ── TOKEN STORAGE ─────────────────────────────────────────────────
export function getToken() {
  return localStorage.getItem("fu_token");
}
export function setToken(token) {
  localStorage.setItem("fu_token", token);
}
export function clearToken() {
  localStorage.removeItem("fu_token");
  localStorage.removeItem("fu_user");
}

export function saveUser(user) {
  localStorage.setItem("fu_user", JSON.stringify(user));
}
export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("fu_user"));
  } catch {
    return null;
  }
}

// ── HTTP CLIENT ───────────────────────────────────────────────────
async function request(method, path, body, auth = true) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
  }
  const res = await fetch(API_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

export const api = {
  get: (path, auth) => request("GET", path, null, auth),
  post: (path, body, auth) => request("POST", path, body, auth),
  patch: (path, body, auth) => request("PATCH", path, body, auth),
  put: (path, body, auth) => request("PUT", path, body, auth),
  delete: (path, auth) => request("DELETE", path, null, auth),
};

// ── AUTH ENDPOINTS ─────────────────────────────────────────────────
export const authApi = {
  rider: {
    sendOtp: (phone) => api.post("/auth/rider/send-otp", { phone }, false),
    verifyOtp: (phone, code) => api.post("/auth/rider/verify-otp", { phone, code }, false),
    completeProfile: (data) => api.post("/auth/rider/complete-profile", data),
  },
  driver: {
    sendOtp: (phone) => api.post("/auth/driver/send-otp", { phone }, false),
    verifyOtp: (phone, code) => api.post("/auth/driver/verify-otp", { phone, code }, false),
    register: (data) => api.post("/auth/driver/register", data),
  },
  admin: {
    login: (email, password) => api.post("/auth/admin/login", { email, password }, false),
  },
};

// ── GEO ENDPOINTS (free maps — proxied through backend) ──────────
export const geoApi = {
  search: (q) => api.get(`/geo/search?q=${encodeURIComponent(q)}`, false),
  reverse: (lat, lng) => api.get(`/geo/reverse?lat=${lat}&lng=${lng}`, false),
  route: (fromLat, fromLng, toLat, toLng, profile = "car") =>
    api.get(`/geo/route?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}&profile=${profile}`, false),
  routeGeometry: (fromLat, fromLng, toLat, toLng, profile = "car") =>
    api.get(`/geo/route/geometry?fromLat=${fromLat}&fromLng=${fromLng}&toLat=${toLat}&toLng=${toLng}&profile=${profile}`, false),
};

// ── RIDE ENDPOINTS ────────────────────────────────────────────────
export const ridesApi = {
  estimate: (pickupLat, pickupLng, destLat, destLng) =>
    api.get(`/rides/estimate?pickupLat=${pickupLat}&pickupLng=${pickupLng}&destLat=${destLat}&destLng=${destLng}`, false),
  request: (data) => api.post("/rides/request", data),
  accept: (rideId) => api.post(`/rides/${rideId}/accept`, {}),
  updateStatus: (rideId, status) => api.post(`/rides/${rideId}/status`, { status }),
  cancel: (rideId, reason) => api.post(`/rides/${rideId}/cancel`, { reason }),
  rate: (rideId, rating, comment) => api.post(`/rides/${rideId}/rate`, { rating, comment }),
  get: (rideId) => api.get(`/rides/${rideId}`),
  myHistory: (limit = 20, offset = 0) => api.get(`/rides/my/history?limit=${limit}&offset=${offset}`),
  myActive: () => api.get("/rides/my/active"),
  driverActive: () => api.get("/rides/driver/active"),
};

// ── DRIVER ENDPOINTS ──────────────────────────────────────────────
export const driverApi = {
  me: () => api.get("/drivers/me"),
  setAvailability: (online, lat, lng) => api.post("/drivers/availability", { online, lat, lng }),
  updateLocation: (lat, lng) => api.post("/drivers/location", { lat, lng }),
  earnings: () => api.get("/drivers/earnings"),
  list: (status) => api.get(`/drivers${status ? "?status=" + status : ""}`),
  updateStatus: (driverId, status, reason) => api.patch(`/drivers/${driverId}/status`, { status, reason }),
  online: () => api.get("/drivers/online"),
};

// ── ADMIN ENDPOINTS ───────────────────────────────────────────────
export const adminApi = {
  stats: () => api.get("/admin/stats"),
  rideVolume: () => api.get("/admin/ride-volume"),
  liveRides: () => api.get("/admin/live-rides"),
  rides: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return api.get(`/admin/rides${qs ? "?" + qs : ""}`);
  },
  finance: () => api.get("/admin/finance"),
  pricing: () => api.get("/admin/pricing"),
  updatePricing: (data) => api.put("/admin/pricing", data),
  announce: (target, message) => api.post("/admin/announce", { target, message }),
};

// ── USER ENDPOINTS ────────────────────────────────────────────────
export const userApi = {
  me: () => api.get("/users/me"),
  updateMe: (data) => api.patch("/users/me", data),
  savedPlaces: () => api.get("/users/saved-places"),
  addPlace: (data) => api.post("/users/saved-places", data),
  deletePlace: (id) => api.delete(`/users/saved-places/${id}`),
};
