/*
# Add Categories and User Settings Tables

## Purpose
Creates two tables referenced by the API Contract:
- categories: MarketplaceCategory (§13, §14) — id, name, icon, slug
- user_settings: UserSettings (§5) — notifications, darkMode, language, currency

## New Tables
- categories: product categories for marketplace browsing
  - id (uuid, PK)
  - name (text, not null) — display label
  - slug (text, unique) — stable identifier (maps to product.category field)
  - icon (text) — icon name for UI
  - is_active (boolean, default true)
  - audit fields

- user_settings: per-user settings
  - id (uuid, PK)
  - user_id (uuid, unique, FK to profiles, CASCADE)
  - notifications (boolean, default true)
  - dark_mode (boolean, default false)
  - language (text, default 'en') — en | fr | ar
  - currency (text, default 'USD')
  - audit fields

## Security
- categories: readable by all authenticated users
- user_settings: owner-scoped CRUD
*/

-- ============================================
-- CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories FOR SELECT
  TO authenticated USING (true);

-- ============================================
-- USER_SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  notifications boolean NOT NULL DEFAULT true,
  dark_mode boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'en',
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_settings_select_own" ON user_settings;
CREATE POLICY "user_settings_select_own" ON user_settings FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_settings_insert_own" ON user_settings;
CREATE POLICY "user_settings_insert_own" ON user_settings FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_settings_update_own" ON user_settings;
CREATE POLICY "user_settings_update_own" ON user_settings FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_settings_delete_own" ON user_settings;
CREATE POLICY "user_settings_delete_own" ON user_settings FOR DELETE
  TO authenticated USING (user_id = auth.uid());
