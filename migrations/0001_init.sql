-- Nationwide store/stock snapshot populated by the Worker's cron indexer (src/lib/telstra/indexer.ts).
-- Read by /api/stock/page instead of calling Telstra live on every visitor request.
CREATE TABLE IF NOT EXISTS stores (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  suburb TEXT NOT NULL,
  postcode TEXT NOT NULL,
  state TEXT NOT NULL,
  phone TEXT,
  latitude REAL,
  longitude REAL,
  hours TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock (
  store_code TEXT NOT NULL,
  sku TEXT NOT NULL,
  status TEXT NOT NULL,
  usage_type TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (store_code, sku)
);
CREATE INDEX IF NOT EXISTS idx_stock_sku ON stock(sku);

-- Single-row-per-key table holding the indexer's rotating cursor and cycle timestamps.
CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
