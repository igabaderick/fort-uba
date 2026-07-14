-- FORT UBA — PostgreSQL Schema
-- Run via: psql -U postgres -d fortuba -f schema.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- for geo queries (optional, falls back to basic lat/lng)

-- ─────────────────────────────────────────
-- USERS (riders)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone         VARCHAR(20) UNIQUE NOT NULL,
  name          VARCHAR(120),
  photo_url     TEXT,
  emergency_contact_name  VARCHAR(120),
  emergency_contact_phone VARCHAR(20),
  rating        NUMERIC(3,2) DEFAULT 5.00,
  total_trips   INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- DRIVERS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone             VARCHAR(20) UNIQUE NOT NULL,
  name              VARCHAR(120) NOT NULL,
  photo_url         TEXT,
  national_id       VARCHAR(50),
  license_number    VARCHAR(50),
  vehicle_reg       VARCHAR(30),
  vehicle_desc      VARCHAR(120),  -- e.g. "Bajaj Boxer, Red"
  driver_type       VARCHAR(10) NOT NULL CHECK (driver_type IN ('boda','car')),
  status            VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended','rejected')),
  rejection_reason  TEXT,
  is_online         BOOLEAN DEFAULT false,
  current_lat       NUMERIC(10,7),
  current_lng       NUMERIC(10,7),
  rating            NUMERIC(3,2) DEFAULT 5.00,
  total_trips       INTEGER DEFAULT 0,
  -- Financial
  commission_balance  INTEGER DEFAULT 0,  -- UGX owed to FORT UBA (can go negative)
  subscription_paid_until TIMESTAMPTZ,
  -- Docs
  national_id_url   TEXT,
  license_url       TEXT,
  vehicle_reg_url   TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- OTP CODES (phone verification)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_codes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone       VARCHAR(20) NOT NULL,
  code        VARCHAR(8) NOT NULL,
  user_type   VARCHAR(10) NOT NULL CHECK (user_type IN ('rider','driver','admin')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- ADMINS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(200) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name        VARCHAR(120),
  role        VARCHAR(20) DEFAULT 'ops' CHECK (role IN ('ops','owner','superadmin')),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- RIDES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rides (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_number     SERIAL,  -- human-readable e.g. FU-2291
  rider_id        UUID REFERENCES users(id),
  driver_id       UUID REFERENCES drivers(id),
  ride_type       VARCHAR(10) NOT NULL CHECK (ride_type IN ('boda','car')),
  status          VARCHAR(20) DEFAULT 'requested' CHECK (status IN (
    'requested','matching','accepted','driver_arriving','driver_arrived',
    'in_progress','completed','cancelled'
  )),
  -- Locations
  pickup_lat      NUMERIC(10,7),
  pickup_lng      NUMERIC(10,7),
  pickup_address  TEXT,
  pickup_note     TEXT,  -- landmark-based e.g. "near St Paul's Cathedral"
  dest_lat        NUMERIC(10,7),
  dest_lng        NUMERIC(10,7),
  dest_address    TEXT,
  -- Fare
  distance_km     NUMERIC(8,2),
  duration_min    INTEGER,
  fare_estimate   INTEGER,  -- UGX
  fare_final      INTEGER,  -- UGX (set on completion)
  commission      INTEGER,  -- UGX FORT UBA cut
  driver_earnings INTEGER,  -- UGX after commission
  -- Payment
  payment_method  VARCHAR(10) DEFAULT 'cash' CHECK (payment_method IN ('cash','momo')),
  payment_status  VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed')),
  momo_tx_id      TEXT,
  -- Ratings
  rider_rating    SMALLINT CHECK (rider_rating BETWEEN 1 AND 5),
  driver_rating   SMALLINT CHECK (driver_rating BETWEEN 1 AND 5),
  rider_comment   TEXT,
  driver_comment  TEXT,
  -- Cancellation
  cancelled_by    VARCHAR(10) CHECK (cancelled_by IN ('rider','driver','system')),
  cancel_reason   TEXT,
  -- Timestamps
  requested_at    TIMESTAMPTZ DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,
  pickup_at       TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- PRICING CONFIG (editable by admin)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boda_base_fare        INTEGER DEFAULT 1500,   -- UGX
  boda_per_km           INTEGER DEFAULT 450,    -- UGX
  car_base_fare         INTEGER DEFAULT 3000,   -- UGX
  car_per_km            INTEGER DEFAULT 900,    -- UGX
  commission_rate       NUMERIC(4,3) DEFAULT 0.18,  -- 18%
  subscription_weekly   INTEGER DEFAULT 15000,  -- UGX
  cancellation_fee      INTEGER DEFAULT 1000,   -- UGX
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_by            UUID REFERENCES admins(id)
);

-- ─────────────────────────────────────────
-- TRANSACTIONS (financial ledger)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id       UUID REFERENCES drivers(id),
  ride_id         UUID REFERENCES rides(id),
  type            VARCHAR(30) NOT NULL CHECK (type IN (
    'commission_cash','commission_momo','subscription','payout','adjustment'
  )),
  amount          INTEGER NOT NULL,  -- UGX, positive = FORT UBA receives
  balance_before  INTEGER,
  balance_after   INTEGER,
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SAVED PLACES (rider)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_places (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  label       VARCHAR(30) NOT NULL,  -- "Home", "Work", custom
  address     TEXT,
  lat         NUMERIC(10,7),
  lng         NUMERIC(10,7),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rides_rider ON rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_created ON rides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_online ON drivers(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_transactions_driver ON transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, user_type);

-- ─────────────────────────────────────────
-- DEFAULT PRICING ROW
-- ─────────────────────────────────────────
INSERT INTO pricing (id) VALUES (uuid_generate_v4()) ON CONFLICT DO NOTHING;
