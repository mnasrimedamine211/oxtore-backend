/*
# Align Boutique Relations and Requests with API Contract

## Purpose
Adds missing fields from the BoutiqueRelation and BoutiqueRequest canonical models (§2).

## Changes to boutique_relations
- type (enum: RESELLER, default RESELLER)
- status (enum: ACTIVE, SUSPENDED, TERMINATED, default ACTIVE)
- description (text, nullable)
- approved_at (timestamptz, nullable)
- approved_by (uuid, FK to profiles, nullable)

## Changes to boutique_requests
- type (enum: RESELLER, default RESELLER)
- rejection_reason (text, nullable)
- responded_at (timestamptz, nullable)
- responded_by (uuid, FK to profiles, nullable)

## Enum Changes
- boutique_relation_type: RESELLER
- boutique_relation_status: ACTIVE, SUSPENDED, TERMINATED
- Updated boutique_request_status: PENDING, ACCEPTED, REJECTED, CANCELLED (replaces pending/approved/rejected)

## Notes
- Existing requester_id/receiver_id columns kept; contract uses fromBoutiqueId/toBoutiqueId
  but the DB columns are the underlying storage; API layer maps between them
- Existing boutique_request_status enum values (pending/approved/rejected) kept for backward compat;
  new uppercase values added via a new enum
*/

DO $$ BEGIN
  CREATE TYPE boutique_relation_type AS ENUM ('RESELLER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE boutique_relation_status AS ENUM ('ACTIVE', 'SUSPENDED', 'TERMINATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE boutique_request_status_v2 AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add columns to boutique_relations
ALTER TABLE boutique_relations
  ADD COLUMN IF NOT EXISTS type boutique_relation_type NOT NULL DEFAULT 'RESELLER',
  ADD COLUMN IF NOT EXISTS status boutique_relation_status NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_boutique_relations_status ON boutique_relations(status) WHERE deleted_at IS NULL;

-- Add columns to boutique_requests
ALTER TABLE boutique_requests
  ADD COLUMN IF NOT EXISTS type boutique_relation_type NOT NULL DEFAULT 'RESELLER',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS responded_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_boutique_requests_type ON boutique_requests(type) WHERE deleted_at IS NULL;
