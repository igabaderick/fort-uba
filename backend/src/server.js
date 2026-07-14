require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
const server = http.createServer(app);

// ── CORS ──────────────────────────────────────────────────────────
// In production, CORS_ORIGINS env var should be a comma-separated list of
// your Vercel URLs e.g.: https://fortuba-rider.vercel.app,https://fortuba-driver.vercel.app
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(o => o.trim())
  : [
      process.env.RIDER_APP_URL  || "http://localhost:5173",
      process.env.DRIVER_APP_URL || "http://localhost:5174",
      process.env.ADMIN_APP_URL  || "http://localhost:5175",
    ];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // In development allow any origin
    if (process.env.NODE_ENV !== "production") return cb(null, true);
    cb(new Error("CORS blocked: " + origin));
  },
  credentials: true,
}));
app.use(express.json());

// ── SOCKET.IO ─────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? allowedOrigins : "*",
    methods: ["GET", "POST"],
  },
});

// Authenticate socket connections
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(); // allow unauthenticated (for admin broadcast)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch {
    next(); // allow connection even if token invalid; routes will be limited
  }
});

io.on("connection", (socket) => {
  const user = socket.user;
  if (user) {
    // Join personal room for targeted events
    socket.join(`${user.type}_${user.id}`);
    // Join role room for broadcast events
    if (user.type === "rider") socket.join("riders");
    if (user.type === "driver") socket.join("drivers");
    if (user.type === "admin") socket.join("admins");

    console.log(`[Socket] ${user.type} ${user.id} connected`);

    socket.on("driver_location", ({ lat, lng }) => {
      if (user.type !== "driver") return;
      // Broadcast driver location to admins and any active riders
      io.to("admins").emit("driver_location", { driverId: user.id, lat, lng });
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] ${user.type} ${user.id} disconnected`);
    });
  }
});

app.set("io", io);

// ── ROUTES ────────────────────────────────────────────────────────
app.use("/auth", require("./routes/auth"));
app.use("/rides", require("./routes/rides"));
app.use("/drivers", require("./routes/drivers"));
app.use("/users", require("./routes/users"));
app.use("/admin", require("./routes/admin"));
app.use("/geo", require("./routes/geo"));

// ── HEALTH CHECK ──────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "fort-uba-api", time: new Date().toISOString() });
});

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── ERROR HANDLER ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: process.env.NODE_ENV === "development" ? err.message : "Internal server error" });
});

// ── START ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\n🚀 FORT UBA API running on http://localhost:${PORT}`);
  console.log(`   Rider app:  ${process.env.RIDER_APP_URL || "http://localhost:5173"}`);
  console.log(`   Driver app: ${process.env.DRIVER_APP_URL || "http://localhost:5174"}`);
  console.log(`   Admin:      ${process.env.ADMIN_APP_URL || "http://localhost:5175"}`);
  console.log(`\n   OTP mode: ${process.env.USE_REAL_SMS === "true" ? "REAL SMS" : "DEV (code=1234)"}`);
  console.log(`   DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@")}\n`);
});
