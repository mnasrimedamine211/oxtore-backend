/*
# Align Products Table with API Contract

## Purpose
Adds all missing fields from the Product canonical model (§2) to the products table,
plus creates wholesale_tiers and product_commissions child tables.

## New Columns on products
- brand (text, default '')
- created_by (uuid, FK to profiles)
- is_public (boolean, default true)
- visibility (enum: public, private, default public)
- published (boolean, default false)
- published_at (timestamptz, nullable)
- sale_types (text[], default '{}')
- wholesale_enabled (boolean, default false)
- consignment_enabled (boolean, default false)
- sale_type (enum: wholesale, retail, both, default retail)
- transaction_mode (enum: consignment, direct, commission, default direct)
- condition (enum: new, used, default new)
- approval_status (enum: draft, pending_review, approved, rejected, default draft)
- status (text, default 'draft') — 'published' | 'draft' | 'archived'
- inventory (jsonb) — ProductInventory: quantity, available, safetyStock, reorderLevel, status
- pricing (jsonb) — ProductPricing: purchasePrice, sellingPrice, wholesalePrice

## New Tables
- wholesale_tiers: per-product wholesale pricing tiers (minQty, unitPrice)
- product_commissions: per-product commission rules (actor, type, value)

## Enum Changes
- Added product_visibility enum
- Added sale_type enum
- Added transaction_mode enum
- Added product_condition enum
- Added product_approval_status enum

## Notes
- Existing cost/price/wholesale_price columns kept for backward compat; pricing JSONB is canonical
- Existing is_active kept; is_public + published are the contract-canonical fields
*/

DO $$ BEGIN
  CREATE TYPE product_visibility AS ENUM ('public', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sale_type AS ENUM ('wholesale', 'retail', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_mode AS ENUM ('consignment', 'direct', 'commission');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_condition AS ENUM ('new', 'used');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_approval_status AS ENUM ('draft', 'pending_review', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add columns to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS visibility product_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS sale_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wholesale_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consignment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_type sale_type NOT NULL DEFAULT 'retail',
  ADD COLUMN IF NOT EXISTS transaction_mode transaction_mode NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS condition product_condition NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS approval_status product_approval_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS inventory jsonb NOT NULL DEFAULT '{"quantity": 0, "available": 0, "safetyStock": 0, "reorderLevel": 0, "status": "out_of_stock"}',
  ADD COLUMN IF NOT EXISTS pricing jsonb NOT NULL DEFAULT '{"purchasePrice": 0, "sellingPrice": 0, "wholesalePrice": 0}';

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_is_public ON products(is_public) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_published ON products(published) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_approval_status ON products(approval_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_created_by ON products(created_by) WHERE deleted_at IS NULL;

-- ============================================
-- WHOLESALE_TIERS
-- ============================================
CREATE TABLE IF NOT EXISTS wholesale_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_qty int NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wholesale_tiers_product ON wholesale_tiers(product_id, min_qty);

ALTER TABLE wholesale_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wholesale_tiers_select" ON wholesale_tiers;
CREATE POLICY "wholesale_tiers_select" ON wholesale_tiers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = wholesale_tiers.product_id AND p.deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = p.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    ))
  );

DROP POLICY IF EXISTS "wholesale_tiers_insert" ON wholesale_tiers;
CREATE POLICY "wholesale_tiers_insert" ON wholesale_tiers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM products p WHERE p.id = wholesale_tiers.product_id AND p.deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = p.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    ))
  );

DROP POLICY IF EXISTS "wholesale_tiers_update" ON wholesale_tiers;
CREATE POLICY "wholesale_tiers_update" ON wholesale_tiers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = wholesale_tiers.product_id AND p.deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = p.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    ))
  );

DROP POLICY IF EXISTS "wholesale_tiers_delete" ON wholesale_tiers;
CREATE POLICY "wholesale_tiers_delete" ON wholesale_tiers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = wholesale_tiers.product_id AND p.deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = p.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    ))
  );

-- ============================================
-- PRODUCT_COMMISSIONS
-- ============================================
DO $$ BEGIN
  CREATE TYPE commission_actor AS ENUM ('seller', 'supervisor', 'manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE commission_type AS ENUM ('percentage', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS product_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  actor commission_actor NOT NULL,
  type commission_type NOT NULL,
  value numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_commissions_product ON product_commissions(product_id);

ALTER TABLE product_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_commissions_select" ON product_commissions;
CREATE POLICY "product_commissions_select" ON product_commissions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_commissions.product_id AND p.deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = p.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    ))
  );

DROP POLICY IF EXISTS "product_commissions_insert" ON product_commissions;
CREATE POLICY "product_commissions_insert" ON product_commissions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_commissions.product_id AND p.deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = p.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    ))
  );

DROP POLICY IF EXISTS "product_commissions_update" ON product_commissions;
CREATE POLICY "product_commissions_update" ON product_commissions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_commissions.product_id AND p.deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = p.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    ))
  );

DROP POLICY IF EXISTS "product_commissions_delete" ON product_commissions;
CREATE POLICY "product_commissions_delete" ON product_commissions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM products p WHERE p.id = product_commissions.product_id AND p.deleted_at IS NULL AND (
      EXISTS (SELECT 1 FROM boutiques b WHERE b.id = p.owner_boutique_id AND (b.manager_id = auth.uid() OR EXISTS (SELECT 1 FROM boutique_owners bo WHERE bo.boutique_id = b.id AND bo.user_id = auth.uid())))
    ))
  );
