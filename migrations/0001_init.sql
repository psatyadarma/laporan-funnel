CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  bet TEXT NOT NULL,
  variant TEXT,
  answers_json TEXT,
  utm_json TEXT,
  result_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  bet TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | expired
  provider TEXT NOT NULL,
  provider_ref TEXT,
  pay_link TEXT,
  name TEXT,
  email TEXT,
  mobile TEXT,
  event_id TEXT NOT NULL,
  client_json TEXT,           -- ip, user agent, fbp, fbc for Meta CAPI
  report_token TEXT NOT NULL UNIQUE,
  capi_sent INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  paid_at INTEGER
);
CREATE INDEX orders_provider_ref ON orders(provider_ref);
CREATE INDEX orders_status ON orders(status, created_at);
CREATE TABLE reports (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending | ready | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  content_json TEXT,
  error TEXT,
  updated_at INTEGER NOT NULL
);
CREATE TABLE waitlist (
  id TEXT PRIMARY KEY,
  bet TEXT NOT NULL,
  variant TEXT,
  contact TEXT NOT NULL,
  utm_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bet TEXT NOT NULL,
  variant TEXT,
  name TEXT NOT NULL,
  session_id TEXT,
  visitor_id TEXT,
  value INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX events_bet_name ON events(bet, name, created_at);
