/*
# Align Stock Items and Inventory Movements with API Contract

## Purpose
Adds missing fields from the StockItem and StockMovement canonical models (§2) to the database.

## Changes to stock_items
- available (int, default 0) — available = quantity - reserved
- reserved (int, default 0)
- safety_stock (int, default 0)
- reorder_level (int, default 0)
- status (enum: in_stock, low_stock, out_of_stock, default out_of_stock)

## Changes to inventory_movements
- Add 'adj' to the stock_movement_type enum (contract uses 'in' | 'out' | 'adj')

## New Enum
- product_stock_status: in_stock, low_stock, out_of_stock

## Notes
- Existing quantity column kept; available is computed as quantity - reserved
- Existing min_quantity kept for backward compat; safety_stock and reorder_level are contract-canonical
*/

DO $$ BEGIN
  CREATE TYPE product_stock_status AS ENUM ('in_stock', 'low_stock', 'out_of_stock');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add columns to stock_items
ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS available int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS safety_stock int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_level int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status product_stock_status NOT NULL DEFAULT 'out_of_stock';

-- Add 'adj' to stock_movement_type enum
DO $$ BEGIN
  ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'adj';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill available = quantity for existing rows
UPDATE stock_items SET available = quantity WHERE available = 0 AND deleted_at IS NULL;
