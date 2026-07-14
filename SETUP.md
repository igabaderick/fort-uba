# FORT UBA — Setup & Run Guide

## Prerequisites
- Node.js 18+ (you have 20 ✓)
- PostgreSQL 14+ running locally (or a hosted instance)

---

## 1. Database Setup

### Install PostgreSQL (if not installed)
Download from https://www.postgresql.org/download/windows/

### Create the database
```bash
psql -U postgres
CREATE DATABASE fortuba;
\q
```

### Update the connection string
Edit `backend/.env` and set:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/fortuba
```

### Run migrations + seed
```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
```

---

## 2. Start the Backend
```bash
# In terminal 1
cd backend
npm run dev
# → Runs on http://localhost:4000
```

---

## 3. Start the Frontend Apps

Open 3 more terminals:

```bash
# Terminal 2 — Rider app
cd rider-app
npm run dev
# → http://localhost:5173

# Terminal 3 — Driver app
cd driver-app
npm run dev
# → http://localhost:5174

# Terminal 4 — Admin dashboard
cd admin-dashboard
npm run dev
# → http://localhost:5175
```

---

## Demo Accounts (after seeding)

| App | Login | Credentials |
|-----|-------|-------------|
| Admin | http://localhost:5175 | admin@fortuba.ug / admin123 |
| Rider | http://localhost:5173 | Phone: +256700000001 → OTP: 1234 |
| Driver | http://localhost:5174 | Phone: +256700000101 → OTP: 1234 |

---

## Architecture

```
rider-app  (port 5173)  ─┐
driver-app (port 5174)  ──┤── backend API (port 4000) ── PostgreSQL
admin-dashboard (5175)  ─┘         │
                                Socket.io (real-time)
```

### What's real
- ✅ Full auth flow (phone OTP — code is 1234 in dev mode)
- ✅ Ride lifecycle: request → match → accept → en route → complete
- ✅ Driver online/offline with availability checks
- ✅ Fare calculation from live pricing config
- ✅ Commission ledger (18% per ride)
- ✅ Admin: approve/reject/suspend drivers
- ✅ Admin: live ride monitoring (polls every 10s)
- ✅ Admin: finance — commission collected, cash debts
- ✅ Admin: pricing settings (persisted to DB)
- ✅ Real-time events via Socket.io
- ✅ Leaflet + OpenStreetMap (no API key needed)
- ✅ Ride history and ratings

### Maps — 100% free, no API key needed
| Service | Purpose | Cost |
|---------|---------|------|
| OpenStreetMap HOT tiles | Map rendering | Free forever |
| Nominatim | Address search & reverse geocode | Free (1 req/sec, proxied via backend) |
| OSRM | Road routing & real distances | Free public server |

All map calls go through the backend `/geo` proxy which handles rate-limiting and caching — no keys required in any environment.

### What needs real credentials to activate
- 📱 **Real SMS OTP** — set `USE_REAL_SMS=true` in `.env`, add Africa's Talking API key
- 💳 **MTN MoMo / Airtel Money** — set `MTN_MOMO_ENABLED=true`, add merchant keys (requires registered business)

---

## Production Deployment

1. Host backend on Railway / Render / any VPS
2. Use a managed PostgreSQL (Railway, Neon, Supabase)
3. Build frontends: `npm run build` in each app folder → deploy `dist/` to Vercel/Netlify
4. Update `.env` with production URLs and real API keys
5. Port rider-app and driver-app to React Native for Android/iOS

---

## Project Structure

```
fort-uba/
├── backend/
│   ├── src/
│   │   ├── server.js          ← Express + Socket.io entry
│   │   ├── db/
│   │   │   ├── schema.sql     ← Full PostgreSQL schema
│   │   │   ├── migrate.js     ← Migration runner
│   │   │   ├── seed.js        ← Demo data seeder
│   │   │   └── db.js          ← pg Pool wrapper
│   │   ├── middleware/
│   │   │   └── auth.js        ← JWT middleware
│   │   ├── routes/
│   │   │   ├── auth.js        ← OTP auth for riders/drivers/admin
│   │   │   ├── rides.js       ← Ride lifecycle endpoints
│   │   │   ├── drivers.js     ← Driver management
│   │   │   ├── users.js       ← Rider profile & saved places
│   │   │   └── admin.js       ← Stats, finance, pricing
│   │   └── services/
│   │       ├── otp.js         ← OTP send/verify (dev=1234)
│   │       └── fare.js        ← Fare calculation + caching
│   └── .env                   ← Config (don't commit to git)
├── shared/
│   ├── api.js                 ← Shared API client (all 3 apps)
│   └── theme.js               ← Brand colors + pricing constants
├── rider-app/src/App.jsx      ← Full rider app, wired to backend
├── driver-app/src/App.jsx     ← Full driver app, wired to backend
└── admin-dashboard/src/App.jsx ← Full admin dashboard, wired to backend
```
