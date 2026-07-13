/*
# Align Stock Requests with API Contract

## Purpose
Adds missing fields from the StockRequest canonical model (§2) to stock_requests table.

## Changes to stock_requests
- from_boutique_name (text) — denormalized for display
- to_boutique_name (text) — denormalized for display
- product_name (text) — denormalized for display
- product_image (text, nullable) — denormalized for display
- unit_price (numeric) — price per unit
- total_amount (numeric) — quantity * unit_price
- rejection_reason (text, nullable)
- responded_at (timestamptz, nullable)
- responded_by (uuid, FK to profiles, nullable)
- fulfilled_at (timestamptz, nullable)

## Notes
- Existing requester_id/receiver_id columns kept; contract uses fromBoutiqueId/toBoutiqueId
  but the DB columns are the underlying storage; API layer maps between them
- Existing note column kept; contract uses message field, mapped in API layer
*/

ALTER TABLE stock_requests
  ADD COLUMN IF NOT EXISTS from_boutique_name text,
  ADD COLUMN IF NOT EXISTS to_boutique_name text,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_image text,
  ADD COLUMN IF NOT EXISTS unit_price numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;
