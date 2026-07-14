# FORT UBA — Product Documentation
### Ride-Hailing Platform for Fort Portal, Uganda

---

## 1. Executive Overview

FORT UBA is a ride-hailing platform serving Fort Portal and surrounding areas in Uganda, offering both **boda boda (motorcycle)** and **car/taxi** rides. The platform connects riders with drivers through a mobile app, supports both **mobile money and cash** payments, and generates revenue through a hybrid model of **per-ride commission** and **driver subscription fees**.

The platform consists of three components:
1. **Rider App** — for customers requesting rides
2. **Driver App** — for boda boda and car drivers accepting and fulfilling rides
3. **Admin Dashboard** — for FORT UBA staff to manage operations, drivers, and finances

Drivers will be a mix of **company-owned/employed drivers** and **independent drivers** who apply and are vetted to join the platform.

---

## 2. User Personas

| Persona | Description | Primary Need |
|---|---|---|
| **Rider** | Resident or visitor in Fort Portal needing transport | Fast, safe, affordable ride with price transparency |
| **Boda Driver** | Motorcycle taxi operator, may be independent or company-affiliated | Steady stream of ride requests, fair payout, low friction |
| **Car Driver** | Taxi/car operator, may be independent or company-affiliated | Same as above, plus higher-value/longer trips |
| **Admin/Ops Staff** | FORT UBA employee managing the platform | Visibility into rides, drivers, disputes, revenue |
| **Company Owner (You)** | Business owner | Revenue tracking, growth metrics, driver compliance |

---

## 3. Core Features by App

### 3.1 Rider App (Client-Side App)

This is the customer-facing mobile app — the one riders in Fort Portal download to book boda or car rides. Below is a full screen-by-screen breakdown.

**Screen Flow**

| # | Screen | Purpose |
|---|---|---|
| 1 | Splash/Launch | Logo, checks login state |
| 2 | Phone Number Entry | Enter number to receive OTP |
| 3 | OTP Verification | 4–6 digit code confirmation |
| 4 | Profile Setup | Name, optional photo, emergency contact (first-time users only) |
| 5 | Home/Map Screen | Default landing screen after login — see below |
| 6 | Set Pickup | Confirm/adjust pickup pin |
| 7 | Set Destination | Search or pin destination |
| 8 | Ride Type Selection | Boda vs Car, with fare estimate for each |
| 9 | Confirm Booking | Final fare estimate, payment method toggle, confirm button |
| 10 | Finding Driver | Searching/matching animation, cancel option |
| 11 | Driver Assigned | Driver name, photo, rating, vehicle/plate info, ETA, call/chat buttons |
| 12 | Live Trip Tracking | Map with driver's live position en route to pickup, then to destination |
| 13 | Trip Completed | Fare breakdown, payment confirmation |
| 14 | Rate Driver | Star rating + optional comment |
| 15 | Ride Receipt | Summary saved to history |
| 16 | Ride History | List of past trips, tap for receipt detail |
| 17 | Profile/Settings | Edit profile, saved places (home/work), payment method, emergency contacts |
| 18 | Help/Support | FAQ, report an issue, contact support |
| 19 | SOS/Emergency | One-tap emergency action during an active trip |

**Home/Map Screen (Screen 5) — the core screen**
- Full-screen map centered on rider's current location
- "Where to?" search bar at top or bottom
- Quick-access saved places (Home, Work, recently used)
- Current promotions/announcements banner (optional, Phase 2)

