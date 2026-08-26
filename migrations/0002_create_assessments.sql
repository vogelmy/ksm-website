-- Self-assessments submitted through /assessment
CREATE TABLE IF NOT EXISTS assessments (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  identity    TEXT NOT NULL,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  score       REAL NOT NULL,
  band        TEXT NOT NULL,
  weakest     TEXT,
  cash_flow   INTEGER,
  debt        INTEGER,
  credit      INTEGER,
  liquidity   INTEGER,
  income      INTEGER,
  capital     INTEGER,
  answers     TEXT,
  referrer    TEXT,
  ip          TEXT,
  country     TEXT
);

CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessments_email ON assessments (email);
