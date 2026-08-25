-- Profile requests submitted through /start
CREATE TABLE IF NOT EXISTS leads (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  identity    TEXT NOT NULL,
  goal        TEXT,
  timeline    TEXT,
  concerns    TEXT,
  notes       TEXT,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  page        TEXT,
  referrer    TEXT,
  ip          TEXT,
  country     TEXT,
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email);
