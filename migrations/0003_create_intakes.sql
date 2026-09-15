-- Client intake questionnaires submitted through /intake
CREATE TABLE IF NOT EXISTS intakes (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  business    TEXT,
  answers     TEXT NOT NULL,
  debts       TEXT,
  referrer    TEXT,
  ip          TEXT,
  country     TEXT
);

CREATE INDEX IF NOT EXISTS idx_intakes_created_at ON intakes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intakes_email ON intakes (email);
