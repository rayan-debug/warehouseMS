-- ============================================================
-- Warehouse & Sales Management System — Database Schema
-- Run this file once: psql -U postgres -d warehouse_db -f schema.sql
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(120)        NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255),                         -- NULL for Google-only accounts
  role        VARCHAR(10)         NOT NULL DEFAULT 'staff'
                CHECK (role IN ('admin', 'staff')),
  google_id   VARCHAR(255) UNIQUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── CATEGORIES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(100) UNIQUE NOT NULL
);

-- ─── PRODUCTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200)  NOT NULL,
  description TEXT,
  category_id INTEGER       REFERENCES categories(id) ON DELETE SET NULL,
  price       NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── INVENTORY ──────────────────────────────────────────────
-- 1:1 with products (unique product_id)
CREATE TABLE IF NOT EXISTS inventory (
  id           SERIAL PRIMARY KEY,
  product_id   INTEGER UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity     INTEGER        NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  expiry_date  DATE,
  threshold    INTEGER        NOT NULL DEFAULT 10,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── ALERTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
  id           SERIAL PRIMARY KEY,
  inventory_id INTEGER    NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  type         VARCHAR(10) NOT NULL CHECK (type IN ('low', 'expiry')),
  message      TEXT        NOT NULL,
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── SALES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  notes        TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── SALE ITEMS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
  id            SERIAL PRIMARY KEY,
  sale_id       INTEGER        NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    INTEGER        NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity      INTEGER        NOT NULL CHECK (quantity > 0),
  price_at_sale NUMERIC(10, 2) NOT NULL CHECK (price_at_sale >= 0)
);

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventory_product    ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_alerts_inventory     ON alerts(inventory_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read       ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale      ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product   ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_user           ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_created        ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category_id);

-- ─── FUNCTION: auto-update inventory.last_updated ───────────
CREATE OR REPLACE FUNCTION update_inventory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_updated_at
BEFORE UPDATE ON inventory
FOR EACH ROW EXECUTE FUNCTION update_inventory_timestamp();
