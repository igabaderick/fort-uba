# FORT UBA — Project Package

This package is the design + prototype foundation for FORT UBA, ready to
hand to a developer or continue in a real dev environment (e.g. Claude Code).
It is **not** a production-ready app — see "What's left" below for an honest
account of the gap.

## What's in here

```
fort-uba/
├── PRODUCT_DOCUMENTATION.md   ← full product spec, personas, business model,
│                                 user flows, open decisions
├── shared/
│   ├── theme.js               ← brand colors, fonts, pricing config,
│   │                             fare calculation logic
│   └── logo.png
├── rider-app/
│   └── src/App.jsx            ← working prototype: home, booking, ride
│                                 matching, live tracking, trip complete
├── driver-app/
│   └── src/App.jsx            ← working prototype: offline/online toggle,
│                                 incoming request, en route, earnings
└── admin-dashboard/
    └── src/App.jsx            ← working prototype: overview, live rides,
                                  driver roster, finance, pricing settings
```

Each app's `App.jsx` is a **functional, clickable React prototype** — the
full screen flow, interaction states, and visual design are real and
tested. What's mocked is the *data*: driver locations, fares, and ride
status are hardcoded or simulated with timers, not pulled from a live
backend.

## What's left for a real, 100%-complete app

Being direct about this now saves you surprises later. To go from this
package to something you can actually launch in Fort Portal:

**1. Backend & database**
- A real API (Node.js/Django/etc.) and database (PostgreSQL) to store
  riders, drivers, rides, payments, and ratings
- Real-time dispatch logic (matching nearest available driver) — this is
  the core algorithm and currently just a timed animation in the prototype
- Authentication (OTP via SMS gateway)

**2. Payments**
- MTN Mobile Money and Airtel Money merchant/API accounts — these require
  a registered business and take time to set up with the telecoms
- Cash-trip commission reconciliation logic (flagged in the product docs
  and visible in the Admin Dashboard's Finance tab)

**3. Maps & location**
- Google Maps Platform (or OpenStreetMap) API keys
- Real GPS tracking, geocoding, and routing — the maps in these
  prototypes are static illustrations, not live maps

**4. Mobile app conversion**
- Rider App and Driver App need to be React Native (or native
  Swift/Kotlin) to run as installable phone apps — the current versions
  are React for web, built for fast design iteration
- The component structure and design translate directly; this is
  meaningful but not from-scratch work

**5. Testing & compliance**
- Testing on real Android/iOS devices and real Fort Portal network
  conditions
- App Store / Google Play submission (developer accounts, review process)
- Driver vetting/background-check process (operational, not technical)

**6. Business decisions still open**
See "Open Decisions Needed" in `PRODUCT_DOCUMENTATION.md` — commission vs
subscription interplay, exact pricing, and launch timeline are not yet
locked in.

## Recommended next step

Open this folder in **Claude Code** (or hand it to a developer) to:
1. Set up the real backend and database
2. Port `rider-app` and `driver-app` to React Native
3. Wire in MTN MoMo/Airtel Money and Google Maps APIs
4. Replace the mock data in every `App.jsx` with real API calls

The design, UX flows, and business logic in this package will carry
through directly — this is genuinely most of the *design* work done, with
the *engineering* work still ahead.
