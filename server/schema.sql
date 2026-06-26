CREATE TABLE IF NOT EXISTS licenses (
  id          SERIAL PRIMARY KEY,
  key         TEXT UNIQUE NOT NULL,
  hwid        TEXT,
  status      TEXT NOT NULL DEFAULT 'active',  -- active | revoked
  note        TEXT,
  plan        TEXT DEFAULT 'standard',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  last_seen   TIMESTAMPTZ,
  last_ip     TEXT
);

CREATE TABLE IF NOT EXISTS activations (
  id         SERIAL PRIMARY KEY,
  license_id INTEGER REFERENCES licenses(id) ON DELETE CASCADE,
  hwid       TEXT,
  ip         TEXT,
  ok         BOOLEAN,
  reason     TEXT,
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key);
CREATE INDEX IF NOT EXISTS idx_activations_license ON activations(license_id);
