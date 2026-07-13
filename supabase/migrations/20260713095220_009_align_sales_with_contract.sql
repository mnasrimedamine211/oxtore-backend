/*
# Align Sales Table with API Contract

## Purpose
Restructures the sales table to match the Sale canonical model (§2):
- Per-product sale records (not multi-item JSONB)
- Adds seller info, commission data, net amount

## Changes to sales
- product_id (uuid, FK to products) — the product sold
- product_name (text) — denormalized for display
- seller_id (uuid, FK to profiles) — who made the sale
- seller_name (text) — denormalized
- quantity (int) — units sold
- unit_price (numeric) — price per unit
- total_amount (numeric) — quantity * unit_price
- commissions (jsonb) — SaleCommission[] array
- net_amount (numeric) — total_amount minus commissions

## Enum Changes
- sale_status: replaced 'completed' with 'confirmed' per contract
  (kept 'completed' for backward compat, added 'confirmed')

## Notes
- Existing items jsonb column kept for backward compat
- Existing subtotal/discount/tax/total columns kept; total_amount is contract-canonical
- Existing employee_id and sold_by kept; seller_id is contract-canonical
*/

-- Add 'confirmed' to sale_status enum
DO $$ BEGIN
  ALTER TYPE sale_status ADD VALUE IF NOT EXISTS 'confirmed';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add columns to sales
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_name text,
  ADD COLUMN IF NOT EXISTS quantity int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commissions jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS net_amount numeric(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id) WHERE deleted_at IS NULL AND product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_id) WHERE deleted_at IS NULL AND seller_id IS NOT NULL;