**Booking Details**
- Pickup: GPS auto-detected by default, but always editable via drag-the-pin (important in Fort Portal, since many locations won't have formal street addresses — landmark-based pickup notes should be supported, e.g. "near St. Paul's Cathedral")
- Destination: text search with autocomplete, or pin drop on map, or select from saved places
- Fare estimate shown *before* confirming — should show both Boda and Car estimates side by side so the rider can compare
- Estimated wait time for a driver to arrive at pickup

**During-Trip Experience**
- Live map with driver icon moving in real time
- Driver ETA countdown, updates dynamically
- Trip status label updates automatically: "Driver arriving" → "Arrived at pickup" → "Trip in progress" → "Arriving at destination"
- Masked-number call button (protects both parties' real phone numbers) and in-app chat
- Cancel button available before pickup, with a cancellation reason prompt and possible cancellation fee if driver already en route

**Payment**
- Payment method selected/confirmed at booking (Screen 9), not after — avoids disputes
- Mobile money: triggers a payment prompt (MTN MoMo / Airtel Money push) either at booking or at trip completion — this is a decision to lock in
- Cash: simply marked as cash-due, fare shown clearly to both rider and driver at trip end
- Digital receipt after every trip regardless of payment method

**Notifications (push)**
- Driver assigned / driver arriving
- Driver arrived at pickup
- Trip started / trip completed
- Promotions or service announcements (optional)
- Safety check-in during unusually long trips (optional, Phase 2)

**Safety**
- Share live trip status link with a trusted contact (SMS/WhatsApp share)
- SOS/emergency button, always visible during an active trip
- Driver identity always visible before and during trip: photo, name, rating, plate/registration number
- Trip audit trail (route taken, timestamps) stored for dispute resolution

**Edge Cases to Design For**
- No drivers available nearby → clear messaging + option to be notified when one is
- Driver cancels after accepting → automatic re-matching, rider notified
- Rider cancels after driver is en route → cancellation fee logic
- Poor/lost connectivity mid-trip → app should retry silently and not lose trip state
- Rider requests a ride while offline/no data → graceful error, not a crash

**Account & Support**
- Sign up via phone number (OTP — standard in Uganda, works with MTN/Airtel lines)
- Profile: name, photo, emergency contact, saved places
- Ride history with full receipts
- In-app help/FAQ, report an issue (lost item, driver complaint, fare dispute)

---

### 3.2 Driver App

**Onboarding & Verification**
- Application flow: personal details, national ID, driving permit/license, vehicle registration, passport photo
- Document upload for admin review/approval
- Status tracking (pending, approved, rejected — with reason)
- Choice of driver type: Boda or Car (affects ride types they receive)

**Going Online**
- Toggle online/offline availability
- View current subscription/commission status (must be in good standing to go online)

**Receiving Rides**
- Incoming ride request with pickup/destination, estimated fare, and distance to pickup
- Accept/decline within a time window
- Turn-by-turn navigation to pickup, then to destination
- Mark trip milestones (arrived, started, completed)

**Earnings**
- Per-trip earnings breakdown (fare minus commission, if commission model applies to that trip)
- Daily/weekly earnings summary
- Subscription payment status and renewal (mobile money)
- Cash vs mobile money trip reconciliation (important since cash trips still owe commission to FORT UBA)

**Support**
- In-app help
- Dispute a fare or rider report

---

### 3.3 Admin Dashboard (Web-based)

**Driver Management**
- Review and approve/reject driver applications and documents
- Suspend/deactivate drivers (for non-payment, complaints, safety issues)
- View driver performance (ratings, completed trips, cancellation rate)

**Ride Management**
- Live map of active rides and online drivers
- Ride history and search (by rider, driver, date, status)
- Dispute/complaint resolution queue

**Financial Management**
- Commission collection tracking (especially critical for **cash trips**, where the driver owes FORT UBA their cut but no digital transaction occurred automatically)
- Subscription payment tracking and renewal reminders
- Revenue reports (daily/weekly/monthly, by ride type, by area)
- Payout management if FORT UBA pays company-employed drivers directly

**Operations**
- Pricing configuration (base fare, per-km rate, per-minute rate, by ride type)
- Surge/demand pricing rules (optional, for later phase)
- Zone/coverage area management (Fort Portal town + surrounding areas, expandable)
- Push notifications/announcements to riders or drivers

**Analytics**
- Ride volume trends
- Popular routes/areas
- Driver supply vs rider demand by time of day

---

## 4. Business Model Detail

Two revenue streams, working together:

| Model | How it Works | Best Fit |
|---|---|---|
| **Commission per ride** | FORT UBA takes a % of each fare (e.g., 15–20%, to be decided) | Independent drivers, pay-as-you-go, lower barrier to join |
| **Subscription/membership** | Driver pays a flat daily/weekly/monthly fee for platform access | Predictable revenue; could be discounted/waived for high-commission drivers, or used as the *only* charge for company-employed drivers |

**Key open decision:** whether a driver pays commission *and* subscription simultaneously, or whether drivers choose one model (e.g., "pay-per-ride" vs "unlimited rides for a flat weekly fee"). This affects app logic significantly and should be settled before development starts — I'd recommend we lock this down together as one of the next steps.

**Cash trip reconciliation** is a known challenge for hybrid cash/mobile-money ride-hailing platforms: when a rider pays cash, FORT UBA still needs to collect its commission from the driver afterward. Common approaches:
- Driver's in-app "wallet" goes negative and must be topped up via mobile money before going online again
- Daily/weekly settlement requirement
- Pre-paid ride credits that get deducted regardless of how the rider pays

---

## 5. Core User Flow: Requesting a Ride

1. Rider opens app → sets pickup (auto or pinned) → sets destination
2. Rider selects Boda or Car → sees fare estimate → confirms request
3. System matches nearest available, online, in-good-standing driver
4. Driver receives request → accepts (or it cascades to next nearest driver if declined/timeout)
5. Rider sees driver info + live ETA
6. Driver arrives → picks up rider → navigates to destination
7. Trip ends → fare finalized → payment processed (mobile money) or marked as cash
8. Both parties rate each other
9. Commission/subscription ledger updated on the backend

---

## 6. Technical Recommendations

**Platform**
- Native or cross-platform (React Native or Flutter) for Rider + Driver apps — recommended given need for both Android (dominant in Uganda) and eventually iOS
- Web-based Admin Dashboard (React or similar)

**Backend**
- REST/GraphQL API backend (Node.js, Django, or similar)
- Real-time layer for live location and dispatch (WebSockets or a service like Firebase/Pusher)
- PostgreSQL or similar relational DB for rides, users, transactions

**Key Integrations**
- **MTN Mobile Money & Airtel Money APIs** for in-app payments and driver subscription payments
- **Google Maps Platform** (or OpenStreetMap-based alternative, cheaper at scale) for geocoding, routing, and live tracking — worth checking Fort Portal's map data quality on both before committing
- SMS gateway for OTP verification and notifications (works well in areas with inconsistent data connectivity)

**Offline/Low-Connectivity Considerations**
- Fort Portal and surrounding areas may have inconsistent mobile data — apps should degrade gracefully (cached maps, retry logic, SMS fallback for critical alerts)

---

## 7. Suggested MVP Scope (Phase 1)

To get to market fastest, I'd suggest launching with:
- Rider app: booking, live tracking, mobile money + cash payment, ratings
- Driver app: onboarding, accept/decline rides, navigation, earnings view
- Admin dashboard: driver approval, live ride monitoring, basic financial reporting
- One pricing model locked in (commission OR subscription first, add the second once the platform is stable)
- Fort Portal town only, expand to surrounding areas in Phase 2

**Phase 2+** additions: surge pricing, scheduled rides, ride-sharing/pooling, loyalty rewards, expanded coverage area, in-app wallet top-ups.

---

## 8. Open Decisions Needed Before Development

- [ ] Exact commission % and subscription fee amounts
- [ ] Whether commission and subscription apply simultaneously or are alternative options per driver
- [ ] Cash trip commission collection mechanism
- [ ] Pricing structure (base fare + per-km + per-minute, and whether boda/car pricing differs)
- [ ] Launch timeline and budget
- [ ] Whether iOS support is needed at launch or Android-only initially
