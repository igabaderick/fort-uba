# FORT UBA — Deployment Guide
## Host on Railway (backend) + Vercel (3 frontends) — all free

---

## STEP 1 — Push to GitHub

1. Go to https://github.com/new
2. Create a new repository named **fort-uba** (set to Public or Private)
3. Copy the repository URL (e.g. https://github.com/YOUR_USERNAME/fort-uba.git)
4. Run these commands in your terminal:

```bash
cd "c:\Users\ECO F\Desktop\fort-uba"
git remote add origin https://github.com/YOUR_USERNAME/fort-uba.git
git branch -M main
git push -u origin main
```

---

## STEP 2 — Deploy Backend on Railway

Railway gives free PostgreSQL + Node hosting.

1. Go to https://railway.app and sign up (free, use GitHub login)
2. Click **New Project** → **Deploy from GitHub repo** → select **fort-uba**
3. Railway detects it's a monorepo — set **Root Directory** to `/backend`
4. Click **Add Database** → **PostgreSQL** — Railway auto-injects `DATABASE_URL`
5. Go to your backend service → **Variables** tab → add these:

```
NODE_ENV=production
JWT_SECRET=pick-a-long-random-string-here
USE_REAL_SMS=false
CORS_ORIGINS=https://fortuba-rider.vercel.app,https://fortuba-driver.vercel.app,https://fortuba-admin.vercel.app
```

6. Click **Deploy** — Railway runs `npm start` which auto-migrates the DB
7. Go to **Settings** → **Networking** → **Generate Domain**
   - Copy your Railway URL e.g. `https://fort-uba-backend.up.railway.app`

> Seed demo data: after deploy, go to Railway → your backend service →
> **Shell** tab → run: `node src/db/seed.js`

---

## STEP 3 — Deploy Rider App on Vercel

1. Go to https://vercel.com and sign up (free, use GitHub login)
2. Click **Add New → Project** → import **fort-uba** from GitHub
3. Set these build settings:
   - **Root Directory:** `rider-app`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Add Environment Variable:
   - `VITE_API_URL` = `https://fort-uba-backend.up.railway.app`
5. Click **Deploy**
6. When done, go to **Settings → Domains** → set custom domain or note the URL
   e.g. `https://fortuba-rider.vercel.app`

---

## STEP 4 — Deploy Driver App on Vercel

1. Back in Vercel → **Add New → Project** → import **fort-uba** again
2. Set build settings:
   - **Root Directory:** `driver-app`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add Environment Variable:
   - `VITE_API_URL` = `https://fort-uba-backend.up.railway.app`
4. Click **Deploy**
   e.g. `https://fortuba-driver.vercel.app`

---

## STEP 5 — Deploy Admin Dashboard on Vercel

1. Vercel → **Add New → Project** → import **fort-uba** again
2. Set build settings:
   - **Root Directory:** `admin-dashboard`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add Environment Variable:
   - `VITE_API_URL` = `https://fort-uba-backend.up.railway.app`
4. Click **Deploy**
   e.g. `https://fortuba-admin.vercel.app`

---

## STEP 6 — Update CORS on Railway

Once you have all 3 Vercel URLs, go back to Railway → backend → Variables:

```
CORS_ORIGINS=https://fortuba-rider.vercel.app,https://fortuba-driver.vercel.app,https://fortuba-admin.vercel.app
```

Replace with your actual Vercel URLs. Railway redeploys automatically.

---

## Testing on iPhone / Android

Open these URLs on any device browser — they work as mobile web apps:

| App | URL |
|-----|-----|
| Rider | https://fortuba-rider.vercel.app |
| Driver | https://fortuba-driver.vercel.app |
| Admin | https://fortuba-admin.vercel.app |

**Demo accounts:**
- Rider: phone `+256700000001` → OTP `1234`
- Driver: phone `+256700000101` → OTP `1234`
- Admin: `admin@fortuba.ug` / `admin123`

**To add to iPhone home screen (PWA-style):**
1. Open Safari → go to the Rider or Driver URL
2. Tap the Share button → **Add to Home Screen**
3. It installs like an app with no App Store needed

---

## Summary of URLs after deploy

| Service | URL |
|---------|-----|
| Backend API | https://fort-uba-backend.up.railway.app |
| Rider App | https://fortuba-rider.vercel.app |
| Driver App | https://fortuba-driver.vercel.app |
| Admin | https://fortuba-admin.vercel.app |
